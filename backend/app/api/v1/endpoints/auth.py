"""
Authentication Endpoints
"""

import json
import os
import secrets
import traceback
from typing import List, Optional
from urllib.parse import urlencode

import requests
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
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.session import UserSession
from app.schemas.response import ResponseModel
from app.schemas.user import UserCreate, UserLogin
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.services.user_service import UserService

router = APIRouter()

COOKIE_OPTIONS = {
    "secure": settings.COOKIE_SECURE,
    "samesite": settings.COOKIE_SAMESITE,
    "path": "/",
}


@router.post("/login", response_model=ResponseModel)
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
        # Non-httpOnly user data cookie (read by frontend for quick display/hydration)
        response.set_cookie(
            key="user",
            value=json.dumps(response_data["user"]),
            max_age=7 * 24 * 60 * 60,
            httponly=False,
            **COOKIE_OPTIONS,
        )
        return response

    except HTTPException as e:
        print(f"[LOGIN] HTTPException: {e.status_code} - {e.detail}")
        await audit_service.log_action(
            action="LOGIN_FAILED",
            details=f"Failed login attempt for {user_login.email}: {e.detail}",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()
        raise e
    except Exception as e:
        print(f"[LOGIN] Exception: {str(e)}")
        print(traceback.format_exc())
        await audit_service.log_action(
            action="LOGIN_FAILED",
            details=f"System error during login for {user_login.email}: {str(e)}",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post(
    "/register", response_model=ResponseModel, status_code=status.HTTP_201_CREATED
)
async def register(
    user_create: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Register new user

    Note: In production, you may want to restrict this endpoint
    or add email verification
    """
    auth_service = AuthService(db)
    audit_service = AuditService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        user = await auth_service.register(user_create)

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

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/refresh", response_model=ResponseModel)
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
                user = await user_service.get_user_by_email(payload.get("sub"))

            if user:
                user_data = {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name or "User",
                    "role": user.role,
                    "avatar": getattr(user, "avatar", None),
                    "quick_links": getattr(user, "quick_links", None),
                }
                response.set_cookie(
                    key="user",
                    value=json.dumps(user_data),
                    max_age=7 * 24 * 60 * 60,
                    httponly=False,
                    **COOKIE_OPTIONS,
                )
        except Exception:
            pass

        return response

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
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
    }

    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(url)


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


@router.post("/google/verify-token")
async def google_verify_token(
    token_request: dict, request: Request = None, db: AsyncSession = Depends(get_db)
):
    """Verify Google ID token from Capacitor plugin and issue JWT via HTTP-only cookies"""
    if not _GOOGLE_AUTH_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="google-auth library not installed. Run: pip install google-auth",
        )

    valid_client_ids = _get_valid_client_ids()

    if not valid_client_ids:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google client ID not configured. Set GOOGLE_VALID_CLIENT_IDS or GOOGLE_CLIENT_ID.",
        )
    
    id_token_jwt = token_request.get("id_token")

    if not id_token_jwt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Missing id_token from request"
        )

    # ✅ SECURE: Verify id_token signature and audience using google-auth library
    # We verify with the first valid client ID, then check if audience matches any valid ID
    try:
        request_adapter = google_requests.Request()
        verified_info = google_id_token.verify_oauth2_token(
            id_token_jwt,
            request_adapter,
            valid_client_ids[0],  # Use first client ID for signature verification
            clock_skew_in_seconds=30,  # Allow up to 30s clock skew
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google token verification failed: {str(e)}",
        )

    # Verify that the token's audience matches one of our valid client IDs
    token_aud = verified_info.get("aud")
    if token_aud not in valid_client_ids:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token audience mismatch. Expected one of: {valid_client_ids}, got: {token_aud}",
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
    if not verified_info.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Google email not verified"
        )

    # Find or create user
    user_service = UserService(db)
    user = await user_service.get_user_by_email(email)
    if not user:
        # Create with a random password (not used)
        random_pwd = secrets.token_urlsafe(16)
        user_create = UserCreate(
            email=email, password=random_pwd, name=name, role="user"
        )
        try:
            user = await user_service.create_user(user_create)
        except Exception:
            # If creation failed, try fetching again
            user = await user_service.get_user_by_email(email)

    # Issue tokens
    access_jwt = create_access_token(data={"sub": user.email, "user_id": user.id})
    refresh_jwt = create_refresh_token(data={"sub": user.email, "user_id": user.id})

    # Create response - tokens are ONLY in HTTP-only cookies (not in URL)
    user_data = {
        "id": user.id,
        "email": user.email,
        "name": name or user.name or "User",
        "role": user.role,
        "avatar": user.avatar,
        "quick_links": user.quick_links,
    }

    response = JSONResponse(content={"result": "success", "data": {"user": user_data}})

    # Cookie attributes are environment-configurable for production HTTPS and local HTTP.
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
    # Non-httpOnly user data cookie for frontend hydration
    response.set_cookie(
        key="user",
        value=json.dumps(user_data),
        max_age=7 * 24 * 60 * 60,
        httponly=False,
        **COOKIE_OPTIONS,
    )

    return response


@router.get("/google/callback")
async def google_callback(
    code: str = None, request: Request = None, db: AsyncSession = Depends(get_db)
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

    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    token_resp = requests.post(token_url, data=data, timeout=10)
    if token_resp.status_code != 200:
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

    # Also verify that the token's audience matches our client ID
    if verified_info.get("aud") != client_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token audience mismatch - possible token substitution attack",
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
    if not verified_info.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Google email not verified"
        )

    # Find or create user
    user_service = UserService(db)
    user = await user_service.get_user_by_email(email)
    if not user:
        # Create with a random password (not used)
        random_pwd = secrets.token_urlsafe(16)
        user_create = UserCreate(
            email=email, password=random_pwd, name=name, role="user"
        )
        try:
            user = await user_service.create_user(user_create)
        except Exception:
            # If creation failed, try fetching again
            user = await user_service.get_user_by_email(email)

    # Issue tokens
    access_jwt = create_access_token(data={"sub": user.email, "user_id": user.id})
    refresh_jwt = create_refresh_token(data={"sub": user.email, "user_id": user.id})

    # Create response - tokens are ONLY in HTTP-only cookies (not in URL)
    user_data = {
        "id": user.id,
        "email": user.email,
        "name": name or user.name or "User",
        "role": user.role,
        "avatar": user.avatar,
        "quick_links": user.quick_links,
    }

    # Redirect to frontend without leaking tokens in URL query params
    redirect_url = f"{frontend_redirect}/login-success"
    response = RedirectResponse(url=redirect_url)

    # Cookie attributes are environment-configurable for production HTTPS and local HTTP.
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
    # Non-httpOnly user data cookie (read by frontend for quick display/hydration)
    response.set_cookie(
        key="user",
        value=json.dumps(user_data),
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
    
    Supports two modes:
    1. Fast-path: If both access_token and user cookie exist, return user from cookie
    2. Fallback: If only access_token exists, decode JWT and fetch user from DB
    """
    access_token = request.cookies.get("access_token")

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ไม่พบ session กรุณาเข้าสู่ระบบใหม่",
        )

    payload = decode_token(access_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token หมดอายุหรือไม่ถูกต้อง",
        )

    # Try fast-path: use user cookie if available
    user_cookie = request.cookies.get("user")
    if user_cookie:
        try:
            user_data = json.loads(user_cookie)
            return ResponseModel(
                result="success",
                message="พบ session ปัจจุบัน",
                data={
                    "access_token": access_token,
                    "refresh_token": request.cookies.get("refresh_token", ""),
                    "user": user_data,
                },
            )
        except (json.JSONDecodeError, TypeError):
            pass  # Fall through to DB lookup

    # Fallback: decode JWT and fetch user from DB
    user_id = payload.get("user_id")
    email = payload.get("sub")

    user_service = UserService(db)
    user = None
    if user_id is not None:
        user = await user_service.get_user_by_id(user_id)
    elif email is not None:
        user = await user_service.get_user_by_email(email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ไม่พบข้อมูลผู้ใช้",
        )

    user_data = {
        "id": user.id,
        "email": user.email,
        "name": user.name or "User",
        "role": user.role,
        "avatar": getattr(user, "avatar", None),
        "quick_links": getattr(user, "quick_links", None),
    }

    return ResponseModel(
        result="success",
        message="พบ session ปัจจุบัน",
        data={
            "access_token": access_token,
            "refresh_token": request.cookies.get("refresh_token", ""),
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
        print(f"[LOGOUT] Error: {str(e)}")
        return response
