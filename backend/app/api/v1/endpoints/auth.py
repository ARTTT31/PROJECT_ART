"""
Authentication Endpoints
"""

import logging
import os
import secrets
import uuid
from datetime import timedelta
from typing import Any, List, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# Lazy imports for google-auth (optional dependency — may not be installed yet)
try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    _GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    google_id_token = None  # type: ignore[assignment]
    google_requests = None  # type: ignore[assignment]
    _GOOGLE_AUTH_AVAILABLE = False
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.utils import encode_user_cookie, user_cookie_payload, utcnow as utils_utcnow
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    new_refresh_jti,
)
from app.api.dependencies import load_profile_columns, resolve_user_from_token
from app.models.session import UserSession
from app.schemas.response import ResponseModel
from app.schemas.user import UserCreate, UserLogin, UserRegister
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.services.user_service import UserService

router = APIRouter()
logger = logging.getLogger(__name__)


async def _create_user_session(
    db: AsyncSession,
    user: Any,
    ip_address: Optional[str],
    user_agent: Optional[str],
    refresh_jti: str,
) -> str:
    """Create an active UserSession row and return its id.

    Google logins previously skipped session creation entirely, so their
    refresh tokens had no ``sid`` and logout could not revoke them. Normal
    password logins do the same via AuthService.login.

    ``refresh_jti`` is recorded on the row so the refresh token issued with it
    is the one this session accepts (rotation/reuse detection, T19).
    """
    session_id = str(uuid.uuid4())
    db.add(
        UserSession(
            session_id=session_id,
            user_id=user.id,
            user_agent=user_agent,
            ip_address=ip_address,
            refresh_jti=refresh_jti,
            expires_at=utils_utcnow() + timedelta(days=7),
        )
    )
    await db.commit()
    return session_id


COOKIE_OPTIONS: dict[str, Any] = {
    "secure": settings.COOKIE_SECURE,
    # Effective value: browsers reject `SameSite=None` without `Secure`, so a
    # non-HTTPS environment is downgraded to `lax` instead of losing the cookie.
    "samesite": settings.COOKIE_SAMESITE_EFFECTIVE,
    "path": "/",
}

# Convenience rate-limit strings — pulled from config but evaluated once at import.
# SlowAPI "limit" strings are static decorator values, so we build them up-front.
_AUTH_LIMIT = f"{settings.RATE_LIMIT_AUTH_PER_MINUTE}/minute"
_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"

# ── Self-registration policy (REGISTRATION_MODE) ─────────────────────────
# Defined once so the API, the login page and the audit trail all describe the
# same rule with the same words.
_REGISTRATION_CLOSED_MESSAGE = (
    "ระบบปิดรับสมัครสมาชิกใหม่ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งาน"
)
_REGISTRATION_PENDING_MESSAGE = (
    "ส่งคำขอสมัครแล้ว — บัญชีจะใช้งานได้หลังผู้ดูแลระบบอนุมัติ"
)
_SIGNIN_PENDING_MESSAGE = "บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ"
_SIGNIN_REJECTED_MESSAGE = "คำขอสมัครบัญชีนี้ถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ"


@router.get("/csrf")
async def get_csrf_token(request: Request):
    """Issue (or echo) the CSRF token used for double-submit validation.

    The token lives in a readable ``csrf_token`` cookie so the backend can compare
    it against the ``X-CSRF-Token`` header. The cookie cannot always be read by
    the browser (cross-site deployments), so the same value is returned in the
    body and cached by the client.
    """
    token = request.cookies.get("csrf_token") or secrets.token_urlsafe(32)
    response = JSONResponse(
        content={"result": "success", "data": {"csrf_token": token}}
    )
    response.set_cookie(
        key="csrf_token",
        value=token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=False,
        **COOKIE_OPTIONS,
    )
    return response


@router.get("/registration-mode")
@limiter.limit(_GENERAL_LIMIT)
async def get_registration_mode(request: Request):
    """Report how this deployment handles sign-ups.

    Public on purpose: the login page has to know whether to offer a sign-up
    form, and whether to promise immediate access or an admin's approval. It
    exposes the policy, never any data.
    """
    return {
        "result": "success",
        "data": {"registration_mode": settings.REGISTRATION_MODE},
    }


