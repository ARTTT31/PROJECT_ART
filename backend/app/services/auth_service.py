"""
Authentication Service - Business logic for authentication
"""

import hashlib
import logging
import time
from typing import Any, Dict, Optional, Tuple, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from datetime import datetime, timedelta, timezone
import uuid

from app.models.user import User
from app.models.session import UserSession
from app.schemas.user import UserCreate, UserRegister
from app.schemas.token import Token
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    new_refresh_jti,
)
from app.core.config import settings
from app.core.utils import utcnow
from app.services.user_service import UserService


logger = logging.getLogger(__name__)


# ── Refresh-token rotation (T19) ─────────────────────────────────────────
# How long the just-rotated refresh token keeps working. Two tabs of the same
# session refresh at the same moment, and the loser of that race presents the
# jti the winner just rotated away from; inside this window it is treated as a
# concurrent refresh, outside it as a replay.
REFRESH_GRACE_SECONDS = 30


# ── Login brute-force backoff (T12) ──────────────────────────────────────
# Failures are tracked per (lowercased identifier, source IP). It deliberately
# does NOT set user.is_locked: a purely per-user counter lets anyone lock any
# victim out of their account just by entering wrong passwords from another
# machine. Backoff expires on its own and is cleared by a successful check.
_BACKOFF_MAX_FAILURES = 5
_BACKOFF_SECONDS = 300.0
_login_backoff: Dict[Tuple[str, Optional[str]], Tuple[float, float]] = {}

# ── Shared (Redis) backoff backend (T20) ─────────────────────────────────
# The in-process counter above only throttles the instance that saw the
# failures, so behind a load balancer an attacker gets _BACKOFF_MAX_FAILURES
# fresh attempts per instance. When a Redis URI is configured (SLOWAPI_STORAGE_URI
# or WS_BROADCAST_REDIS_URL) the counter is kept there instead, keyed by
# IP + sha256(identifier) so the identifier is not readable in Redis. Every
# Redis failure falls OPEN (logged, throttled log rate) rather than turning a
# cache outage into a login outage.
_REDIS_BACKOFF_TTL_SECONDS = 900
# The key is unguessable-but-stable; the identifier is hashed so a Redis dump or
# a MONITOR session does not hand over the list of accounts being attacked.
_redis_client_cache: Any = None
_redis_client_url: Optional[str] = None
_redis_error_logged_at: float = 0.0
_REDIS_ERROR_LOG_INTERVAL = 60.0


def _shared_redis_url() -> str:
    """The configured Redis URI whose storage the backoff counter should share."""
    for candidate in (settings.SLOWAPI_STORAGE_URI, settings.WS_BROADCAST_REDIS_URL):
        uri = (candidate or "").strip()
        if uri.startswith(("redis://", "rediss://")):
            return uri
    return ""


def _redis_backoff_client() -> Any:
    """Lazily built async Redis client for the shared backoff, or ``None``.

    Redis is an optional dependency imported lazily, exactly like the WebSocket
    broadcast bus: without a configured URI (or without the package) callers
    get ``None`` and the in-process counter is used.
    """
    global _redis_client_cache, _redis_client_url

    url = _shared_redis_url()
    if not url:
        return None

    if _redis_client_cache is not None and url == _redis_client_url:
        return _redis_client_cache

    try:
        import redis.asyncio as redis
    except ImportError:  # pragma: no cover - redis is a pinned dependency
        logger.error(
            "A redis:// URI is configured but the `redis` package is not "
            "installed; the login backoff stays process-local."
        )
        return None

    _redis_client_cache = redis.from_url(url, decode_responses=True)
    _redis_client_url = url
    return _redis_client_cache


def _redis_failure(key: Tuple[str, Optional[str]]) -> str:
    """Redis key for one (identifier, IP) bucket. The identifier is hashed."""
    identifier, ip = key
    digest = hashlib.sha256((identifier or "").encode("utf-8")).hexdigest()
    return f"login_fail:{ip or 'unknown'}:{digest}"


