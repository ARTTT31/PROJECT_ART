"""
API Dependencies
"""
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.services.user_service import UserService

# Security scheme (auto_error=False to allow checking cookies manually)
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency to get current authenticated user from JWT token.

    Token resolution order:
      1. HTTP-only cookie ``access_token``
      2. Authorization: Bearer <token> header

    Handles cross-site cookies (SameSite=None) from Vercel ↔ Render setup.
    """
    token: Optional[str] = None

    try:
        # ── 1. Try cookie first ───────────────────────────────
        cookie_token = request.cookies.get("access_token")
        if cookie_token:
            # Strip accidental "Bearer " prefix if present
            token = cookie_token.removeprefix("Bearer ").strip()

        # ── 2. Fall back to Authorization header ──────────────
        if not token and credentials:
            token = credentials.credentials

        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # ── 3. Decode JWT ─────────────────────────────────────
        payload = decode_token(token)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired or invalid",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # ── 4. Resolve user from DB (async) ───────────────────
        user_id: Optional[int] = payload.get("user_id")
        email: Optional[str] = payload.get("sub")

        user_service = UserService(db)
        user: Optional[User] = None

        if user_id is not None:
            user = await user_service.get_user_by_id(user_id)
        elif email is not None:
            user = await user_service.get_user_by_email(email)

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user",
            )

        if user.is_locked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is locked",
            )

        return user

    except HTTPException:
        # Re-raise known HTTP errors as-is (401, 403, etc.)
        raise
    except Exception as exc:
        # Catch-all: log and return 401 instead of leaking a 500
        print(f"[get_current_user] Unexpected error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency to ensure current user is an admin
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user

