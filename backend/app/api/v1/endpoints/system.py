"""
System Health & Settings API
"""

import base64
import io
import logging
import os
import time
import warnings
from typing import Optional

import psutil
from PIL import Image, ImageOps
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_admin_user
from app.api.v1.endpoints.profile import AVATAR_MAX_BYTES, _validate_avatar_content
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

# A workspace logo is rendered at 34px in the sidebar, so 256px is plenty even
# on a 4x display. Slightly higher quality than avatars: logos are usually flat
# colour and line art, where compression artefacts are easy to see.
LOGO_MAX_DIMENSION = 256
LOGO_WEBP_QUALITY = 88


def _logo_data_url(webp_bytes: bytes) -> str:
    """Wrap normalised WebP bytes as a data URL (what the UI renders)."""
    encoded = base64.b64encode(webp_bytes).decode("utf-8")
    return f"data:image/webp;base64,{encoded}"


def _normalise_logo_image(data: bytes) -> bytes:
    """Downscale an uploaded logo to a bounded WebP, keeping transparency.

    This deliberately does not reuse the avatar normaliser: that one flattens
    every image to RGB because a photo never needs alpha, which turned a
    transparent PNG logo into a black square in the sidebar. Logos keep their
    alpha channel here, while the size ceiling and re-encode guarantees are the
    same.
    """
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                image = ImageOps.exif_transpose(source)
                has_alpha = image.mode in ("RGBA", "LA", "PA") or (
                    image.mode == "P" and "transparency" in image.info
                )
                image = image.convert("RGBA" if has_alpha else "RGB")
                image.thumbnail((LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION))
                buffer = io.BytesIO()
                image.save(buffer, format="WEBP", quality=LOGO_WEBP_QUALITY)
        return buffer.getvalue()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        logger.warning("brand logo refused: image exceeds the pixel ceiling")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รูปภาพมีขนาดพิกเซลใหญ่เกินไป กรุณาใช้รูปภาพที่เล็กลง",
        )
    except Exception:
        logger.warning("brand logo could not be decoded", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถประมวลผลไฟล์รูปภาพได้ กรุณาใช้ไฟล์ JPEG, PNG หรือ GIF ที่ถูกต้อง",
        )


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
    if ext not in [".jpg", ".jpeg", ".png", ".gif"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รองรับเฉพาะไฟล์รูปภาพ (jpg, jpeg, png, gif)",
        )

    # Bounded read: one byte past the cap is enough to reject an oversized file
    # without pulling the whole body into memory first.
    contents = await file.read(AVATAR_MAX_BYTES + 1)
    if len(contents) > AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ขนาดไฟล์รูปภาพห้ามเกิน 1MB",
        )

    _validate_avatar_content(
        contents, (file.content_type or "").split(";")[0].strip().lower()
    )
    logo_data_url = _logo_data_url(_normalise_logo_image(contents))

    current_time = utcnow()
    setting = await db.get(SystemSetting, "brand_logo_url")
    if setting:
        setting.value = logo_data_url
        setting.updated_at = current_time
    else:
        db.add(
            SystemSetting(
                key="brand_logo_url",
                value=logo_data_url,
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
