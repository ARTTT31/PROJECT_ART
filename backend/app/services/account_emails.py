"""Single-use tokens that back the password-reset and email-verify links.

The raw token is mailed to the user; only its SHA-256 hash is stored, so a
leaked database cannot be turned into working reset links.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta
from typing import cast, Optional

from sqlalchemy import CursorResult, delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.utils import utcnow
from app.models.email_token import EmailToken


PURPOSE_PASSWORD_RESET = "password_reset"
PURPOSE_EMAIL_VERIFY = "email_verify"


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def issue_token(
    db: AsyncSession, user_id: int, purpose: str, ttl_minutes: int
) -> str:
    """Create a single-use token — hash only stored, raw value never generated."""
    raw = secrets.token_urlsafe(32)
    db.add(
        EmailToken(
            user_id=user_id,
            purpose=purpose,
            token_hash=_hash_token(raw),
            expires_at=utcnow() + timedelta(minutes=ttl_minutes),
        )
    )
    await db.flush()
    return raw


async def consume_token(
    db: AsyncSession, purpose: str, raw: str
) -> Optional[EmailToken]:
    """Redeem raw if valid, unused and unexpired; else None."""
    if not raw:
        return None
    result = await db.execute(
        select(EmailToken).where(
            EmailToken.purpose == purpose,
            EmailToken.token_hash == _hash_token(raw),
        )
    )
    token = result.scalar_one_or_none()
    if token is None or token.used_at is not None:
        return None
    if token.expires_at < utcnow():
        return None
    token.used_at = utcnow()
    await db.flush()
    return token


async def purge_expired_tokens(db: AsyncSession) -> int:
    """Delete tokens that expired more than a day ago."""
    cutoff = utcnow() - timedelta(days=1)
    result = await db.execute(sa_delete(EmailToken).where(EmailToken.expires_at < cutoff))
    return int(cast("CursorResult", result).rowcount or 0)
