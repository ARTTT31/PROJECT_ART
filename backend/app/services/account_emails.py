"""Account email flows — tokens plus the messages that carry them.

Layers on top of :mod:`app.services.email_service`:

- :func:`issue_token` / :func:`consume_token` manage single-use ``EmailToken``
  rows (only the hash is stored).
- The ``send_*`` / ``notify_*`` helpers build the right message, deliver it on
  a best-effort basis and never raise — an email provider outage must not turn
  a password-reset request into a 500, and every one of these actions is
  retryable by the user.

Callers own the transaction: these helpers ``flush`` (so the caller sees the
new row) but do not ``commit``; the endpoint commits once, as usual.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.utils import utcnow
from app.models.email_token import EmailToken
from app.models.user import User
from app.services.email_service import (
    EmailService,
    account_approved_email,
    account_rejected_email,
    admin_new_request_email,
    password_reset_email,
    verify_email_message,
)

logger = logging.getLogger(__name__)

PURPOSE_PASSWORD_RESET = "password_reset"
PURPOSE_EMAIL_VERIFY = "email_verify"


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def issue_token(
    db: AsyncSession, user_id: int, purpose: str, ttl_minutes: int
) -> str:
    """Create a single-use token for ``user_id`` and return the raw value.

    Only the SHA-256 hash is stored; the raw value exists exactly once, inside
    the email that carries it.
    """
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
    """Redeem ``raw`` if it is valid, unused and unexpired; else ``None``.

    A valid token is marked used in the same transaction, so two concurrent
    submissions can only ever succeed once.
    """
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
    """Delete tokens that expired more than a day ago (housekeeping)."""
    from typing import Any, cast

    from sqlalchemy import CursorResult, delete

    cutoff = utcnow() - timedelta(days=1)
    result = await db.execute(delete(EmailToken).where(EmailToken.expires_at < cutoff))
    # AsyncSession.execute is typed as returning a generic Result; a DELETE
    # always produces a CursorResult, which is where rowcount lives.
    return int(cast(CursorResult[Any], result).rowcount or 0)


# ═══════════════════════════════════════════════════════════════════════════════
# High-level sends — every one is best-effort and returns whether it was sent
# ═══════════════════════════════════════════════════════════════════════════════


async def send_password_reset(db: AsyncSession, user: User) -> bool:
    if not user.email:
        return False
    raw = await issue_token(
        db, user.id, PURPOSE_PASSWORD_RESET, settings.PASSWORD_RESET_TOKEN_MINUTES
    )
    reset_url = f"{settings.FRONTEND_BASE_URL}/reset-password?token={raw}"
    message = password_reset_email(user.email, user.name, reset_url)
    return await EmailService().send(message)


async def send_verification(db: AsyncSession, user: User) -> bool:
    if not user.email:
        return False
    raw = await issue_token(
        db, user.id, PURPOSE_EMAIL_VERIFY, settings.EMAIL_VERIFY_TOKEN_MINUTES
    )
    verify_url = f"{settings.FRONTEND_BASE_URL}/verify-email?token={raw}"
    message = verify_email_message(user.email, user.name, verify_url)
    return await EmailService().send(message)


async def notify_admins_new_request(db: AsyncSession, applicant: User) -> int:
    """Tell every active admin that a sign-up request is waiting.

    Returns how many messages were sent. The applicant's address is included in
    the admin-only message on purpose: an admin reviewing a request needs to
    know who is asking.
    """
    result = await db.execute(
        select(User).where(
            User.role == "admin",
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    )
    panel_url = f"{settings.FRONTEND_BASE_URL}/profile?tab=admin"
    applicant_label = applicant.email or applicant.username or applicant.name
    sent = 0
    service = EmailService()
    for admin in result.scalars():
        if not admin.email:
            continue
        message = admin_new_request_email(
            admin.email, admin.name, applicant_label, panel_url
        )
        if await service.send(message):
            sent += 1
    if sent == 0:
        logger.info("No admin email delivered for pending request %s", applicant.id)
    return sent


async def notify_user_decision(db: AsyncSession, user: User, approved: bool) -> bool:
    """Tell a sign-up requester the decision about their account."""
    if not user.email:
        return False
    if approved:
        message = account_approved_email(
            user.email, user.name, f"{settings.FRONTEND_BASE_URL}/login"
        )
    else:
        message = account_rejected_email(user.email, user.name)
    return await EmailService().send(message)