@router.post("/login", response_model=ResponseModel)
@limiter.limit(_AUTH_LIMIT)
async def login(
    request: Request,
    user_login: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """
    Login endpoint

    Returns JWT access token and refresh token
    """
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    # Get client IP & User Agent
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        result = await auth_service.login(
            email=user_login.email,
            password=user_login.password,
            session_id=user_login.session_id,
            user_agent=user_login.user_agent,
            device_label=user_login.device_label,
            ip_address=client_ip,
        )

        # Log success (committed by auth_service.login)
        await audit_service.log_action(
            action="LOGIN_SUCCESS",
            user_id=result["user"]["id"],
            details=f"User logged in using {user_login.device_label or 'unknown device'}",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()

        # 🛡️ SECURITY: Set tokens as HTTP-only cookies (mitigating XSS token theft)
        # We exclude tokens from the JSON response body.
        response_data = {"session_id": result["session_id"], "user": result["user"]}

        resp = ResponseModel(
            result="success",
            message="เข้าสู่ระบบสำเร็จ",
            data=response_data,
        )
        from fastapi.responses import JSONResponse

        response = JSONResponse(content=resp.model_dump())

        # Cookie attributes are environment-configurable for production HTTPS and local HTTP.
        response.set_cookie(
            key="access_token",
            value=result["access_token"],
            max_age=30 * 60,
            httponly=True,
            **COOKIE_OPTIONS,
        )
        response.set_cookie(
            key="refresh_token",
            value=result["refresh_token"],
            max_age=7 * 24 * 60 * 60,
            httponly=True,
            **COOKIE_OPTIONS,
        )
        # Non-httpOnly user data cookie (read by frontend for quick display/hydration).
        # Percent-encoded: a raw json.dumps value gets quoted/escaped by the cookie
        # serialiser into a shape document.cookie readers cannot parse.
        response.set_cookie(
            key="user",
            value=encode_user_cookie(user_cookie_payload(response_data["user"])),
            max_age=7 * 24 * 60 * 60,
            httponly=False,
            **COOKIE_OPTIONS,
        )
        return response

    except HTTPException as e:
        logger.info(f"[LOGIN] HTTPException: {e.status_code} - {e.detail}")
        await audit_service.log_action(
            action="LOGIN_FAILED",
            details=(
                f"Failed login attempt for {_mask_identifier(user_login.email)}: "
                f"{e.detail}"
            ),
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()
        raise e
    except Exception as e:
        # logger.exception keeps the traceback (the previous print() bypassed the
        # logging configuration entirely, so this never reached log aggregation).
        logger.exception("Unhandled error during login for %s", user_login.email)
        await audit_service.log_action(
            action="LOGIN_FAILED",
            details=(
                f"System error during login for {_mask_identifier(user_login.email)}: "
                f"{type(e).__name__}"
            ),
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()
        # A generic 500 body: the exception text can carry internal details
        # (DB URLs, library paths) which must not reach the client. The full
        # context stays in the server log above.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )


@router.post(
    "/register", response_model=ResponseModel, status_code=status.HTTP_201_CREATED
)
@limiter.limit(_AUTH_LIMIT)
async def register(
    user_register: UserRegister,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Register new user

    Accepts ``UserRegister`` — no ``role`` field — so an anonymous caller can
    never create an admin account. The server assigns role="user".

    Note: In production, you may want to restrict this endpoint
    or add email verification
    """
    auth_service = AuthService(db)
    audit_service = AuditService(db)
    user_service = UserService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    mode = settings.REGISTRATION_MODE

    # ── closed (the default): nobody self-registers ──────────────────────
    # The refusal is logged on purpose: an admin reading the audit trail can see
    # how many people knocked while sign-ups were shut.
    if mode == "closed":
        await audit_service.log_action(
            action="USER_REGISTER_BLOCKED",
            details=(
                "Self-registration refused (REGISTRATION_MODE=closed) for "
                f"{_mask_identifier(user_register.email)}"
            ),
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_REGISTRATION_CLOSED_MESSAGE,
        )

    try:
        if mode == "approval":
            # The answer is IDENTICAL whether the address is unknown, already
            # registered or sitting in the trash — anything else turns this
            # endpoint into an account-existence oracle for the whole internet.
            existing = await user_service.get_user_by_email(user_register.email)
            if existing is None:
                user = await auth_service.register(
                    user_register, role="user", is_active=False, status="pending"
                )
                await audit_service.log_action(
                    action="USER_REGISTER_PENDING",
                    user_id=user.id,
                    details=f"Sign-up request awaiting approval: {user.email}",
                    ip_address=client_ip,
                    user_agent=user_agent,
                )
            elif existing.deleted_at is None and existing.status == "rejected":
                # A refused request may be re-submitted, with a fresh password.
                await user_service.resubmit_registration(existing, user_register)
                await audit_service.log_action(
                    action="USER_REGISTER_RESUBMIT",
                    user_id=existing.id,
                    details=f"Refused sign-up request re-submitted: {existing.email}",
                    ip_address=client_ip,
                    user_agent=user_agent,
                )
            else:
                await audit_service.log_action(
                    action="USER_REGISTER_DUPLICATE",
                    details=(
                        "Sign-up request for an address that already exists: "
                        f"{_mask_identifier(user_register.email)}"
                    ),
                    ip_address=client_ip,
                    user_agent=user_agent,
                )

            await db.commit()
            return ResponseModel(
                result="success",
                message=_REGISTRATION_PENDING_MESSAGE,
                data={"status": "pending"},
            )

        # ── open: self-registration creates a working account immediately ──
        user = await auth_service.register(user_register, role="user")

        await audit_service.log_action(
            action="USER_REGISTER",
            user_id=user.id,
            details=f"User self-registered with email: {user.email}",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()

        return ResponseModel(
            result="success",
            message="ลงทะเบียนสำเร็จ",
            data={"user_id": user.id, "email": user.email},
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception:
        logger.exception("Unhandled error during registration")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )


@router.post("/refresh", response_model=ResponseModel)
@limiter.limit(_AUTH_LIMIT)
async def refresh_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Refresh access token using refresh token from cookies (or body fallback)
    """
    auth_service = AuthService(db)

    # 1. Try to get refresh token from cookies
    refresh_token_val = request.cookies.get("refresh_token")

    # 2. Try to get it from request body if not in cookies
    if not refresh_token_val:
        try:
            body = await request.json()
            refresh_token_val = body.get("refresh_token")
        except Exception:
            pass

    if not refresh_token_val:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ไม่พบ Refresh Token",
        )

    try:
        new_tokens = await auth_service.refresh_access_token(refresh_token_val)

        resp = ResponseModel(
            result="success",
            message="รีเฟรชโทเค็นสำเร็จ",
            data={"token_type": "bearer"},
        )
        from fastapi.responses import JSONResponse

        response = JSONResponse(content=resp.model_dump())

        # Cookie attributes are environment-configurable for production HTTPS and local HTTP.
        response.set_cookie(
            key="access_token",
            value=new_tokens.access_token,
            max_age=30 * 60,
            httponly=True,
            **COOKIE_OPTIONS,
        )
        if new_tokens.refresh_token:
            response.set_cookie(
                key="refresh_token",
                value=new_tokens.refresh_token,
                max_age=7 * 24 * 60 * 60,
                httponly=True,
                **COOKIE_OPTIONS,
            )

        # Set user cookie so frontend has consistent state
        try:
            payload = decode_token(refresh_token_val)
            user_id = payload.get("user_id") if payload else None
            user_service = UserService(db)
            user = None
            if user_id:
                user = await user_service.get_user_by_id(user_id)
            elif payload and payload.get("sub"):
                sub_val = payload.get("sub")
                if isinstance(sub_val, str):
                    user = await user_service.get_user_by_email(sub_val)

            if user:
                user_data = {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name or "User",
                    "role": user.role,
                    "avatar": getattr(user, "avatar", None),
                    "quick_links": getattr(user, "quick_links", None),
                    "accessible_pages": getattr(user, "accessible_pages", None),
                }
                response.set_cookie(
                    key="user",
                    value=encode_user_cookie(user_cookie_payload(user_data)),
                    max_age=7 * 24 * 60 * 60,
                    httponly=False,
                    **COOKIE_OPTIONS,
                )
        except Exception:
            pass

        return response

    except HTTPException as e:
        raise e
    except Exception:
        logger.exception("Unhandled error during token refresh")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )


@router.get("/google")
async def google_login(request: Request):
    """Redirect to Google's OAuth 2.0 consent screen"""
    try:
        client_id = settings.require_google_client_id()
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    redirect_uri = settings.get_google_redirect_uri()

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        # OAuth CSRF protection: verified in /google/callback via compare_digest.
        "state": secrets.token_urlsafe(32),
    }

    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    response = RedirectResponse(url)
    response.set_cookie(
        key="oauth_state",
        value=params["state"],
        max_age=600,  # state is single-use for ~the login round-trip (10 min)
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        path="/",
    )
    return response


def _get_valid_client_ids() -> List[str]:
    """Return the list of accepted Google client IDs from the environment.

    Configured via the comma-separated ``GOOGLE_VALID_CLIENT_IDS`` env var so that
    valid Web/Android client IDs are not hardcoded in source. Falls back to the
    single primary client ID if the multi-ID list is not set.
    """
    multi = os.getenv("GOOGLE_VALID_CLIENT_IDS", "").strip()
    ids = [cid.strip() for cid in multi.split(",") if cid.strip()]
    if not ids:
        try:
            ids = [settings.require_google_client_id()]
        except RuntimeError:
            ids = []
    return ids


def _mask_identifier(value: Optional[str]) -> str:
    """Mask a user-supplied login identifier for the audit log (T14).

    Emails keep their domain but hide the local part ("au***@domain"); other
    strings are trimmed to a small prefix/suffix. Prevents PII leakage and
    unbounded text injection into audit_logs.details.
    """
    value = value or ""
    if "@" in value:
        local, _, domain = value.partition("@")
        shown = local[:2]
        return f"{shown}***@{domain[:100]}"
    if len(value) > 6:
        return value[:3] + "***" + value[-2:]
    return "***"


def _get_allowed_google_domains() -> List[str]:
    """Domains allowed for Google AUTO-PROVISIONING (owner policy, T13).

    Read at call time from ``GOOGLE_ALLOWED_DOMAINS`` (comma-separated). An
    empty list keeps the historic behaviour (any verified Google email may be
    provisioned) — production MUST configure it per the owner's decision.
    """
    multi = os.getenv("GOOGLE_ALLOWED_DOMAINS", "").strip()
    return [d.strip().lower() for d in multi.split(",") if d.strip()]


def _check_google_provisioning_domain(
    email: str, verified_info: dict, allowed_domains: List[str]
) -> None:
    """Reject provisioning for emails outside the allowed hosted domains.

    The email domain must be in the allow-list, and when the token carries an
    ``hd`` claim (Workspace accounts) that claim must agree with the list too,
    so a Workspace user cannot claim an address whose domain merely LOOKS allowed.
    Empty ``allowed_domains`` keeps the historic open policy.
    """
    if not allowed_domains:
        return
    email_domain = email.rsplit("@", 1)[-1].lower()
    token_hd = (verified_info.get("hd") or "").lower()
    if token_hd and token_hd not in allowed_domains:
        logger.warning("GOOGLE_AUTH: provisioning refused (hd %s not allowed)", token_hd)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="อีเมลของคุณไม่อยู่ในโดเมนที่อนุญาตให้ลงทะเบียนผ่าน Google",
        )
    if email_domain not in allowed_domains:
        logger.warning(
            "GOOGLE_AUTH: provisioning refused (domain %s not allowed)", email_domain
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="อีเมลของคุณไม่อยู่ในโดเมนที่อนุญาตให้ลงทะเบียนผ่าน Google",
        )


async def _provision_google_user(
    user_service: UserService, email: str, name: str
) -> Any:
    """Create the account a first Google sign-in implies, per REGISTRATION_MODE.

    ``approval`` creates the row inactive and pending, so the caller refuses to
    sign in and the admin sees the request; ``open`` creates a normal account.
    The insert can lose a race with a concurrent sign-in for the same address, in
    which case the lookup is retried instead of failing the login.
    """
    pending = settings.REGISTRATION_MODE == "approval"
    user_create = UserCreate(
        email=email, password=secrets.token_urlsafe(16), name=name, role="user"
    )
    try:
        return await user_service.create_user(
            user_create,
            role="user",
            is_active=not pending,
            status="pending" if pending else None,
        )
    except Exception:
        return await user_service.get_user_by_email(email)


def _assert_google_provisioning_allowed() -> None:
    """Refuse to create an account from a Google sign-in in ``closed`` mode.

    Without this the Google entry points would keep minting accounts while the
    password path answers 403, which is exactly the hole REGISTRATION_MODE is
    supposed to close. Existing accounts are unaffected — this guards creation.
    """
    if settings.REGISTRATION_MODE == "closed":
        logger.warning("GOOGLE_AUTH: provisioning refused (REGISTRATION_MODE=closed)")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_REGISTRATION_CLOSED_MESSAGE,
        )


