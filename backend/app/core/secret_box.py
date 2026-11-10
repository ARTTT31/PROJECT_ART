# -*- coding: utf-8 -*-
"""Encrypt per-account secrets (currently the user's own AI API key).

The key is derived from ``SECRET_KEY`` instead of being stored beside the
ciphertext, so a leaked database dump alone does not expose every account's
provider key. Changing ``SECRET_KEY`` invalidates the stored ciphertext; the
caller treats that as "no key configured" and falls back to the server key.
"""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)


def _cipher() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    """Return an opaque token for ``value``; never empty for a non-empty input."""
    return _cipher().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str | None) -> str:
    """Decrypt a stored token, returning ``""`` when it is missing or unreadable."""
    if not token:
        return ""
    try:
        return _cipher().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        # SECRET_KEY rotated (or the column holds a plaintext value from a
        # manual edit): behave like an unconfigured account instead of a 500.
        logger.warning("Stored AI key could not be decrypted; ignoring it")
        return ""