def _log_redis_backoff_error(exc: Exception) -> None:
    """Log a Redis backoff failure at most once a minute (brute force is loud)."""
    global _redis_error_logged_at
    now = time.time()
    if now - _redis_error_logged_at >= _REDIS_ERROR_LOG_INTERVAL:
        _redis_error_logged_at = now
        logger.warning(
            "Login backoff Redis unavailable (%s); falling back to the "
            "in-process counter (fail-open).",
            exc,
        )


def _memory_backoff_failures(key: Tuple[str, Optional[str]]) -> float:
    entry = _login_backoff.get(key)
    if entry is None:
        return 0
    count, until = entry
    # ``until`` is only set once the threshold is reached; 0.0 means "below it",
    # NOT "expired". Treating it as a deadline dropped the entry on the next
    # check, so the counter could never climb past one failure and the 5-attempt
    # backoff never actually fired (fixed in T20).
    if until and time.time() >= until:
        _login_backoff.pop(key, None)
        return 0
    return count


def _memory_backoff_record_failure(key: Tuple[str, Optional[str]]) -> None:
    count, _until = _login_backoff.get(key, (0, 0.0))
    count = min(count + 1, _BACKOFF_MAX_FAILURES)
    if count >= _BACKOFF_MAX_FAILURES:
        until = time.time() + _BACKOFF_SECONDS
    else:
        until = 0.0
    _login_backoff[key] = (count, until)


# Verified once instead of a account lookup when the user does not exist so
# the "unknown user" path costs the same Argon2 work as the real one and the
# response times cannot be used to enumerate accounts.
_DUMMY_PASSWORD_HASH = get_password_hash("!n0-such-user-dummy-hash-" + uuid.uuid4().hex)


async def _backoff_failures(key: Tuple[str, Optional[str]]) -> float:
    """Failures recorded for this (identifier, IP) bucket, shared if configured."""
    client = _redis_backoff_client()
    if client is not None:
        try:
            raw = await client.get(_redis_failure(key))
            if raw is None:
                return 0
            return float(raw)
        except Exception as exc:
            _log_redis_backoff_error(exc)
    return _memory_backoff_failures(key)


async def _backoff_record_failure(key: Tuple[str, Optional[str]]) -> None:
    """Record one failed verification for this (identifier, IP) bucket."""
    client = _redis_backoff_client()
    if client is not None:
        try:
            redis_key = _redis_failure(key)
            count = await client.incr(redis_key)
            if count == 1:
                # Expire only on creation: re-setting the TTL on every failure
                # would let an attacker keep a bucket alive indefinitely.
                await client.expire(redis_key, _REDIS_BACKOFF_TTL_SECONDS)
            return
        except Exception as exc:
            _log_redis_backoff_error(exc)
    _memory_backoff_record_failure(key)


async def _backoff_clear(key: Tuple[str, Optional[str]]) -> None:
    """Forget the failures of a bucket after a successful verification."""
    client = _redis_backoff_client()
    if client is not None:
        try:
            await client.delete(_redis_failure(key))
        except Exception as exc:
            _log_redis_backoff_error(exc)
    _login_backoff.pop(key, None)


