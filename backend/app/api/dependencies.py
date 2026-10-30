"""
API Dependencies
"""

import json
import logging
from typing import Any, Callable, List, Optional
from fastapi import Depends, HTTPException, status, Request, WebSocket
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

# Security scheme (auto_error=False to allow checking cookies manually)
security = HTTPBearer(auto_error=False)

# Large profile columns that UserService.get_user_for_auth defers. Endpoints
# that serve them must re-select them first: reading a deferred column that was
# never loaded raises MissingGreenlet in async SQLAlchemy (the implicit lazy
# load cannot run outside a greenlet context).
PROFILE_COLUMNS = (
    "avatar",
    "quick_links",
    "dashboard_layout",
    "camera_config",
    # Holds a data URL (up to ~40KB) like avatar, so it stays deferred too.
    "workspace_logo",
    # JSON lists that grow with use; only their widgets read them.
    "quick_notes",
    "finance_entries",
    "watchlist",
    "main_menu",
)

# ── Page-level access (users.accessible_pages) ───────────────────────────
# The sidebar hides the pages an account may not open, but hiding a menu item is
# not authorization: the page is still reachable by typing its URL, and the API
# behind it would still answer. These helpers are the server-side half of that
# decision. ``NULL`` means the historic default (dashboard + profile) — the same
# list the frontend assumes — so an account that predates the column does not
# silently gain access to everything.
DEFAULT_PAGES: tuple[str, ...] = ("dashboard", "profile")
PAGE_FORBIDDEN_MESSAGE = "คุณไม่มีสิทธิ์เข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ"


def parse_accessible_pages(raw: Optional[str]) -> List[str]:
    """Page ids an account may open; malformed input falls back to the default."""
    if not raw:
        return list(DEFAULT_PAGES)
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return list(DEFAULT_PAGES)
    if not isinstance(parsed, list):
        return list(DEFAULT_PAGES)
    return [str(page) for page in parsed]


def has_page_access(user: User, page_id: str) -> bool:
    """Whether ``user`` may use page ``page_id``. Admins are never gated."""
    if user.role == "admin":
        return True
    return page_id in parse_accessible_pages(user.accessible_pages)


def require_page_access(page_id: str) -> Callable[..., Any]:
    """Dependency factory: 403 unless the caller may use that page.

    Usage: ``current_user: User = Depends(require_page_access("camera"))``.
    """
    async def _require_page_access(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if not has_page_access(current_user, page_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=PAGE_FORBIDDEN_MESSAGE,
            )
        return current_user

    return _require_page_access


async def load_profile_columns(db: AsyncSession, user: User, *columns: str) -> User:
    """Re-select deferred profile columns before they are read or serialised.

    Called by the few endpoints that actually return these fields (``/profile/me``,
    ``/auth/session``). Passing no column names loads all of :data:`PROFILE_COLUMNS`.
    """
    await db.refresh(user, list(columns) or list(PROFILE_COLUMNS))
    return user


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
    account, lockout, session revoked). Raises ``HTTPException`` on rejection.

    Access tokens must name the session that issued them. That ``sid`` is
    checked in the same query as the user lookup, so logout/password-change/
    admin-deactivation revoke an access token immediately rather than waiting
    for its 30-minute expiry.
    """
    payload = decode_token(token)
    if payload is None:
        raise _unauthorized("Token expired or invalid")

    # 🔒 Only access tokens authenticate API calls. A refresh token presented
    # as a Bearer/access token is refused so it cannot survive a logout: the
    # refresh token's own revocation check lives in auth_service.refresh_access_token.
    if payload.get("type") != "access":
        raise _unauthorized("Invalid token type")

    user_id: Optional[int] = payload.get("user_id")
    session_id = payload.get("sid")

    # Tokens minted before sessions were embedded cannot be checked against the
    # session table, so they are refused rather than silently bypassing logout.
    if user_id is None or not isinstance(session_id, str) or not session_id:
        raise _unauthorized("Invalid token session")

    user_service = UserService(db)
    # One deferred JOIN lookup: the large profile blobs are not part of it.
    user = await user_service.get_user_for_auth_with_session(user_id, session_id)

    if user is None:
        raise _unauthorized("Session revoked or user not found")

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
        logger.warning("get_current_user: unexpected error: %s", exc)
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
        logger.warning("authenticate_websocket: unexpected error: %s", exc)
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
