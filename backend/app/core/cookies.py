"""Cookie attributes shared by every auth endpoint.

The session, CSRF and step-up cookies are all written with the same posture, and
that posture is derived from settings at call time (a Render process override
must win immediately). Keeping it here means ``auth`` and ``auth_2fa`` cannot
drift into writing two different cookies for one browser.
"""

from typing import Any

from app.core.config import settings

COOKIE_OPTIONS: dict[str, Any] = {
    "secure": settings.COOKIE_SECURE,
    # Effective value: browsers reject `SameSite=None` without `Secure`, so a
    # non-HTTPS environment is downgraded to `lax` instead of losing the cookie.
    "samesite": settings.COOKIE_SAMESITE_EFFECTIVE,
    "path": "/",
}

__all__ = ["COOKIE_OPTIONS"]
