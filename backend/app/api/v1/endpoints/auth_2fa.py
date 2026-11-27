"""
Two-factor authentication (TOTP), step-up re-verification and trusted browsers.

Split out of ``auth.py``: these routes share a second-factor concern (and its
audit actions) rather than the password/session/Google flows, and keeping them
apart is what makes either module readable.
"""

import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.dependencies import get_current_user, require_step_up
from app.core.config import settings
from app.core.cookies import COOKIE_OPTIONS
from app.core.database import get_db
from app.core.rate_limit import AUTH_RATE_LIMIT, get_real_client_ip, limiter
from app.core.security import (
    create_step_up_token,
    decode_token,
    decode_trusted_device_token,
    get_user_2fa_salt,
    verify_password,
)
from app.core.totp import (
    generate_recovery_codes,
    generate_secret,
    load_recovery_hashes,
    match_recovery_code,
    provisioning_uri,
    verify as verify_totp,
)
from app.core.utils import utc_iso, utcnow
from app.models.trusted_device import TrustedDevice
from app.models.user import User
from app.schemas.response import ResponseModel
from app.schemas.user import TwoFactorCodeRequest, TwoFactorDisableRequest
from app.services.audit_service import AuditService

router = APIRouter()

_AUTH_LIMIT = AUTH_RATE_LIMIT

# ══════════════════════════════════════════════════════════════════════════
# Two-factor authentication (TOTP)
# ══════════════════════════════════════════════════════════════════════════
# Deliberately three small endpoints rather than one "toggle": starting a
# setup must never enable 2FA, and turning it off must re-prove the password.
# A half-finished setup therefore cannot lock the account out.


@router.get("/2fa/status", response_model=ResponseModel)
async def two_factor_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Whether this account needs a second factor, and codes left."""
    return ResponseModel(
        result="success",
        message="สถานะการยืนยันสองขั้นตอน",
        data={
            "enabled": bool(current_user.totp_enabled),
            "recovery_codes_remaining": len(
                load_recovery_hashes(current_user.totp_recovery_codes)
            ),
        },
    )


@router.post("/2fa/setup", response_model=ResponseModel)
@limiter.limit(_AUTH_LIMIT)
async def two_factor_setup(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a new secret (not yet active) and the otpauth URI to scan."""
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="เปิดใช้งานการยืนยันสองขั้นตอนอยู่แล้ว",
        )

    secret = generate_secret()
    current_user.totp_secret = secret
    # Any previously issued codes belong to the old secret.
    current_user.totp_recovery_codes = None
    await db.commit()

    account = current_user.email or current_user.username or f"user-{current_user.id}"
    return ResponseModel(
        result="success",
        message="สแกน QR Code ด้วยแอป Authenticator แล้วกรอกรหัสเพื่อยืนยัน",
        data={
            "secret": secret,
            "otpauth_uri": provisioning_uri(secret, account),
            "issuer": "Workspace",
        },
    )


