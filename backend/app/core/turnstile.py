"""Cloudflare Turnstile verification (optional signup/abuse protection).

When ``TURNSTILE_SECRET_KEY`` is set, the public write endpoints (register,
forgot-password) require a valid ``turnstile_token``. When it is empty the
check is skipped entirely — a deployment that has not set up Turnstile must
keep working.

Failure mode: a *configured* check fails closed on network errors as well. The
user can retry; letting unverified signups through whenever Cloudflare is
unreachable would defeat the point.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def turnstile_configured() -> bool:
    return bool(settings.TURNSTILE_SECRET_KEY.strip())


async def verify_turnstile(token: str | None, remote_ip: str | None) -> bool:
    """True when the request may proceed (no secret configured, or verified)."""
    if not turnstile_configured():
        return True
    if not token:
        return False
    payload = {"secret": settings.TURNSTILE_SECRET_KEY, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(SITEVERIFY_URL, data=payload)
        if resp.status_code != 200:
            logger.warning("Turnstile siteverify HTTP %s", resp.status_code)
            return False
        return bool(resp.json().get("success"))
    except Exception as exc:
        logger.warning("Turnstile siteverify failed: %s", exc)
        return False
