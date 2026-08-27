"""
Security utilities for authentication and authorization
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app.core.config import settings

# Direct Argon2 password hasher (modern standard, avoids passlib deprecation warnings)
_password_hasher = PasswordHasher()


def _utcnow() -> datetime:
    """Return current UTC time. Replaces deprecated datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


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
        expire = _utcnow() + expires_delta
    else:
        expire = _utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": _utcnow()})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Create JWT refresh token with longer expiration

    Args:
        data: Data to encode in token

    Returns:
        Encoded JWT refresh token
    """
    to_encode = data.copy()
    expire = _utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": _utcnow(), "type": "refresh"})

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
    except JWTError:
        return None