def _assert_signin_allowed(user: Any) -> None:
    """Refuse to hand tokens to an account that may not sign in.

    ``AuthService.login`` applies these rules to password logins, but both Google
    entry points used to issue cookies first and leave the rejection to the next
    API call — so a suspended or still-unapproved account could finish the OAuth
    round trip and only then meet a bare 403.
    """
    if getattr(user, "deleted_at", None) is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="บัญชีนี้ถูกลบแล้ว กรุณาติดต่อผู้ดูแลระบบ",
        )
    if user.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_SIGNIN_PENDING_MESSAGE
        )
    if user.status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_SIGNIN_REJECTED_MESSAGE
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="บัญชีถูกปิดการใช้งาน"
        )
    if user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="บัญชีถูกล็อก กรุณาลองใหม่ภายหลัง",
        )


@router.post("/google/verify-token")
@limiter.limit(_AUTH_LIMIT)
async def google_verify_token(
    token_request: dict, request: Request, db: AsyncSession = Depends(get_db)
):
    """Verify a Google id_token and issue JWT via HTTP-only cookies.

    🔒 SECURITY: the token *audience* must be one of the configured
    GOOGLE_VALID_CLIENT_IDS — a token issued to any other OAuth client is
    rejected with 401 even when its signature and email are valid.
    The legacy ``access_token``/userinfo login path was removed: userinfo
    responses carry no verifiable audience, so any client's token could be
    replayed here to sign in as the token's owner.
    """
    id_token_jwt = token_request.get("id_token")

    if not id_token_jwt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Missing id_token from request"
        )

    valid_client_ids = _get_valid_client_ids()
    if not valid_client_ids:
        # Fail closed: without an allow-list we cannot validate the audience,
        # so Google login is intentionally disabled instead of accepting any.
        logger.error("GOOGLE_AUTH: GOOGLE_VALID_CLIENT_IDS not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google login is not configured",
        )

    verified_info = None

    # 1. Try local verification via google-auth library
    if _GOOGLE_AUTH_AVAILABLE:
        try:
            request_adapter = google_requests.Request()
            verified_info = google_id_token.verify_oauth2_token(
                id_token_jwt,
                request_adapter,
                clock_skew_in_seconds=30,
            )
        except Exception as e:
            logger.info(f"[GOOGLE_AUTH] Local verification error, trying Google API fallback: {e}")

    # 2. Fallback: Verify directly with Google's official tokeninfo REST API
    if not verified_info:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                tokeninfo_resp = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": id_token_jwt},
                )
            if tokeninfo_resp.status_code == 200:
                verified_info = tokeninfo_resp.json()
            else:
                try:
                    error_detail = tokeninfo_resp.json().get("error_description", "Invalid ID token")
                except Exception:
                    error_detail = "Invalid ID token"
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Google token verification failed: {error_detail}",
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Google token verification network error: {type(e).__name__}",
            )

    if not verified_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify Google token",
        )

    # 🔒 SECURITY: mandatory audience check — fail closed, always.
    token_aud = verified_info.get("aud")
    token_azp = verified_info.get("azp")
    if token_aud not in valid_client_ids and token_azp not in valid_client_ids:
        logger.warning(
            "GOOGLE_AUTH: token audience '%s' (azp: '%s') not in configured "
            "client IDs: %s",
            token_aud,
            token_azp,
            valid_client_ids,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token audience mismatch",
        )

    # Extract verified user info
    email = verified_info.get("email")
    name = verified_info.get("name") or verified_info.get("given_name") or "Google User"

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account must have a verified email address",
        )

    # Ensure email is verified per Google
    email_verified = str(verified_info.get("email_verified", "")).lower() in ("true", "1")
    if not email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Google email not verified"
        )

    # Find or create user — provisioning is domain-restricted (owner policy, T13)
    # and gated by REGISTRATION_MODE: a closed deployment creates nothing here.
    _check_google_provisioning_domain(
        email, verified_info, _get_allowed_google_domains()
    )
    _assert_google_provisioning_allowed()
    try:
        user_service = UserService(db)
        user = await user_service.get_user_by_email(email)
        if not user:
            user = await _provision_google_user(user_service, email, name)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or retrieve user",
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error during Google token verify user fetch")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้งภายหลัง",
        )

    # Only an approved, active account may complete the round trip.
    _assert_signin_allowed(user)

    # Issue tokens — with a real UserSession row + sid so logout/revoke works.
    client_ip_tok = request.client.host if request.client else None
    user_agent_tok = request.headers.get("user-agent")
    refresh_jti = new_refresh_jti()
    session_id = await _create_user_session(
        db, user, client_ip_tok, user_agent_tok, refresh_jti
    )
    access_jwt = create_access_token(data={"sub": user.email, "user_id": user.id})
    refresh_jwt = create_refresh_token(
        data={"sub": user.email, "user_id": user.id, "sid": session_id},
        jti=refresh_jti,
    )

    # Create response
    user_data = {
        "id": user.id,
        "email": user.email,
        "name": name or user.name or "User",
        "role": user.role,
        "avatar": user.avatar,
        "quick_links": user.quick_links,
        "accessible_pages": getattr(user, "accessible_pages", None),
    }

    response = JSONResponse(content={"result": "success", "data": {"user": user_data}})

    response.set_cookie(
        key="access_token",
        value=access_jwt,
        max_age=30 * 60,
        httponly=True,
        **COOKIE_OPTIONS,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_jwt,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        **COOKIE_OPTIONS,
    )
    response.set_cookie(
        key="user",
        value=encode_user_cookie(user_cookie_payload(user_data)),
        max_age=7 * 24 * 60 * 60,
        httponly=False,
        **COOKIE_OPTIONS,
    )

    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle callback from Google with id_token verification, then issue JWT via HTTP-only cookies"""
    if not _GOOGLE_AUTH_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="google-auth library not installed. Run: pip install google-auth",
        )
    try:
        client_id = settings.require_google_client_id()
        client_secret = settings.require_google_client_secret()
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    redirect_uri = settings.get_google_redirect_uri()
    frontend_redirect = os.getenv("FRONTEND_URL", "http://localhost:3000")

    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Missing code from Google"
        )

    # 🔒 OAuth CSRF protection: the state must match the one we issued in
    # /google and stored in the oauth_state cookie. Reject BEFORE exchanging
    # the code, so an attacker-supplied code is never redeemed.
    cookie_state = request.cookies.get("oauth_state") or ""
    query_state = state or ""
    if (
        not cookie_state
        or not query_state
        or not secrets.compare_digest(cookie_state, query_state)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing or invalid OAuth state",
        )

    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    # httpx (async) instead of sync `requests`: this endpoint runs inside the
    # event loop, and a blocking call would stall every concurrent request.
    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post(token_url, data=data)
    if token_resp.status_code != 200:
        logger.warning(
            "Google token exchange failed: status=%s body=%s",
            token_resp.status_code,
            token_resp.text[:200],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to exchange code for token",
        )

    token_json = token_resp.json()
    id_token_jwt = token_json.get("id_token")

    if not id_token_jwt:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No id_token received from Google",
        )

    # ✅ SECURE: Verify id_token signature and audience using google-auth library
    try:
        request_adapter = google_requests.Request()
        verified_info = google_id_token.verify_oauth2_token(
            id_token_jwt,
            request_adapter,
            client_id,
            clock_skew_in_seconds=30,  # Allow up to 30s clock skew
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google token verification failed: {str(e)}",
        )

    if verified_info.get("aud") != client_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token audience mismatch",
        )

    email = verified_info.get("email")
    name = verified_info.get("name") or verified_info.get("given_name") or "Google User"

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account must have a verified email address",
        )

    if not verified_info.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Google email not verified"
        )

    # Find or create user — provisioning is domain-restricted (owner policy, T13)
    # and gated by REGISTRATION_MODE: a closed deployment creates nothing here.
    _check_google_provisioning_domain(
        email, verified_info, _get_allowed_google_domains()
    )
    _assert_google_provisioning_allowed()
    user_service = UserService(db)
    user = await user_service.get_user_by_email(email)
    if not user:
        user = await _provision_google_user(user_service, email, name)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create or retrieve user",
        )

    # Only an approved, active account may complete the round trip.
    _assert_signin_allowed(user)

    # Issue tokens — with a real UserSession row + sid so logout/revoke works.
    refresh_jti = new_refresh_jti()
    session_id = await _create_user_session(
        db, user,
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
        refresh_jti,
    )
    access_jwt = create_access_token(data={"sub": user.email, "user_id": user.id})
    refresh_jwt = create_refresh_token(
        data={"sub": user.email, "user_id": user.id, "sid": session_id},
        jti=refresh_jti,
    )

    user_data = {
        "id": user.id,
        "email": user.email,
        "name": name or user.name or "User",
        "role": user.role,
        "avatar": user.avatar,
        "quick_links": user.quick_links,
        "accessible_pages": getattr(user, "accessible_pages", None),
    }

    redirect_url = f"{frontend_redirect}/login-success"
    response = RedirectResponse(url=redirect_url)
    # The single-use state cookie is consumed on success.
    response.delete_cookie(
        "oauth_state", samesite="lax", secure=settings.COOKIE_SECURE, path="/"
    )

    response.set_cookie(
        key="access_token",
        value=access_jwt,
        max_age=30 * 60,
        httponly=True,
        **COOKIE_OPTIONS,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_jwt,
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        **COOKIE_OPTIONS,
    )
    response.set_cookie(
        key="user",
        value=encode_user_cookie(user_cookie_payload(user_data)),
        max_age=7 * 24 * 60 * 60,
        httponly=False,
        **COOKIE_OPTIONS,
    )
    return response


@router.get("/session")
async def get_session(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Get current user session from HTTP-only cookies.
    Used by frontend after OAuth redirect to read tokens securely.

    The answer is ALWAYS derived from the signed JWT plus the DB — never from
    the client-writable ``user`` cookie — so an attacker cannot forge a role,
    and revoked / locked / disabled accounts are re-checked on every call
    (resolve_user_from_token also rejects refresh tokens).
    """
    access_token = request.cookies.get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ไม่พบ session กรุณาเข้าสู่ระบบใหม่",
        )

    try:
        user = await resolve_user_from_token(access_token, db)
    except HTTPException:
        raise

    # The auth lookup defers the large profile columns; this endpoint serves the
    # avatar and quick links, so they are re-selected here.
    await load_profile_columns(db, user, "avatar", "quick_links")

    user_data = {
        "id": user.id,
        "email": user.email,
        "name": user.name or "User",
        "role": user.role,
        "avatar": getattr(user, "avatar", None),
        "quick_links": getattr(user, "quick_links", None),
        "accessible_pages": getattr(user, "accessible_pages", None),
    }

    return ResponseModel(
        result="success",
        message="พบ session ปัจจุบัน",
        data={
            "user": user_data,
        },
    )


