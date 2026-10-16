"""
Security utilities for authentication and authorization
"""

from datetime import timedelta
from typing import Optional
import secrets
import jwt
from jwt import InvalidTokenError
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app.core.config import settings
from app.core.utils import utcnow

# Direct Argon2 password hasher (modern standard, avoids passlib deprecation warnings)
_password_hasher = PasswordHasher()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    except Exception:
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