class AuthService:
    """Service for authentication operations"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)

    async def login(
        self,
        email: str,
        password: str,
        session_id: Optional[str] = None,
        user_agent: Optional[str] = None,
        device_label: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Dict:
        """
        Authenticate user and create session

        Args:
            email: User email or username
            password: User password
            session_id: Optional session ID from client
            user_agent: User agent string
            device_label: Device label
            ip_address: Client IP address

        Returns:
            Dict with tokens and user info

        Raises:
            HTTPException: If authentication fails
        """
        # Brute-force backoff is checked FIRST and keyed per (identifier, IP)
        _T12_generic_failure = "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง"
        backoff_key = ((email or "").lower(), ip_address)
        if await _backoff_failures(backoff_key) >= _BACKOFF_MAX_FAILURES:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง",
            )

        # Get user (by email or username)
        user = await self.user_service.get_user_by_email_or_username(email)

        if not user:
            # Same Argon2 work as a real verification: response time cannot be
            # used to distinguish unknown users from bad passwords.
            verify_password(password, _DUMMY_PASSWORD_HASH)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_T12_generic_failure,
            )

        # 🔒 Check the password BEFORE revealing any account state: with a
        # wrong password the answer is always the same generic 401 (an
        # attacker must not learn is_locked / is_active from messages).
        if not verify_password(password, user.hashed_password):
            await _backoff_record_failure(backoff_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=_T12_generic_failure,
            )

        # Credential holder reached — NOW act on / reveal the account state.
        # A lock with NO expiry is a manual ADMIN lock: it only clears when an
        # admin unlocks it — it must not be silently lifted by the next login.
        if user.is_locked:
            if user.locked_until is None or user.locked_until > datetime.now(
                timezone.utc
            ).replace(tzinfo=None):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="บัญชีถูกล็อก กรุณาลองใหม่ภายหลัง",
                )
            else:
                # Legacy automatic lock whose expiry has passed: unlock it now
                user.is_locked = False
                user.locked_until = None
                user.failed_login_attempts = 0

        # Check if account is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="บัญชีถูกปิดการใช้งาน",
            )

        # Reset failure bookkeeping on a successful verification
        await _backoff_clear(backoff_key)
        user.failed_login_attempts = 0

        # Update last login
        await self.user_service.update_last_login(
            user.id, ip_address=ip_address, device=device_label
        )

        # Create or update session
        if not session_id:
            session_id = str(uuid.uuid4())

        # The jti of the refresh token about to be issued is recorded on the
        # session: refresh only accepts the current one (plus the previous one
        # for a few seconds), so a rotated-away token is a detectable replay.
        refresh_jti = new_refresh_jti()

        existing_session = (
            await self.db.execute(
                select(UserSession).where(UserSession.session_id == session_id)
            )
        ).scalar_one_or_none()

        if existing_session:
            existing_session.is_active = True
            existing_session.last_activity = datetime.now(timezone.utc).replace(
                tzinfo=None
            )
            existing_session.user_agent = user_agent
            existing_session.device_label = device_label
            existing_session.ip_address = ip_address
            # Re-login on the same session_id (two tabs sharing the stored id):
            # the new token takes over and the one in use until now stays valid
            # for the grace window instead of looking like a replay.
            existing_session.prev_refresh_jti = existing_session.refresh_jti
            existing_session.refresh_jti = refresh_jti
            existing_session.rotated_at = utcnow()
        else:
            new_session = UserSession(
                session_id=session_id,
                user_id=user.id,
                user_agent=user_agent,
                device_label=device_label,
                ip_address=ip_address,
                refresh_jti=refresh_jti,
                expires_at=datetime.now(timezone.utc).replace(tzinfo=None)
                + timedelta(days=7),
            )
            self.db.add(new_session)

        await self.db.commit()

        # Create tokens (fallback to username if email is null).
        # session_id is embedded in the refresh token so that refresh can verify
        # the session is still active in the DB (supports real revocation on logout).
        access_token = create_access_token(
            data={"sub": user.email or user.username, "user_id": user.id}
        )
        refresh_token = create_refresh_token(
            data={
                "sub": user.email or user.username,
                "user_id": user.id,
                "sid": session_id,
            },
            jti=refresh_jti,
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "session_id": session_id,
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "display_name": user.display_name,
                "name": user.name,
                "role": user.role,
                "avatar": user.avatar,
                "quick_links": user.quick_links,
            },
        }

    async def register(
        self, user_create: Union[UserCreate, UserRegister], *, role: str = "user"
    ) -> User:
        """
        Register new user

        The role is a server-side argument — request payloads cannot choose it
        (self-registration always ends up with role="user").

        Args:
            user_create: User creation data
            role: Role assigned by the server (caller cannot choose it)

        Returns:
            Created user
        """
        return await self.user_service.create_user(user_create, role=role)

    async def refresh_access_token(self, refresh_token: str) -> Token:
        """
        Create new access token from refresh token, rotating the refresh token.

        Validates that the refresh token's session is still active in the DB, so
        logging out (which sets ``is_active=False``) truly revokes the token, and
        that the token's ``jti`` is the one the session currently accepts.

        A refresh token that was already rotated away is treated as a replay:
        the session is revoked and the caller gets 401. The one exception is the
        just-rotated token inside ``REFRESH_GRACE_SECONDS`` — two tabs refreshing
        at the same moment would otherwise log the user out — where the caller
        simply receives a token carrying the session's current jti.

        Args:
            refresh_token: Refresh token

        Returns:
            New token pair

        Raises:
            HTTPException: If refresh token is invalid, its session is revoked,
                or a rotated-away (reused) token is presented
        """
        payload = decode_token(refresh_token)

        if not payload or payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        sub = payload.get("sub")
        user_id = payload.get("user_id")
        session_id = payload.get("sid")
        token_jti = payload.get("jti")

        if not sub or not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        # 🔒 Every refresh token must name the session it belongs to. Tokens
        # issued before "sid" was embedded have no session to check or revoke,
        # so accepting them would be a standing bypass of logout.
        if not session_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        # Row lock: two concurrent refreshes on the same session must not both
        # read the old jti and both rotate (which would look like two replays).
        session = (
            await self.db.execute(
                select(UserSession)
                .where(UserSession.session_id == session_id)
                .with_for_update()
            )
        ).scalar_one_or_none()

        if not session or not session.is_active or session.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked หรือออกจากระบบแล้ว กรุณาเข้าสู่ระบบใหม่",
            )

        user = await self.user_service.get_user_for_auth(user_id)
        if not user or not user.is_active or user.is_locked or user.deleted_at is not None:
            session.is_active = False
            await self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="บัญชีผู้ใช้ถูกระงับหรือถูกลบ กรุณาติดต่อผู้ดูแลระบบ",
            )

        now = utcnow()
        # ``None`` means "rotate below"; a value means "keep this jti".
        new_jti: Optional[str] = None

        if session.refresh_jti is not None:
            if token_jti == session.refresh_jti:
                pass  # the live token — rotate normally
            elif (
                token_jti
                and token_jti == session.prev_refresh_jti
                and session.rotated_at is not None
                and (now - session.rotated_at).total_seconds() <= REFRESH_GRACE_SECONDS
            ):
                # Concurrent refresh from a second tab: do not rotate again, do
                # not revoke — hand back the jti the session currently accepts
                # so both tabs converge on one live token.
                new_jti = session.refresh_jti
            else:
                # A refresh token that was already rotated away. Either a stolen
                # cookie is being replayed or a client kept an old copy; the
                # session is killed rather than handing out another pair.
                # The token itself is never logged.
                session.is_active = False
                await self.db.commit()
                logger.warning(
                    "Refresh token reuse detected; revoking session %s (user_id=%s)",
                    session_id,
                    session.user_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session revoked หรือออกจากระบบแล้ว กรุณาเข้าสู่ระบบใหม่",
                )
        # else: the session predates refresh-token rotation (no recorded jti),
        # so this token is accepted once and the session is upgraded below.

        if new_jti is None:
            new_jti = new_refresh_jti()
            session.prev_refresh_jti = session.refresh_jti
            session.refresh_jti = new_jti
            session.rotated_at = now

        session.last_activity = now
        await self.db.commit()

        # Preserve session_id across refreshes so revocation keeps working.
        access_token = create_access_token(data={"sub": sub, "user_id": user_id})
        new_refresh_token = create_refresh_token(
            data={"sub": sub, "user_id": user_id, "sid": session_id},
            jti=new_jti,
        )

        return Token(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
        )

    async def logout(self, session_id: str) -> None:
        """
        Logout user and invalidate session

        Args:
            session_id: Session ID to invalidate
        """
        session = (
            await self.db.execute(
                select(UserSession).where(UserSession.session_id == session_id)
            )
        ).scalar_one_or_none()

        if session:
            session.is_active = False
            await self.db.commit()
