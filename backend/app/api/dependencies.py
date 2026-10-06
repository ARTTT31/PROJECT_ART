"""
API Dependencies
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Request, WebSocket
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.services.user_service import UserService

# Security scheme (auto_error=False to allow checking cookies manually)
security = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def resolve_user_from_token(token: str, db: AsyncSession) -> User:
    """Resolve the active, unlocked user that a JWT identifies.

    Shared by the HTTP dependency and the WebSocket handshake so both enforce
    exactly the same account-state rules (expired token, deleted user, inactive
    account, lockout). Raises ``HTTPException`` on rejection.
    """
    payload = decode_token(token)
    if payload is None:
        raise _unauthorized("Token expired or invalid")

    user_id: Optional[int] = payload.get("user_id")
    email: Optional[str] = payload.get("sub")

    user_service = UserService(db)
    user: Optional[User] = None

    if user_id is not None:
        user = await user_service.get_user_by_id(user_id)
    elif email is not None:
        user = await user_service.get_user_by_email(email)

    if user is None:
        raise _unauthorized("User not found")

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
            raise _unauthorized("Could not validate credentials")

        # ── 3. Decode the JWT and apply the shared account rules ──
        return await resolve_user_from_token(token, db)

    except HTTPException:
        # Re-raise known HTTP errors as-is (401, 403, etc.)
        raise
    except Exception as exc:
        # Catch-all: log and return 401 instead of leaking a 500
        print(f"[get_current_user] Unexpected error: {exc}")
        raise _unauthorized("Could not validate credentials")


async def authenticate_websocket(websocket: WebSocket, db: AsyncSession) -> Optional[User]:
    """Authenticate a WebSocket handshake, returning ``None`` when rejected.

    Browsers cannot attach headers to a WebSocket handshake, so the HTTP-only
    ``access_token`` cookie (already sent with the upgrade request) is the
    primary source; an ``Authorization: Bearer`` header is accepted for
    non-browser clients and tests.

    The token is deliberately NOT read from the query string: query strings end
    up in proxy and access logs, which would turn a short-lived credential into a
    long-lived one sitting in plaintext.
    """
    token: Optional[str] = None

    cookie_token = websocket.cookies.get("access_token")
    if cookie_token:
        token = cookie_token.removeprefix("Bearer ").strip()

    if not token:
        header = websocket.headers.get("authorization", "")
        if header.lower().startswith("bearer "):
            token = header[len("bearer "):].strip()

    if not token:
        return None

    try:
        return await resolve_user_from_token(token, db)
    except HTTPException:
        return None
    except Exception as exc:
        print(f"[authenticate_websocket] Unexpected error: {exc}")
        return None


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
