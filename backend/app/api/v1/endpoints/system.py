"""
System Health & Settings API
"""

import logging
import time
from typing import Optional

import psutil
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_admin_user
from app.core.database import get_db
from app.core.utils import utcnow
from app.models.system_setting import SystemSetting
from app.schemas.system import BrandingResponse, BrandingUpdate
from app.services.audit_service import AuditService
from app.services.registration_policy import get_effective_registration_mode

router = APIRouter()
logger = logging.getLogger(__name__)

START_TIME = time.time()


class ServiceStatus(BaseModel):
    status: str  # "ok" | "degraded" | "down"
    latency_ms: Optional[float] = None
    detail: Optional[str] = None


class SystemHealth(BaseModel):
    uptime_seconds: float
    database: ServiceStatus
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_total_mb: float
    disk_percent: float


@router.get("/health", response_model=SystemHealth)
async def get_system_health(
    _current_user=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only system resource health probe"""
    db_status = ServiceStatus(status="ok")
    try:
        t0 = time.perf_counter()
        await db.execute(text("SELECT 1"))
        db_status.latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    except Exception:
        logger.exception("system health database probe failed")
        db_status = ServiceStatus(
            status="down",
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )

    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return SystemHealth(
        uptime_seconds=round(time.time() - START_TIME, 1),
        database=db_status,
        cpu_percent=psutil.cpu_percent(interval=None),
        memory_percent=mem.percent,
        memory_used_mb=round(mem.used / 1024 / 1024, 1),
        memory_total_mb=round(mem.total / 1024 / 1024, 1),
        disk_percent=disk.percent,
    )


@router.get("/branding", response_model=BrandingResponse)
async def get_branding(db: AsyncSession = Depends(get_db)):
    """Public endpoint to get current workspace / team branding & settings"""
    stmt = select(SystemSetting).where(
        SystemSetting.key.in_(["company_name", "company_tagline", "brand_logo_url", "registration_mode"])
    )
    result = await db.execute(stmt)
    settings_map = {s.key: s.value for s in result.scalars().all()}
    # Resolve the policy the same way /auth/registration-mode does. Reporting a
    # separate default here is what let the login page advertise an approval
    # flow that the registration endpoint then refused as "closed".
    effective_mode = await get_effective_registration_mode(db)
    return BrandingResponse(
        company_name=settings_map.get("company_name") or "ART Workspace",
        company_tagline=settings_map.get("company_tagline") or "จัดการวันทำงานของคุณให้ง่ายขึ้น",
        brand_logo_url=settings_map.get("brand_logo_url") or "",
        registration_mode=effective_mode,
    )


@router.put("/branding", response_model=BrandingResponse)
async def update_branding(
    payload: BrandingUpdate,
    request: Request,
    current_admin=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only endpoint to update company / team branding and registration policy"""
    company_name = payload.company_name.strip()
    company_tagline = (payload.company_tagline or "").strip()
    brand_logo_url = (payload.brand_logo_url or "").strip()

    updates = {
        "company_name": company_name,
        "company_tagline": company_tagline,
        "brand_logo_url": brand_logo_url,
    }
    if payload.registration_mode:
        if payload.registration_mode not in ("closed", "approval", "open"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="โหมดการรับสมัครสมาชิกต้องเป็น closed, approval หรือ open",
            )
        updates["registration_mode"] = payload.registration_mode

    current_time = utcnow()
    for key, val in updates.items():
        setting = await db.get(SystemSetting, key)
        if setting:
            setting.value = val
            setting.updated_at = current_time
        else:
            db.add(SystemSetting(key=key, value=val, created_at=current_time, updated_at=current_time))

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    mode_label = payload.registration_mode or "unchanged"
    await audit_service.log_action(
        action="UPDATE_BRANDING",
        user_id=current_admin.id,
        details=(
            f"Updated company/team branding: '{company_name}', "
            f"registration_mode: '{mode_label}'"
        ),
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    # Read the policy back through the shared resolver: when this request did
    # not change it, the answer must still describe what is actually enforced.
    return BrandingResponse(
        company_name=company_name,
        company_tagline=company_tagline,
        brand_logo_url=brand_logo_url,
        registration_mode=await get_effective_registration_mode(db),
    )
