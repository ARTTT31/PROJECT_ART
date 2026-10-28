"""
System Health & Settings API
"""

import base64
import io
import logging
import os
import time
from typing import Optional

import psutil
from PIL import Image
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_admin_user
from app.api.v1.endpoints.profile import AVATAR_MAX_BYTES
from app.core.brand_logo import (
    LOGO_ALLOWED_EXTENSIONS,
    LOGO_ICON_MAX_SIZE,
    LOGO_ICON_MIN_SIZE,
    LOGO_SUPPORTED_HINT,
    logo_data_url,
    normalise_logo_image,
    validate_logo_content,
)
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import get_real_client_ip, limiter
from app.core.utils import utcnow
from app.models.system_setting import SystemSetting
from app.schemas.system import BrandingResponse, BrandingUpdate
from app.services.audit_service import AuditService
from app.services.registration_policy import get_effective_registration_mode

router = APIRouter()
logger = logging.getLogger(__name__)

START_TIME = time.time()

_UPLOAD_LIMIT = f"{settings.RATE_LIMIT_UPLOAD_PER_MINUTE}/minute"

BRANDING_KEYS = ["company_name", "company_tagline", "brand_logo_url", "registration_mode"]

# Logo validation/normalisation lives in app.core.brand_logo so the per-user
# workspace branding endpoints can share exactly the same guarantees.


async def _branding_response(db: AsyncSession) -> BrandingResponse:
    """Read the stored branding rows back into the public response shape."""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key.in_(BRANDING_KEYS))
    )
    settings_map = {s.key: s.value for s in result.scalars().all()}
    return BrandingResponse(
        company_name=settings_map.get("company_name") or "ART Workspace",
        company_tagline=settings_map.get("company_tagline")
        or "จัดการวันทำงานของคุณให้ง่ายขึ้น",
        brand_logo_url=settings_map.get("brand_logo_url") or "",
        registration_mode=await get_effective_registration_mode(db),
    )


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
    """Public endpoint to get current workspace / team branding & settings."""
    # The registration policy is resolved through the shared resolver (see
    # _branding_response): reporting a separate default here is what let the
    # login page advertise an approval flow that the register endpoint refused.
    return await _branding_response(db)


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

    updates = {
        "company_name": company_name,
        "company_tagline": company_tagline,
    }
    # A missing logo field means "leave it alone". Treating it as "" wiped the
    # uploaded logo every time the admin saved the name or the tagline.
    if "brand_logo_url" in payload.model_fields_set:
        updates["brand_logo_url"] = (payload.brand_logo_url or "").strip()
    if payload.registration_mode:
        if payload.registration_mode not in ("closed", "approval", "open"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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

    # Read everything back through the shared resolver: when this request did
    # not change the logo or the policy, the answer must still describe what is
    # actually stored and enforced.
    return await _branding_response(db)


@router.get("/branding/logo.png")
async def get_branding_logo_icon(
    size: int = 192,
    db: AsyncSession = Depends(get_db),
):
    """Serve the workspace logo as a real PNG.

    A web app manifest cannot point at a ``data:`` URL, so the favicon and PWA
    icons need an actual image response. The stored logo is always a normalised
    square WebP, which is re-encoded to PNG here (and resized on demand) so the
    browser gets a format every platform accepts.
    """
    setting = await db.get(SystemSetting, "brand_logo_url")
    stored = (setting.value or "") if setting else ""
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="ยังไม่ได้ตั้งค่าโลโก้ของทีม"
        )

    # An admin may have pasted an https:// logo instead of uploading one; the
    # browser can fetch that directly, so no proxy (and no SSRF surface) here.
    if not stored.startswith("data:image/"):
        return RedirectResponse(url=stored, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    target = max(LOGO_ICON_MIN_SIZE, min(size, LOGO_ICON_MAX_SIZE))
    try:
        encoded = stored.split(",", 1)[1]
        with Image.open(io.BytesIO(base64.b64decode(encoded))) as source:
            image = source.convert("RGBA")
            image.thumbnail((target, target))
            buffer = io.BytesIO()
            image.save(buffer, format="PNG", optimize=True)
    except Exception:
        logger.warning("stored brand logo could not be rendered as png", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="โลโก้ที่บันทึกไว้ไม่สามารถแสดงผลได้",
        )

    return Response(
        content=buffer.getvalue(),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.post("/branding/logo", response_model=BrandingResponse)
@limiter.limit(_UPLOAD_LIMIT)
async def upload_branding_logo(
    request: Request,
    file: UploadFile = File(...),
    current_admin=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only upload for the workspace logo.

    The logo is stored the same way avatars are: the audited upload pipeline
    sniffs the magic bytes, refuses anything that is not a real JPEG/PNG/GIF,
    then downscales and re-encodes to a small WebP before it is written to
    ``system_settings`` as a data URL. Client bytes never reach the DB.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in LOGO_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LOGO_SUPPORTED_HINT,
        )

    # Bounded read: one byte past the cap is enough to reject an oversized file
    # without pulling the whole body into memory first.
    contents = await file.read(AVATAR_MAX_BYTES + 1)
    if len(contents) > AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ขนาดไฟล์รูปภาพห้ามเกิน 1MB",
        )

    validate_logo_content(
        contents, (file.content_type or "").split(";")[0].strip().lower()
    )
    logo_value = logo_data_url(normalise_logo_image(contents))

    current_time = utcnow()
    setting = await db.get(SystemSetting, "brand_logo_url")
    if setting:
        setting.value = logo_value
        setting.updated_at = current_time
    else:
        db.add(
            SystemSetting(
                key="brand_logo_url",
                value=logo_value,
                created_at=current_time,
                updated_at=current_time,
            )
        )

    await AuditService(db).log_action(
        action="UPLOAD_BRAND_LOGO",
        user_id=current_admin.id,
        details="Admin uploaded a new workspace logo",
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return await _branding_response(db)
