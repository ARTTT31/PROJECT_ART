"""
User Profile Endpoints
"""

import logging
from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import get_real_client_ip, limiter
from app.core.security import decode_token, verify_password
from app.core.url_safety import UnsafeURLError, ensure_public_http_url
from app.core.utils import utcnow
from app.schemas.user import (
    ExternalNotificationDispatchRequest,
    WebPushSubscriptionRequest,
    SelfDeleteRequest,
    UserResponse,
    UserUpdate,
    UserPasswordChange,
    UserQuickLinksUpdate,
    UserMainMenuUpdate,
    UserDashboardLayoutUpdate,
    UserCameraConfigUpdate,
    ExternalNotificationsUpdate,
    ExternalNotificationTestRequest,
    WorkspaceBrandingUpdate,
    WorkspaceBrandingResponse,
    QuickNotesUpdate,
    QuickNotesResponse,
    QuickNote,
    FinanceEntry,
    FinanceUpdate,
    FinanceResponse,
    WatchlistItem,
    WatchlistUpdate,
    WatchlistResponse,
)
from app.core.quick_notes import parse_quick_notes, serialize_quick_notes
from app.core.personal_lists import (
    parse_finance_budget,
    parse_finance_entries,
    parse_finance_tombstones,
    prune_finance_tombstones,
    serialize_finance_budget,
    serialize_finance_entries,
    serialize_finance_tombstones,
    parse_watchlist,
    serialize_watchlist,
)
from app.core.brand_logo import (
    LOGO_ALLOWED_EXTENSIONS,
    LOGO_SUPPORTED_HINT,
    logo_data_url,
    normalise_logo_image,
    validate_logo_content,
)
from app.schemas.response import ResponseModel
from app.services import account_emails
from app.services.user_service import UserService, retention_days
from app.api.dependencies import (
    PROFILE_COLUMNS,
    get_current_admin_user,
    get_current_user,
    load_profile_columns,
    require_page_access,
)
from app.models.user import User

import base64
import io
import os
import warnings

from PIL import Image, ImageOps

from app.services.audit_service import AuditService
from app.models.session import UserSession

router = APIRouter()

profile_logger = logging.getLogger(__name__)

# SlowAPI "limit" strings are static decorator values, so they are built once at
# import. The limiter itself lives in app.core.rate_limit (importing it from
# app.main would create the circular import documented in that module).
_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"
_UPLOAD_LIMIT = f"{settings.RATE_LIMIT_UPLOAD_PER_MINUTE}/minute"

# Hard ceiling enforced before anything is decoded or stored. The file is read
# with a bounded ``read(MAX + 1)`` call, so an oversized upload never lands in
# memory in full.
AVATAR_MAX_BYTES = 1 * 1024 * 1024


# ── Avatar normalisation (T17/A1) ────────────────────────────────────────────
# Whatever the client uploads, what lands in the DB is a small WebP. Storing the
# raw upload meant a 1MB base64 blob (~1.3MB of text) in a column that every
# authenticated request pulled through the row; a 256x256 WebP is a few KB.
AVATAR_MAX_DIMENSION = 256
AVATAR_WEBP_QUALITY = 80
AVATAR_OUTPUT_MIME = "image/webp"
# A decompression bomb is a tiny file that expands to gigabytes in memory.
# Pillow warns above this ceiling and raises above 2x it; the warning is turned
# into an error locally (see ``_normalise_avatar_image``) so anything over the
# ceiling is refused rather than decoded.
AVATAR_MAX_PIXELS = 20_000_000
Image.MAX_IMAGE_PIXELS = AVATAR_MAX_PIXELS


# ── Avatar content validation ────────────────────────────────────────────────
# The extension check alone can be lied to (an attacker renames payload.html to
# payload.png), and the DB stores whatever arrives. Browsers rely on the CSP —
# fixing that here means we defence-in-depth: the sniffed bytes must match the
# declared type. This is deliberately a "first 12 bytes" check so it also catches
# polyglot files whose real payload begins with HTML/script text.
_AVATAR_MAGIC: dict[str, bytes] = {
    "image/jpeg": b"\xff\xd8\xff",          # JPEG — byte 3 varies per marker
    "image/png": b"\x89PNG\r\n\x1a\n",       # full signature
    "image/gif": b"GIF87a",                   # GIF87a
    "image/gif_alt": b"GIF89a",               # GIF89a
}
_ALLOWED_AVATAR_MIMES = {"image/jpeg", "image/png", "image/gif"}


