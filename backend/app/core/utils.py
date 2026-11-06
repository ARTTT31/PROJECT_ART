"""
Shared core utilities - leaf module for helpers used across multiple layers.
This module must NOT import from other app modules at import time (to avoid
circular imports); the one settings read below happens lazily inside the call.
"""

import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, unquote


def utcnow() -> datetime:
    """Return current UTC time (timezone-naive, stripped for DB/storage consistency).
    Replaces deprecated datetime.utcnow() — use this everywhere.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


# The readable ``user`` cookie is a display cache for the frontend. It is
# readable (not httpOnly) so the shell can paint before the session request
# answers — which also means a script on the origin, an extension, or the user
# can rewrite it. Authorisation always comes from the JWT, but a forged cookie
# still rendered the wrong identity and nothing on the server noticed. The
# payload is therefore HMAC-signed with SECRET_KEY: the browser cannot verify it
# (it has no key, and is not expected to), but any server-side read can reject a
# value it did not write.
#
# Wire format: ``<percent-encoded JSON>.<hex signature>``. The signature follows
# the LAST dot, because ``.`` and ``-`` are unreserved and never percent-encoded
# inside the payload.
#
# Carrying the avatar / quick_links blobs made a single Set-Cookie header exceed
# header ceilings (a 1MB avatar ~1.4MB when base64+percent-encoded); anything
# beyond the keys below is fetched from the API instead.
USER_COOKIE_FIELDS = ("id", "role", "name", "email")

_SEPARATOR = "."


def _signing_key() -> bytes:
    """SECRET_KEY as bytes, imported lazily to keep this module a leaf."""
    from app.core.config import settings

    return settings.SECRET_KEY.encode("utf-8")


def _sign(encoded_payload: str) -> str:
    """HMAC-SHA256 of the encoded payload, hex encoded."""
    return hmac.new(
        _signing_key(), encoded_payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def user_cookie_payload(data: dict) -> dict:
    """Minified payload for the readable ``user`` cookie."""
    return {key: data.get(key) for key in USER_COOKIE_FIELDS if key in data}


def encode_user_cookie(data: dict) -> str:
    """Percent-encoded, signed JSON for the readable ``user`` cookie.

    A raw ``json.dumps`` string passed to ``set_cookie`` gets quoted and
    octal-escaped by the cookie serialiser (commas become ``\\054``, the whole
    value is wrapped in double quotes). Browsers store that escaped form
    verbatim, so ``document.cookie`` readers — and ``JSON.parse`` on it — fail
    on every login. Encoding here keeps only cookie-legal characters, so the
    value round-trips byte-for-byte and the frontend simply decodes it with
    ``decodeURIComponent`` after dropping the signature.
    """
    encoded = quote(json.dumps(data, ensure_ascii=False), safe="")
    return f"{encoded}{_SEPARATOR}{_sign(encoded)}"


def decode_user_cookie(value: str) -> Optional[dict]:
    """Verify and parse a ``user`` cookie; ``None`` for anything untrusted.

    An unsigned value (a cookie written before signing existed) is rejected:
    accepting it would let anyone strip the signature to bypass the check.
    Such cookies only live until the next login or refresh, both of which
    rewrite them signed.
    """
    if not value:
        return None

    encoded, separator, signature = value.rpartition(_SEPARATOR)
    if not separator or not encoded or not signature:
        return None
    if not hmac.compare_digest(_sign(encoded), signature):
        return None

    try:
        decoded = json.loads(unquote(encoded))
    except (ValueError, TypeError):
        return None
    return decoded if isinstance(decoded, dict) else None