@router.post("/2fa/enable", response_model=ResponseModel)
@limiter.limit(_AUTH_LIMIT)
async def two_factor_enable(
    payload: TwoFactorCodeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate a pending secret once the user proves they scanned it."""
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="เปิดใช้งานการยืนยันสองขั้นตอนอยู่แล้ว",
        )
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ยังไม่ได้เริ่มตั้งค่า กรุณาขอ QR Code ใหม่",
        )
    if not verify_totp(current_user.totp_secret, payload.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="รหัสไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาลองใหม่",
        )

    codes, hashes = generate_recovery_codes()
    current_user.totp_enabled = True
    current_user.totp_recovery_codes = json.dumps(hashes)

    client_ip = get_real_client_ip(request)
    await AuditService(db).log_action(
        action="2FA_ENABLED",
        user_id=current_user.id,
        details=f"Recovery codes issued: {len(codes)}",
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseModel(
        result="success",
        message="เปิดใช้งานการยืนยันสองขั้นตอนแล้ว",
        data={"enabled": True, "recovery_codes": codes},
    )


@router.post("/2fa/disable", response_model=ResponseModel)
@limiter.limit(_AUTH_LIMIT)
async def two_factor_disable(
    payload: TwoFactorDisableRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Turn 2FA off. Requires the password AND a current code.

    A stolen session cookie is not enough: disabling 2FA needs the password and
    something only the second factor can produce.
    """
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="รหัสผ่านไม่ถูกต้อง",
        )
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="การยืนยันสองขั้นตอนไม่ได้เปิดใช้งาน",
        )
    if not payload.code or not verify_totp(current_user.totp_secret or "", payload.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="รหัสยืนยันไม่ถูกต้อง",
        )

    current_user.totp_enabled = False
    current_user.totp_secret = None
    current_user.totp_recovery_codes = None

    client_ip = get_real_client_ip(request)
    await AuditService(db).log_action(
        action="2FA_DISABLED",
        user_id=current_user.id,
        details="Two-factor authentication turned off",
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseModel(
        result="success",
        message="ปิดการยืนยันสองขั้นตอนแล้ว",
        data={"enabled": False},
    )


class StepUpVerifyRequest(BaseModel):
    """A live authenticator code or a single-use recovery code."""

    code: str = ""


@router.post("/step-up", response_model=ResponseModel)
@limiter.limit(_AUTH_LIMIT)
async def verify_step_up(
    payload: StepUpVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Prove the second factor again for the next few minutes.

    The session cookie authenticates a *browser*, not a person. Actions that
    hand out the account — changing the password, signing out every device,
    exporting the data, revoking every trusted browser — are gated behind this
    fresh proof, so a copied cookie alone cannot perform them.

    The result is a ``step_up`` cookie bound to this session id and to
    ``STEP_UP_TTL_SECONDS``; it is not a new login and grants nothing else.
    """
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="การยืนยันสองขั้นตอนยังไม่เปิดใช้งาน",
        )

    access_payload = decode_token(request.cookies.get("access_token") or "")
    session_id = (
        access_payload.get("sid")
        if access_payload and access_payload.get("type") == "access"
        else None
    )
    if not isinstance(session_id, str) or not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่พบเซสชันที่ใช้งานอยู่ กรุณาเข้าสู่ระบบใหม่",
        )

    code = (payload.code or "").strip()
    verified = False
    used_recovery = False
    if code.isdigit() and len(code) == 6:
        verified = bool(current_user.totp_secret) and verify_totp(
            current_user.totp_secret or "", code
        )
    elif code:
        stored = load_recovery_hashes(current_user.totp_recovery_codes)
        index = match_recovery_code(code, stored)
        if index is not None:
            # Burned here, committed below: the same code cannot be replayed.
            stored.pop(index)
            current_user.totp_recovery_codes = json.dumps(stored)
            verified = True
            used_recovery = True

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="รหัสยืนยันไม่ถูกต้อง",
        )

    await AuditService(db).log_action(
        action="STEP_UP_VERIFIED",
        user_id=current_user.id,
        details=(
            "Second factor re-entered"
            + (" with a recovery code" if used_recovery else "")
            + f"; valid for {settings.STEP_UP_TTL_SECONDS}s"
        ),
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    response = JSONResponse(
        content=ResponseModel(
            result="success",
            message="ยืนยันรหัสแล้ว",
            data={"valid_for": settings.STEP_UP_TTL_SECONDS},
        ).model_dump()
    )
    response.set_cookie(
        key="step_up",
        value=create_step_up_token(current_user.id, session_id),
        max_age=settings.STEP_UP_TTL_SECONDS,
        httponly=True,
        **COOKIE_OPTIONS,
    )
    return response


@router.get("/2fa/trusted-devices", response_model=ResponseModel)
@limiter.limit(_AUTH_LIMIT)
async def list_trusted_devices(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Browsers that may skip the second factor for this account.

    A cookie that skips 2FA for 30 days is a credential, so the owner has to be
    able to see it. Rows are filtered by the account's current salt: anything
    issued before the last password change or 2FA reset can never verify again,
    so it is hidden rather than listed as a live device. This endpoint is
    read-only — expired, revoked and stale rows are removed by the scheduled
    cleanup in ``app.services.session_cleanup``.
    """
    if not current_user.totp_enabled:
        return ResponseModel(
            result="success",
            message="การยืนยันสองขั้นตอนยังไม่เปิดใช้งาน",
            data=[],
        )

    salt = get_user_2fa_salt(current_user.hashed_password, current_user.totp_secret)
    now = utcnow()

    result = await db.execute(
        select(TrustedDevice)
        .where(
            TrustedDevice.user_id == current_user.id,
            TrustedDevice.revoked_at.is_(None),
            TrustedDevice.expires_at > now,
            TrustedDevice.salt_version == salt,
        )
        .order_by(TrustedDevice.last_used_at.desc())
    )
    devices = result.scalars().all()

    return ResponseModel(
        result="success",
        message="รายการอุปกรณ์ที่จดจำไว้",
        data=[
            {
                "id": device.id,
                "device_label": device.device_label,
                "user_agent": device.user_agent,
                "ip_address": device.ip_address,
                "created_at": utc_iso(device.created_at),
                "last_used_at": utc_iso(device.last_used_at),
                "expires_at": utc_iso(device.expires_at),
            }
            for device in devices
        ],
    )


@router.delete("/2fa/trusted-devices", response_model=ResponseModel)
@limiter.limit(_AUTH_LIMIT)
async def revoke_all_trusted_devices(
    request: Request,
    _step_up: User = Depends(require_step_up),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Forget every remembered browser at once.

    One call rather than a loop over the per-device route: with a step-up gate
    a loop would ask for the code once per row.
    """
    result = await db.execute(
        select(TrustedDevice).where(
            TrustedDevice.user_id == current_user.id,
            TrustedDevice.revoked_at.is_(None),
        )
    )
    devices = result.scalars().all()
    now = utcnow()
    for device in devices:
        device.revoked_at = now

    await AuditService(db).log_action(
        action="TRUST_DEVICE_REVOKED",
        user_id=current_user.id,
        details=f"All trusted browsers removed ({len(devices)})",
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    response = JSONResponse(
        content=ResponseModel(
            result="success",
            message=f"เพิกถอนอุปกรณ์ที่จดจำไว้ทั้งหมดแล้ว ({len(devices)})",
            data={"revoked": len(devices)},
        ).model_dump()
    )
    response.delete_cookie("trusted_device", **COOKIE_OPTIONS)
    return response


@router.delete("/2fa/trusted-devices/{device_id}", response_model=ResponseModel)
@limiter.limit(_AUTH_LIMIT)
async def revoke_trusted_device(
    request: Request,
    device_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Forget one browser: its next sign-in asks for a code again."""
    result = await db.execute(
        select(TrustedDevice).where(
            TrustedDevice.id == device_id,
            TrustedDevice.user_id == current_user.id,
        )
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="ไม่พบอุปกรณ์ที่ระบุ"
        )

    device.revoked_at = utcnow()
    await AuditService(db).log_action(
        action="TRUST_DEVICE_REVOKED",
        user_id=current_user.id,
        details=(
            "Trusted browser removed: "
            f"{device.device_label or 'unknown device'}"
        ),
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    response = JSONResponse(
        content=ResponseModel(
            result="success", message="เพิกถอนอุปกรณ์นี้แล้ว"
        ).model_dump()
    )
    # Revoking the browser you are currently using: drop the local cookie too,
    # so the next sign-in asks for a code rather than presenting a dead token.
    payload = decode_trusted_device_token(request.cookies.get("trusted_device"))
    if payload and payload.get("jti") == device.token_id:
        response.delete_cookie("trusted_device", **COOKIE_OPTIONS)
    return response