def _validate_avatar_content(data: bytes, declared_mime: str) -> str:
    """Sniff the real content type from magic bytes; return the sniffed MIME.

    Raises ``HTTPException(400)`` when the bytes do not belong to an allowed
    image format or disagree with the declared content type.
    """
    sniffed: str | None = None
    if data.startswith(_AVATAR_MAGIC["image/jpeg"]):
        sniffed = "image/jpeg"
    elif data.startswith(_AVATAR_MAGIC["image/png"]):
        sniffed = "image/png"
    elif data.startswith(_AVATAR_MAGIC["image/gif"]) or data.startswith(
        _AVATAR_MAGIC["image/gif_alt"]
    ):
        sniffed = "image/gif"

    if sniffed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ GIF เท่านั้น",
        )

    if declared_mime and declared_mime not in _ALLOWED_AVATAR_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content-Type ของไฟล์ไม่อยู่ในประเภทที่รองรับ",
        )

    # A declared type is a client-supplied hint; the sniffed value wins. When
    # both exist but disagree (e.g. text/html named .png), refuse.
    if declared_mime and sniffed != declared_mime and declared_mime in _ALLOWED_AVATAR_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="เนื้อหาไฟล์ไม่ตรงกับประเภทที่ประกาศ",
        )
    return sniffed


def _normalise_avatar_image(data: bytes) -> bytes:
    """Downscale an uploaded image to a bounded WebP and return the bytes.

    ``exif_transpose`` applies the camera orientation first (otherwise a
    portrait photo is stored sideways), then the result is thumbnailed to
    ``AVATAR_MAX_DIMENSION`` and re-encoded as WebP at ``AVATAR_WEBP_QUALITY``.

    Raises ``HTTPException(400)`` with a Thai message for anything Pillow
    cannot process: corrupt/truncated payloads, and decompression bombs (the
    magic-byte sniff has already rejected every non-JPEG/PNG/GIF file).
    """
    try:
        with warnings.catch_warnings():
            # A warning here means the image is above the 20MP ceiling, which is
            # treated as a refusal rather than as a decode-worthy image.
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                image = ImageOps.exif_transpose(source)
                image = image.convert("RGB")
                image.thumbnail((AVATAR_MAX_DIMENSION, AVATAR_MAX_DIMENSION))
                buffer = io.BytesIO()
                image.save(buffer, format="WEBP", quality=AVATAR_WEBP_QUALITY)
        return buffer.getvalue()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        # The warning is raised as an error above, so a payload between the
        # ceiling and twice it lands here just like a true bomb.
        profile_logger.warning("avatar upload refused: image exceeds the pixel ceiling")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รูปภาพมีขนาดพิกเซลใหญ่เกินไป กรุณาใช้รูปภาพที่เล็กลง",
        )
    except HTTPException:
        raise
    except Exception:
        # Pillow raises a broad family of errors for malformed files
        # (UnidentifiedImageError, OSError, ValueError, the bomb warning above).
        profile_logger.warning("avatar image could not be decoded", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถประมวลผลไฟล์รูปภาพได้ กรุณาใช้ไฟล์ JPEG, PNG หรือ GIF ที่ถูกต้อง",
        )


