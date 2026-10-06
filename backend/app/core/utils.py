"""
Shared core utilities - leaf module for helpers used across multiple layers.
This module must NOT import from other app modules (to avoid circular imports).
"""

import json
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, unquote


def utcnow() -> datetime:
    """Return current UTC time (timezone-naive, stripped for DB/storage consistency).
    Replaces deprecated datetime.utcnow() — use this everywhere.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def encode_user_cookie(data: dict) -> str:
    """Percent-encode the JSON payload for the readable ``user`` cookie.

    A raw ``json.dumps`` string passed to ``set_cookie`` gets quoted and
    octal-escaped by the cookie serialiser (commas become ``\\054``, the whole
    value is wrapped in double quotes). Browsers store that escaped form
    verbatim, so ``document.cookie`` readers — and ``JSON.parse`` on it — fail
    on every login. Encoding here keeps only cookie-legal characters, so the
    value round-trips byte-for-byte and the frontend simply decodes it with
    ``decodeURIComponent``.
    """
    return quote(json.dumps(data, ensure_ascii=False), safe="")


def decode_user_cookie(value: str) -> Optional[dict]:
    """Inverse of :func:`encode_user_cookie`; ``None`` for anything unparsable."""
    try:
        decoded = json.loads(unquote(value))
    except (ValueError, TypeError):
        return None
    return decoded if isinstance(decoded, dict) else None