@router.post("/logout", response_model=ResponseModel)
async def logout(
    request: Request,
    session_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Logout and invalidate session, clearing HTTP-only cookies.
    """
    auth_service = AuthService(db)
    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    from fastapi.responses import JSONResponse

    response = JSONResponse(content={"result": "success", "message": "ออกจากระบบสำเร็จ"})

    # Clear cookies (must match the same samesite/secure attributes used when setting them)
    response.delete_cookie("access_token", **COOKIE_OPTIONS)
    response.delete_cookie("refresh_token", **COOKIE_OPTIONS)
    response.delete_cookie("user", **COOKIE_OPTIONS)
    # Drop the CSRF token too so the next login starts from a clean state.
    response.delete_cookie("csrf_token", **COOKIE_OPTIONS)

    # Invalidate session in DB if session_id is provided
    try:
        if session_id:
            stmt = select(UserSession).where(UserSession.session_id == session_id)
            result = await db.execute(stmt)
            session_obj = result.scalar_one_or_none()
            user_id = session_obj.user_id if session_obj else None

            await auth_service.logout(session_id)

            if user_id:
                await audit_service.log_action(
                    action="LOGOUT",
                    user_id=user_id,
                    details=f"Logged out session: {session_id}",
                    ip_address=client_ip,
                    user_agent=user_agent,
                )
                await db.commit()

        return response

    except Exception as e:
        logger.info(f"[LOGOUT] Error: {str(e)}")
        return response