@router.get("/me", response_model=UserResponse)
@limiter.limit(_GENERAL_LIMIT)
async def get_my_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user profile

    The authentication lookup defers the large profile columns (avatar, quick
    links, dashboard layout, camera config), so they are re-selected here — this
    endpoint is exactly the one that serves them.
    """
    return await load_profile_columns(db, current_user)


@router.put("/me", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def update_my_profile(
    user_update: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update current user profile
    """
    user_service = UserService(db)

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        email_changed = bool(
            user_update.email
            and user_update.email.lower() != (current_user.email or "").lower()
        )
        updated_user = await user_service.update_user(current_user.id, user_update)

        # The new mailbox has not proved ownership yet; send the verification
        # link after the update so the account cannot silently reset a password
        # through an address it never confirmed.
        if email_changed:
            await account_emails.send_verification_email(db, updated_user)

        await audit_service.log_action(
            action="PROFILE_UPDATE",
            user_id=current_user.id,
            details=(
                f"Updated profile fields: "
                f"{', '.join([k for k, v in user_update.model_dump(exclude_unset=True).items() if v is not None])}"
            ),
            ip_address=client_ip,
            user_agent=user_agent,
        )

        # AuditService.log_action() only adds to the session — the endpoint owns
        # the commit. Without it the audit INSERT is rolled back with the
        # request-scoped session (the profile fields above are committed inside
        # user_service.update_user, but the audit row added afterwards is not).
        await db.commit()

        return ResponseModel(
            result="success",
            message="อัปเดตโปรไฟล์สำเร็จ",
            data={
                "user_id": updated_user.id,
                "email": updated_user.email,
                "name": updated_user.name,
            },
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/change-password", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def change_password(
    password_change: UserPasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Change current user password
    """
    user_service = UserService(db)

    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        success = await user_service.change_password(
            user_id=current_user.id,
            old_password=password_change.old_password,
            new_password=password_change.new_password,
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="รหัสผ่านเดิมไม่ถูกต้อง",
            )

        # A password change must evict every other device. Keep this tab's
        # session (its access token carries the same sid) so the user is not
        # logged out of the screen that just confirmed the change.
        access_payload = decode_token(request.cookies.get("access_token") or "")
        current_session_id = (
            access_payload.get("sid")
            if access_payload and access_payload.get("type") == "access"
            else None
        )
        revoked = await user_service.revoke_sessions(
            current_user.id, except_session_id=current_session_id
        )

        await audit_service.log_action(
            action="PASSWORD_CHANGE",
            user_id=current_user.id,
            details=f"User changed password; {revoked} other session(s) revoked",
            ip_address=client_ip,
            user_agent=user_agent,
        )

        # Commit the audit row (log_action only adds — see AuditService).
        await db.commit()

        return ResponseModel(
            result="success",
            message="เปลี่ยนรหัสผ่านสำเร็จ",
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/upload-avatar", response_model=ResponseModel)
@limiter.limit(_UPLOAD_LIMIT)
async def upload_avatar_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload user avatar and store as a normalised WebP (Base64) in Database
    """
    # 1. Check file extension
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".gif"]:
        raise HTTPException(
            status_code=400, detail="รองรับเฉพาะไฟล์รูปภาพ (jpg, jpeg, png, gif)"
        )

    try:
        # 2. Bounded read: one byte past the cap is enough to reject an oversized
        #    upload — reading the whole body first let a caller stream megabytes
        #    into memory before the size check ran.
        contents = await file.read(AVATAR_MAX_BYTES + 1)
        if len(contents) > AVATAR_MAX_BYTES:
            raise HTTPException(status_code=400, detail="ขนาดไฟล์รูปภาพห้ามเกิน 1MB")

        # 3. Sniff magic bytes — never trust the client filename/content-type
        _validate_avatar_content(
            contents, (file.content_type or "").split(";")[0].strip().lower()
        )

        # 4. Normalise (bounded size, metadata stripped) and store as WebP.
        #    The stored type is always the OUTPUT type — never the client's.
        normalised = _normalise_avatar_image(contents)
        base64_data = base64.b64encode(normalised).decode("utf-8")
        avatar_base64 = f"data:{AVATAR_OUTPUT_MIME};base64,{base64_data}"

        # 5. Save to Database (Async Service Call)
        user_service = UserService(db)
        await user_service.update_avatar(current_user.id, avatar_base64)

        # 6. Log audit trail (Sync Service Call)
        # get_real_client_ip only believes X-Forwarded-For behind a trusted proxy;
        # reading the header directly let any caller write a forged IP into the
        # audit log.
        client_ip = get_real_client_ip(request)
        user_agent = request.headers.get("user-agent")

        audit_service = AuditService(db)
        await audit_service.log_action(
            action="AVATAR_UPLOAD",
            user_id=current_user.id,
            details="User successfully uploaded and stored avatar image in database",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()

        return ResponseModel(
            result="success",
            message="อัปเดตรูปโปรไฟล์สำเร็จ (เก็บข้อมูลบนระบบคลาวด์แล้ว)",
        )
    except HTTPException as he:
        raise he
    except Exception:
        profile_logger.exception("avatar upload failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ไม่สามารถอัปโหลดไฟล์ได้ กรุณาลองอีกครั้งภายหลัง",
        )


@router.post("/quick-links", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def update_quick_links(
    request: Request,
    quick_links_update: UserQuickLinksUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update user quick links (JSON string)
    """
    user_service = UserService(db)

    try:
        # The validator lives on the server: the dialog's checks are a
        # convenience, not the boundary.
        cleaned = await user_service.update_quick_links(
            current_user.id, quick_links_update.quick_links
        )

        # Personal shortcuts are still workspace data: an admin reading the
        # audit trail can see when an account's shortcut list changed size.
        await AuditService(db).log_action(
            action="UPDATE_QUICK_LINKS",
            user_id=current_user.id,
            details=f"บันทึกควิกลิ้งค์ {len(cleaned)} รายการ",
            ip_address=get_real_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()

        return ResponseModel(
            result="success",
            message="อัปเดต Quick Links สำเร็จ",
        )

    except Exception:
        # Generic body: exception text may leak internals (connection strings,
        # library paths) — the full context is in the server log below (T15).
        profile_logger.exception("profile persistence error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )


@router.post("/main-menu", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def update_main_menu(
    request: Request,
    menu_update: UserMainMenuUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save this account's sidebar order and page visibility (JSON string).

    Without this the menu lived in localStorage, so arranging it on a laptop
    never reached the phone the same person signs in from.
    """
    user_service = UserService(db)

    try:
        await user_service.update_main_menu(current_user.id, menu_update.main_menu)

        return ResponseModel(result="success", message="บันทึกเมนูหลักสำเร็จ")

    except Exception:
        profile_logger.exception("profile persistence error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )


@router.post("/dashboard-layout", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def update_dashboard_layout(
    request: Request,
    layout_update: UserDashboardLayoutUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update user dashboard layout preferences (JSON string)
    """
    user_service = UserService(db)

    try:
        await user_service.update_dashboard_layout(
            current_user.id, layout_update.dashboard_layout
        )

        return ResponseModel(
            result="success",
            message="บันทึกการจัดวางหน้าแดชบอร์ดสำเร็จ",
        )

    except Exception:
        # Generic body: exception text may leak internals (connection strings,
        # library paths) — the full context is in the server log below (T15).
        profile_logger.exception("profile persistence error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )


@router.post("/camera-config", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def update_camera_config(
    request: Request,
    camera_update: UserCameraConfigUpdate,
    current_user: User = Depends(require_page_access("camera")),
    db: AsyncSession = Depends(get_db),
):
    """
    Update user camera streams configuration (JSON string)

    Gated on the ``camera`` page: the sidebar only *hides* the page, so a user
    who never received that page could still write camera settings by calling
    this endpoint directly.
    """
    user_service = UserService(db)

    try:
        await user_service.update_camera_config(
            current_user.id, camera_update.camera_config
        )

        return ResponseModel(
            result="success",
            message="บันทึกการตั้งค่ากล้องวงจรปิดสำเร็จ",
        )

    except Exception:
        # Generic body: exception text may leak internals (connection strings,
        # library paths) — the full context is in the server log below (T15).
        profile_logger.exception("profile persistence error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )


@router.get("/sessions", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def get_my_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get user session log history
    """

    try:
        result = await db.execute(
            select(UserSession)
            .filter(UserSession.user_id == current_user.id)
            .order_by(UserSession.created_at.desc())
            .limit(10)
        )
        sessions = result.scalars().all()

        session_data = [
            {
                "id": s.id,
                "session_id": s.session_id,
                "device_label": s.device_label or "Unknown Device",
                "user_agent": s.user_agent or None,
                "ip_address": s.ip_address or "Unknown IP",
                "is_active": s.is_active,
                "last_activity": s.last_activity.isoformat()
                if s.last_activity
                else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sessions
        ]

        return ResponseModel(
            result="success",
            message="ดึงประวัติการเข้าใช้งานสำเร็จ",
            data=session_data,
        )
    except Exception:
        # Generic body: exception text may leak internals (connection strings,
        # library paths) — the full context is in the server log below (T15).
        profile_logger.exception("profile persistence error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )


@router.delete("/sessions/{session_id}", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def revoke_session(
    request: Request,
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Revoke/delete a user session
    """

    try:
        result = await db.execute(
            select(UserSession).filter(
                UserSession.session_id == session_id,
                UserSession.user_id == current_user.id,
            )
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="ไม่พบประวัติเซสชันที่ระบุ"
            )

        session.is_active = False
        await db.commit()

        return ResponseModel(result="success", message="ออกจากระบบจากอุปกรณ์ที่เลือกสำเร็จ")
    except HTTPException as he:
        raise he
    except Exception:
        # Generic body: exception text may leak internals (connection strings,
        # library paths) — the full context is in the server log below (T15).
        profile_logger.exception("profile persistence error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )


@router.get("/export", response_model=None)
@limiter.limit(_GENERAL_LIMIT)
async def export_my_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    PDPA right of access (Admin not required): a machine-readable copy of
    everything held about the caller.

    Built from the caller's own rows only — profile, preferences and sessions.
    The audit log is deliberately NOT included: admin entries quote other
    people's data, and copying that into one user's export would be a leak.
    """
    await load_profile_columns(db, current_user, *PROFILE_COLUMNS)

    sessions_result = await db.execute(
        select(UserSession).where(UserSession.user_id == current_user.id)
    )
    sessions = sessions_result.scalars().all()

    def _stamp(value):
        return value.isoformat() if value is not None else None

    payload = {
        "exported_at": utcnow().isoformat(),
        "account": {
            "id": current_user.id,
            "email": current_user.email,
            "username": current_user.username,
            "name": current_user.name,
            "display_name": current_user.display_name,
            "role": current_user.role,
            "is_active": current_user.is_active,
            "created_at": _stamp(current_user.created_at),
            "last_login": _stamp(current_user.last_login),
            "email_verified_at": _stamp(current_user.email_verified_at),
        },
        "profile": {
            "avatar": getattr(current_user, "avatar", None),
            "quick_links": getattr(current_user, "quick_links", None),
            "main_menu": getattr(current_user, "main_menu", None),
            "dashboard_layout": getattr(current_user, "dashboard_layout", None),
            "camera_config": getattr(current_user, "camera_config", None),
            "accessible_pages": current_user.accessible_pages,
        },
        "sessions": [
            {
                "session_id": s.session_id,
                "device_label": s.device_label,
                "user_agent": s.user_agent,
                "ip_address": s.ip_address,
                "is_active": s.is_active,
                "created_at": _stamp(s.created_at),
                "last_activity": _stamp(s.last_activity),
            }
            for s in sessions
        ],
    }

    response = JSONResponse(content=payload)
    response.headers["Content-Disposition"] = (
        f'attachment; filename="art-workspace-export-{current_user.id}.json"'
    )
    return response


@router.delete("/me", response_model=ResponseModel)
@limiter.limit(_GENERAL_LIMIT)
async def delete_my_account(
    request: Request,
    payload: SelfDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    PDPA right to erasure: move your own account to the trash.

    The row is soft-deleted inside the same retention window the admin trash
    uses, so an admin can still restore it and ``audit_logs.user_id`` stays
    resolvable; the scheduled purge removes it for good afterwards. The
    password is required again so a stolen session alone cannot erase an
    account, and the last usable admin cannot delete themselves.
    """
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="รหัสผ่านไม่ถูกต้อง"
        )

    user_service = UserService(db)
    if (
        current_user.role == "admin"
        and await user_service.count_active_admins(exclude_user_id=current_user.id) == 0
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 บัญชี — "
                "บัญชีนี้เป็นผู้ดูแลระบบคนสุดท้าย จึงลบไม่ได้"
            ),
        )

    deleted = await user_service.soft_delete_user(current_user.id)
    if deleted is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่พบบัญชีที่ใช้งานได้สำหรับการลบ",
        )

    await AuditService(db).log_action(
        action="USER_SELF_DELETE",
        user_id=current_user.id,
        details=(
            "User deleted their own account "
            f"(restorable for {retention_days()} days before purge)"
        ),
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    response = JSONResponse(
        content={"result": "success", "message": "ลบบัญชีของคุณแล้ว ขอบคุณที่ใช้งาน"}
    )
    # ``dict[str, Any]`` (not the inferred union) so the splat matches
    # delete_cookie's typed parameters under mypy.
    cookie_opts: dict[str, Any] = {
        "secure": settings.COOKIE_SECURE,
        "samesite": settings.COOKIE_SAMESITE_EFFECTIVE,
        "path": "/",
    }
    for cookie_name in ("access_token", "refresh_token", "user", "csrf_token"):
        response.delete_cookie(cookie_name, **cookie_opts)
    return response


# ── Per-user workspace branding ──────────────────────────────────────────────
# The workspace name/tagline/logo used to be one global setting an admin owned.
# Each account can now personalise its own sidebar; an empty value means "use
# the workspace-wide branding", which is what an account that never touched
# these fields keeps (the columns are NULL).


def _workspace_branding_response(user: User) -> WorkspaceBrandingResponse:
    return WorkspaceBrandingResponse(
        workspace_name=user.workspace_name or "",
        workspace_tagline=user.workspace_tagline or "",
        workspace_logo=user.workspace_logo or "",
    )


@router.get("/workspace-branding", response_model=WorkspaceBrandingResponse)
@limiter.limit(_GENERAL_LIMIT)
async def get_workspace_branding(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The current account's own workspace name / tagline / logo overrides."""
    # ``workspace_logo`` is a deferred payload column (see PROFILE_COLUMNS), so
    # it is re-selected here just like the avatar.
    user = await load_profile_columns(db, current_user, "workspace_logo")
    return _workspace_branding_response(user)


@router.put("/workspace-branding", response_model=WorkspaceBrandingResponse)
@limiter.limit(_GENERAL_LIMIT)
async def update_workspace_branding(
    payload: WorkspaceBrandingUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Personalise the workspace name / tagline shown to this account.

    Only the fields present in the request are touched, and an empty string
    clears the override instead of storing an empty name.
    """
    # ``workspace_logo`` is deferred on auth lookups; the response always reads
    # it, even when this request only changes the name or tagline.
    await load_profile_columns(db, current_user, "workspace_logo")
    supplied = payload.model_fields_set
    if "workspace_name" in supplied:
        current_user.workspace_name = (payload.workspace_name or "").strip() or None
    if "workspace_tagline" in supplied:
        current_user.workspace_tagline = (payload.workspace_tagline or "").strip() or None
    if "workspace_logo" in supplied:
        current_user.workspace_logo = (payload.workspace_logo or "").strip() or None

    await db.commit()
    return _workspace_branding_response(current_user)


@router.post("/workspace-branding/logo", response_model=WorkspaceBrandingResponse)
@limiter.limit(_UPLOAD_LIMIT)
async def upload_workspace_logo(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload this account's own workspace logo.

    Same guarantees as the global logo: bounded size, magic-byte sniffing, then
    a downscale/re-encode to a square WebP data URL.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in LOGO_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LOGO_SUPPORTED_HINT,
        )

    contents = await file.read(AVATAR_MAX_BYTES + 1)
    if len(contents) > AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ขนาดไฟล์รูปภาพห้ามเกิน 1MB",
        )

    validate_logo_content(
        contents, (file.content_type or "").split(";")[0].strip().lower()
    )
    current_user.workspace_logo = logo_data_url(normalise_logo_image(contents))

    await AuditService(db).log_action(
        action="UPLOAD_WORKSPACE_LOGO",
        user_id=current_user.id,
        details="User uploaded their own workspace logo",
        ip_address=get_real_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    return _workspace_branding_response(current_user)


# ── Quick notes / to-do widget ───────────────────────────────────────────────
# One list per account, stored as a JSON array in ``users.quick_notes``. The
# widget always sends the whole list back, which keeps the endpoint free of
# per-item ordering and merge rules: last save wins, for that account only.


def _quick_notes_response(raw: str | None) -> QuickNotesResponse:
    """Parse the stored JSON into the response model (bad entries dropped)."""
    return QuickNotesResponse(notes=[QuickNote(**note) for note in parse_quick_notes(raw)])


@router.get("/quick-notes", response_model=QuickNotesResponse)
@limiter.limit(_GENERAL_LIMIT)
async def get_quick_notes(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The signed-in account's quick notes (empty when never used)."""
    # Deferred payload column: re-select it like the avatar before reading.
    user = await load_profile_columns(db, current_user, "quick_notes")
    return _quick_notes_response(user.quick_notes)


@router.put("/quick-notes", response_model=QuickNotesResponse)
@limiter.limit(_GENERAL_LIMIT)
async def update_quick_notes(
    request: Request,
    payload: QuickNotesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the account's quick notes with the list in the request."""
    saved_notes = serialize_quick_notes(payload.notes)
    current_user.quick_notes = saved_notes
    await db.commit()
    # ``quick_notes`` is deferred on auth lookups and commit expires ORM fields.
    # Use the value we just persisted rather than triggering an async lazy load
    # while building the response (which raises MissingGreenlet).
    return _quick_notes_response(saved_notes)


# ── Finance widget (income / expense) ────────────────────────────────────────
# Same contract as the notes widget: the list lives in one JSON-as-text column
# and the widget always saves its whole state, so last write wins per account.


def _finance_response(
    raw: str | None, budget_raw: str | None = None, deleted_raw: str | None = None
) -> FinanceResponse:
    deleted = prune_finance_tombstones(parse_finance_tombstones(deleted_raw), now=_now_seconds())
    return FinanceResponse(
        entries=[FinanceEntry(**entry) for entry in parse_finance_entries(raw)],
        budget=parse_finance_budget(budget_raw),
        deleted_ids=list(deleted) or None,
    )


def _now_seconds() -> int:
    """Unix seconds for the deletion stamps (kept tiny in the JSON column)."""
    return int(datetime.now(timezone.utc).timestamp())


# ``exclude_none`` keeps the payload identical to what it was before categories
# and budgets existed: an entry with no category has no ``category`` key at all,
# and an unset budget is omitted rather than sent as ``null``.
@router.get("/finance", response_model=FinanceResponse, response_model_exclude_none=True)
@limiter.limit(_GENERAL_LIMIT)
async def get_finance_entries(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The signed-in account's income/expense entries (empty when never used)."""
    user = await load_profile_columns(
        db, current_user, "finance_entries", "finance_budget", "finance_deleted"
    )
    return _finance_response(
        user.finance_entries, user.finance_budget, user.finance_deleted
    )


@router.put("/finance", response_model=FinanceResponse, response_model_exclude_none=True)
@limiter.limit(_GENERAL_LIMIT)
async def update_finance_entries(
    request: Request,
    payload: FinanceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the account's entries (and budget) with the request body.

    Ids the caller reports as deleted become tombstones, and an id that is
    present in ``entries`` clears its tombstone — re-adding a row on purpose
    (an undo) must win over the old deletion.
    """
    saved = serialize_finance_entries(payload.entries)
    saved_budget = serialize_finance_budget(payload.budget)

    now = _now_seconds()
    tombstones = parse_finance_tombstones(current_user.finance_deleted)
    kept_ids = {entry.id for entry in payload.entries}
    for deleted_id in payload.deleted_ids:
        if deleted_id not in kept_ids:
            tombstones[deleted_id] = now
    for kept_id in kept_ids:
        tombstones.pop(kept_id, None)
    saved_deleted = serialize_finance_tombstones(
        prune_finance_tombstones(tombstones, now=now)
    )

    current_user.finance_entries = saved
    current_user.finance_budget = saved_budget
    current_user.finance_deleted = saved_deleted
    await db.commit()
    # Commit expires ORM attributes; answer from the values just persisted so
    # building the response cannot trigger an async lazy load.
    return _finance_response(saved, saved_budget, saved_deleted)


# ── Watchlist widget ─────────────────────────────────────────────────────────


def _watchlist_response(raw: str | None) -> WatchlistResponse:
    return WatchlistResponse(
        symbols=[WatchlistItem(**item) for item in parse_watchlist(raw)]
    )


@router.get("/watchlist", response_model=WatchlistResponse)
@limiter.limit(_GENERAL_LIMIT)
async def get_watchlist(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Symbols this account follows in the watchlist widget."""
    user = await load_profile_columns(db, current_user, "watchlist")
    return _watchlist_response(user.watchlist)


@router.put("/watchlist", response_model=WatchlistResponse)
@limiter.limit(_GENERAL_LIMIT)
async def update_watchlist(
    request: Request,
    payload: WatchlistUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Replace the followed symbols with the list in the request."""
    saved = serialize_watchlist(payload.symbols)
    current_user.watchlist = saved
    await db.commit()
    return _watchlist_response(saved)


@router.get("/external-notifications")
@limiter.limit(_GENERAL_LIMIT)
async def get_external_notifications(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    import json
    raw = getattr(current_user, "external_notifications", None)
    try:
        data = json.loads(raw) if raw else {}
    except Exception:
        data = {}
    events = data.get("events") or {}
    return {
        "result": "success",
        "data": {
            "line_token": data.get("line_token", ""),
            "line_webhook_url": data.get("line_webhook_url", ""),
            "telegram_bot_token": data.get("telegram_bot_token", ""),
            "telegram_chat_id": data.get("telegram_chat_id", ""),
            "webhook_url": data.get("webhook_url", ""),
            "events": {
                "oil_alert": bool(events.get("oil_alert", data.get("oil_alert", True))),
                "market_alert": bool(events.get("market_alert", data.get("market_alert", True))),
                "daily_summary": bool(events.get("daily_summary", data.get("daily_summary", True))),
            },
        },
    }


@router.patch("/external-notifications")
@limiter.limit(_GENERAL_LIMIT)
async def update_external_notifications(
    request: Request,
    payload: ExternalNotificationsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json
    # This column is shared with the daily-briefing settings. Writing a fresh
    # object (the previous behaviour) deleted "daily_briefing" every time a user
    # saved their channels, so the two settings now merge instead of replacing.
    try:
        data = json.loads(current_user.external_notifications or "{}")
    except Exception:
        data = {}
    if not isinstance(data, dict):
        data = {}

    supplied = payload.model_fields_set
    for field in (
        "line_token",
        "line_webhook_url",
        "telegram_bot_token",
        "telegram_chat_id",
        "webhook_url",
    ):
        if field in supplied:
            data[field] = getattr(payload, field) or ""

    event_keys = ("oil_alert", "market_alert", "daily_summary")
    incoming_events = payload.events if payload.events is not None else {}
    if payload.events is not None or supplied.intersection(event_keys):
        events = dict(data.get("events") or {})
        if payload.events is not None:
            events.update({k: bool(v) for k, v in incoming_events.items() if k in event_keys})
        for key in event_keys:
            if key in supplied:
                events[key] = bool(getattr(payload, key))
        data["events"] = events

    current_user.external_notifications = json.dumps(data, ensure_ascii=False)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return {
        "result": "success",
        "message": "บันทึกการตั้งค่าการแจ้งเตือนภายนอกเรียบร้อยแล้ว",
        "data": data,
    }


class DailyBriefingUpdate(BaseModel):
    enabled: bool = False
    time: str = "07:30"
    topics: dict[str, bool] = Field(default_factory=dict)


@router.get("/daily-briefing")
@limiter.limit(_GENERAL_LIMIT)
async def get_daily_briefing_settings(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    from app.services.daily_briefing_service import get_user_briefing_config
    return {
        "result": "success",
        "data": get_user_briefing_config(current_user),
    }


@router.put("/daily-briefing")
@limiter.limit(_GENERAL_LIMIT)
async def update_daily_briefing_settings(
    request: Request,
    payload: DailyBriefingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.daily_briefing_service import set_user_briefing_config, get_user_briefing_config
    set_user_briefing_config(current_user, payload.model_dump())
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return {
        "result": "success",
        "message": "บันทึกการตั้งค่าสรุปประจำวันเรียบร้อยแล้ว",
        "data": get_user_briefing_config(current_user),
    }


@router.post("/daily-briefing/test")
@limiter.limit(_GENERAL_LIMIT)
async def test_daily_briefing(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.daily_briefing_service import dispatch_user_briefing
    try:
        result = await dispatch_user_briefing(db, current_user, is_test=True)
        return {
            "result": "success",
            "message": "ส่งสรุปประจำวันทดสอบเรียบร้อยแล้ว",
            "data": result,
        }
    except Exception as exc:
        # Exception text can quote connection strings or library internals; the
        # full context stays in the server log.
        profile_logger.exception("Error dispatching test daily briefing: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "result": "error",
                "message": "ไม่สามารถส่งการแจ้งเตือนได้ กรุณาลองอีกครั้งภายหลัง",
            },
        )


@router.post("/external-notifications/test")
@limiter.limit(_GENERAL_LIMIT)
async def test_external_notification(
    request: Request,
    payload: ExternalNotificationTestRequest,
    current_user: User = Depends(get_current_user),
):
    import httpx
    channel = payload.channel
    user_name = current_user.display_name or current_user.username or "ผู้ใช้งาน"
    test_msg = f"🔔 [ART Workspace] ทดสอบการแจ้งเตือนสำหรับคุณ {user_name} สำเร็จเรียบร้อยแล้ว!"

    try:
        # Redirects stay off: the SSRF check below resolves the host before the
        # request, and a redirect could point it back at an internal address.
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            if channel == "line":
                token = (payload.line_token or "").strip()
                if not token:
                    raise HTTPException(status_code=400, detail="กรุณาระบุ LINE Token")
                if token.startswith("http://") or token.startswith("https://"):
                    safe_url = await ensure_public_http_url(token)
                    res = await client.post(safe_url, json={"message": test_msg})
                else:
                    res = await client.post(
                        "https://notify-api.line.me/api/notify",
                        headers={"Authorization": f"Bearer {token}"},
                        data={"message": test_msg},
                    )
                if res.status_code not in (200, 204):
                    err = f"LINE API ตอบกลับสถานะ {res.status_code}"
                    return JSONResponse(status_code=400, content={"result": "error", "message": err})

            elif channel == "telegram":
                bot_token = (payload.telegram_bot_token or "").strip()
                chat_id = (payload.telegram_chat_id or "").strip()
                if not bot_token or not chat_id:
                    raise HTTPException(status_code=400, detail="กรุณาระบุ Telegram Bot Token และ Chat ID")
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                res = await client.post(url, json={"chat_id": chat_id, "text": test_msg})
                if res.status_code not in (200, 204):
                    err = f"Telegram API ตอบกลับสถานะ {res.status_code}"
                    return JSONResponse(status_code=400, content={"result": "error", "message": err})

            elif channel == "webhook":
                webhook_url = (payload.webhook_url or "").strip()
                if not webhook_url or not (webhook_url.startswith("http://") or webhook_url.startswith("https://")):
                    raise HTTPException(status_code=400, detail="กรุณาระบุ Webhook URL ที่ถูกต้อง")
                safe_url = await ensure_public_http_url(webhook_url)
                res = await client.post(safe_url, json={"content": test_msg, "text": test_msg})
                if res.status_code not in (200, 204):
                    err = f"Webhook ตอบกลับสถานะ {res.status_code}"
                    return JSONResponse(status_code=400, content={"result": "error", "message": err})

        return {"result": "success", "message": f"ส่งข้อความทดสอบไปยัง {channel.upper()} สำเร็จแล้ว!"}

    except HTTPException:
        raise
    except UnsafeURLError as e:
        return JSONResponse(status_code=400, content={"result": "error", "message": str(e)})
    except Exception as e:
        err = f"ส่งข้อความทดสอบไม่สำเร็จ: {str(e)[:100]}"
        return JSONResponse(status_code=400, content={"result": "error", "message": err})


@router.post("/external-notifications/dispatch")
@limiter.limit(_GENERAL_LIMIT)
async def dispatch_external_notification(
    request: Request,
    payload: ExternalNotificationDispatchRequest,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.notification_dispatcher import dispatch_event_notifications
    count = await dispatch_event_notifications(db, payload.event_type, payload.message)
    return {"result": "success", "sent_count": count}


@router.get("/web-push/vapid-key")
@limiter.limit(_GENERAL_LIMIT)
async def get_web_push_vapid_key(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.web_push_service import ensure_persistent_vapid_keys
    _, pub_key = await ensure_persistent_vapid_keys(db)
    return {"result": "success", "public_key": pub_key}


@router.get("/web-push")
@limiter.limit(_GENERAL_LIMIT)
async def get_web_push_subscription(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    raw = getattr(current_user, "web_push_subscription", None)
    has_sub = bool(raw and raw.strip())
    return {"result": "success", "has_subscription": has_sub}


@router.post("/web-push")
@limiter.limit(_GENERAL_LIMIT)
async def save_web_push_subscription(
    request: Request,
    payload: WebPushSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json
    endpoint = (payload.endpoint or "").strip()
    keys = payload.keys or {}
    if not endpoint.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Push endpoint ไม่ถูกต้อง",
        )
    if not (keys.get("p256dh") and keys.get("auth")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ข้อมูลกุญแจของ push subscription ไม่ครบถ้วน",
        )

    # One browser per row used to be overwritten by the next device. Keep a
    # bounded list so a phone and a laptop can both receive notifications.
    existing: list[dict[str, Any]] = []
    if current_user.web_push_subscription:
        try:
            parsed = json.loads(current_user.web_push_subscription)
            existing = parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            existing = []
    remaining = [sub for sub in existing if sub.get("endpoint") != endpoint]
    remaining.append({"endpoint": endpoint, "keys": keys})
    current_user.web_push_subscription = json.dumps(remaining[-5:], ensure_ascii=False)
    db.add(current_user)
    await db.commit()
    return {"result": "success", "message": "บันทึกการสมัครรับแจ้งเตือนเบราว์เซอร์สำเร็จ"}


@router.delete("/web-push")
@limiter.limit(_GENERAL_LIMIT)
async def remove_web_push_subscription(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.web_push_subscription = None
    db.add(current_user)
    await db.commit()
    return {"result": "success", "message": "ยกเลิกการรับแจ้งเตือนเบราว์เซอร์สำเร็จ"}


@router.post("/web-push/test")
@limiter.limit(_GENERAL_LIMIT)
async def test_web_push(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.web_push_service import send_web_push_to_user

    user_name = current_user.display_name or current_user.username or "ผู้ใช้"
    title = "ART Workspace"
    body = f"ทดสอบการแจ้งเตือนสำหรับคุณ {user_name} สำเร็จ!"
    url = "/dashboard"

    sent = await send_web_push_to_user(
        db=db,
        user=current_user,
        title=title,
        body=body,
        url=url,
    )

    return {
        "result": "success",
        "message": "ส่งข้อความทดสอบแจ้งเตือนบนเบราว์เซอร์เรียบร้อยแล้ว",
        "sent_via_push_service": sent,
        "notification": {
            "title": title,
            "body": body,
            "url": url,
        },
    }
