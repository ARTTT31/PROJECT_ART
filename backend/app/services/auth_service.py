"""
Authentication Service - Business logic for authentication
"""

from typing import Dict, Optional, Tuple, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from datetime import datetime, timedelta, timezone
import time
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
)
from app.services.user_service import UserService


# ── Login brute-force backoff (T12) ──────────────────────────────────────
# Failures are tracked per (lowercased identifier, source IP) in process
# memory. It deliberately does NOT set user.is_locked: a purely per-user
# counter lets anyone lock any victim out of their account just by entering
# wrong passwords from another machine. Backoff expires on its own and is
# cleared by a successful verification.
_BACKOFF_MAX_FAILURES = 5
_BACKOFF_SECONDS = 300.0
_login_backoff: Dict[Tuple[str, Optional[str]], Tuple[float, float]] = {}

# Verified once instead of a account lookup when the user does not exist so
# the "unknown user" path costs the same Argon2 work as the real one and the
# response times cannot be used to enumerate accounts.
_DUMMY_PASSWORD_HASH = get_password_hash("!n0-such-user-dummy-hash-" + uuid.uuid4().hex)


def _backoff_failures(key: Tuple[str, Optional[str]]) -> float:
    entry = _login_backoff.get(key)
    if entry is None:
        return 0
    count, until = entry
    if time.time() >= until:
        _login_backoff.pop(key, None)
        return 0
    return count


def _backoff_record_failure(key: Tuple[str, Optional[str]]) -> None:
    count, _until = _login_backoff.get(key, (0, 0.0))
    count = min(count + 1, _BACKOFF_MAX_FAILURES)
    if count >= _BACKOFF_MAX_FAILURES:
        until = time.time() + _BACKOFF_SECONDS
    else:
        until = 0.0
    _login_backoff[key] = (count, until)


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
        if _backoff_failures(backoff_key) >= _BACKOFF_MAX_FAILURES:
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
            _backoff_record_failure(backoff_key)
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
        _login_backoff.pop(backoff_key, None)
        user.failed_login_attempts = 0

        # Update last login
        await self.user_service.update_last_login(
            user.id, ip_address=ip_address, device=device_label
        )

        # Create or update session
        if not session_id:
            session_id = str(uuid.uuid4())

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
        else:
            new_session = UserSession(
                session_id=session_id,
                user_id=user.id,
                user_agent=user_agent,
                device_label=device_label,
                ip_address=ip_address,
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
            }
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
        Create new access token from refresh token.

        Validates that the refresh token's session is still active in the DB,
        so logging out (which sets ``is_active=False``) truly revokes the token.

        Args:
            refresh_token: Refresh token

        Returns:
            New token pair

        Raises:
            HTTPException: If refresh token is invalid or its session is revoked
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

        if not sub or not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        # Verify the session bound to this refresh token is still active.
        # Tokens issued before session_id was embedded (legacy) have no "sid" and
        # are still accepted to avoid breaking existing sessions during rollout.
        if session_id:
            session = (
                await self.db.execute(
                    select(UserSession).where(UserSession.session_id == session_id)
                )
            ).scalar_one_or_none()
            if not session or not session.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session revoked หรือออกจากระบบแล้ว กรุณาเข้าสู่ระบบใหม่",
                )

        # Preserve session_id across refreshes so revocation keeps working.
        new_token_data = {"sub": sub, "user_id": user_id}
        if session_id:
            new_token_data["sid"] = session_id

        access_token = create_access_token(data={"sub": sub, "user_id": user_id})
        new_refresh_token = create_refresh_token(data=new_token_data)

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
