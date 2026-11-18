"""
Security utilities for authentication and authorization
"""

from datetime import timedelta
from typing import Optional
import hashlib
import logging
import secrets
import jwt
from jwt import InvalidTokenError
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app.core.config import settings
from app.core.utils import utcnow

# Direct Argon2 password hasher (modern standard, avoids passlib deprecation warnings)
_password_hasher = PasswordHasher()

logger = logging.getLogger(__name__)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    except Exception:
        # Still deny the login (a password check must never raise into the
        # request), but a stored hash we cannot parse is a data bug, not a wrong
        # password: log it so it stops looking like a user typo forever.
        logger.warning("verify_password: unexpected error while verifying hash", exc_info=True)
        return False


def get_password_hash(password: str) -> str:
    """Hash a password with Argon2id"""
    return _password_hasher.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token

    Args:
        data: Data to encode in token (usually {"sub": user_email})
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = utcnow() + expires_delta
    else:
        expire = utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # "type": "access" marks this token as usable ONLY for API auth — refresh
    # tokens carry "refresh" and are rejected by resolve_user_from_token.
    to_encode.update({"exp": expire, "iat": utcnow(), "type": "access"})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def new_refresh_jti() -> str:
    """Opaque identifier for one refresh token "generation".

    Rotation is tracked by jti, not by the token string: the session row stores
    which jti it currently accepts, and a token whose jti is neither the current
    nor the just-rotated one is a replay.
    """
    return secrets.token_urlsafe(16)


def create_refresh_token(data: dict, jti: Optional[str] = None) -> str:
    """
    Create JWT refresh token with longer expiration

    Args:
        data: Data to encode in token
        jti: Rotation identifier. Callers that store it on the session pass the
            value they recorded; when omitted a fresh one is generated so every
            refresh token is traceable.

    Returns:
        Encoded JWT refresh token
    """
    to_encode = data.copy()
    expire = utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update(
        {"exp": expire, "iat": utcnow(), "type": "refresh", "jti": jti or new_refresh_jti()}
    )

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and verify JWT token

    Args:
        token: JWT token to decode

    Returns:
        Decoded token payload or None if invalid
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except InvalidTokenError:
        # Expired, tampered, wrong algorithm or malformed — all map to "no user".
        return None


def create_step_up_token(user_id: int, session_id: str) -> str:
    """Issue the short-lived proof that the second factor was just typed.

    Bound to ``session_id`` so the proof covers the session that asked for it;
    the same 2FA code typed in another browser must not unlock this one.
    """
    payload = {
        "sub": str(user_id),
        "sid": session_id,
        "type": "step_up",
        "exp": utcnow() + timedelta(seconds=settings.STEP_UP_TTL_SECONDS),
        "iat": utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def read_step_up_token(
    token: Optional[str], user_id: int, session_id: Optional[str]
) -> Optional[dict]:
    """Return the payload when this cookie proves ``user_id`` in ``session_id``."""
    if not token or not session_id:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except InvalidTokenError:
        return None
    if payload.get("type") != "step_up" or payload.get("sub") != str(user_id):
        return None
    if payload.get("sid") != session_id:
        return None
    return payload


def get_user_2fa_salt(hashed_password: str, totp_secret: Optional[str]) -> str:
    """Generate a 16-hex fingerprint derived from the user's password hash and TOTP secret.

    If the password changes or 2FA secret changes/resets, this salt changes automatically,
    immediately invalidating all issued trusted device tokens without database mutations.
    """
    raw = f"{hashed_password}:{totp_secret or ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def create_trusted_device_token(
    user_id: int,
    version_salt: str,
    token_id: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Issue a signed JWT for a trusted device.

    ``token_id`` is the ``jti`` that names the ``trusted_devices`` row; without
    it the cookie could not be revoked individually.
    """
    expire = utcnow() + (
        expires_delta or timedelta(days=settings.TRUSTED_DEVICE_EXPIRE_DAYS)
    )
    payload = {
        "sub": str(user_id),
        "type": "trusted_device",
        "v": version_salt,
        "jti": token_id,
        "exp": expire,
        "iat": utcnow(),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_trusted_device_token(token: Optional[str]) -> Optional[dict]:
    """Signature + expiry check only, without an account or salt.

    Used by logout, which must be able to revoke the row named by a cookie it
    is already discarding without loading the account to recompute the salt.
    """
    if not token:
        return None
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except InvalidTokenError:
        return None
    if payload.get("type") != "trusted_device":
        return None
    return payload


def read_trusted_device_token(
    token: Optional[str],
    user_id: int,
    expected_salt: str,
) -> Optional[dict]:
    """Return the payload when the token belongs to ``user_id`` and is current."""
    payload = decode_trusted_device_token(token)
    if payload is None:
        return None
    if payload.get("sub") != str(user_id):
        return None
    if payload.get("v") != expected_salt:
        return None
    return payload


def verify_trusted_device_token(
    token: str,
    user_id: int,
    expected_salt: str,
) -> bool:
    """Verify that a trusted device token is valid, matches the user, and has not been invalidated."""
    return read_trusted_device_token(token, user_id, expected_salt) is not None
