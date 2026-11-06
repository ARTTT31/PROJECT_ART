"""
Time-based one-time passwords (RFC 6238) and recovery codes.

Implemented on the standard library on purpose: the whole algorithm is an
HMAC-SHA1 over a 8-byte counter, so adding ``pyotp`` would pull a dependency
(and its release cadence) into the login path for ~30 lines of code we can
test directly against the RFC's published vectors.

Every comparison here uses :func:`hmac.compare_digest`: a code check must not
leak how many leading digits were right through response timing.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import secrets
import struct
import time
from typing import List, Optional
from urllib.parse import quote, urlencode

#: Digits in a generated code. Six is what every authenticator app shows.
DIGITS = 6
#: RFC 6238 default time step, in seconds.
STEP_SECONDS = 30
#: Accepted clock drift, in steps (±30s). Phones and servers disagree often.
DRIFT_STEPS = 1

#: How many single-use recovery codes an account gets when 2FA is enabled.
RECOVERY_CODE_COUNT = 10


def generate_secret(byte_length: int = 20) -> str:
    """A fresh base32 secret (160 bits, the RFC 4226 recommendation)."""
    return base64.b32encode(secrets.token_bytes(byte_length)).decode("ascii").rstrip("=")


def _secret_bytes(secret: str) -> bytes:
    """Decode a base32 secret, tolerating lowercase and missing padding."""
    cleaned = (secret or "").strip().replace(" ", "").upper()
    padding = "=" * (-len(cleaned) % 8)
    try:
        return base64.b32decode(cleaned + padding, casefold=True)
    except (binascii.Error, ValueError) as exc:  # pragma: no cover - config error
        raise ValueError("invalid TOTP secret") from exc


def _hotp(secret: str, counter: int) -> str:
    """RFC 4226 HOTP for one counter value, zero-padded to ``DIGITS``."""
    digest = hmac.new(
        _secret_bytes(secret), struct.pack(">Q", counter), hashlib.sha1
    ).digest()
    offset = digest[-1] & 0x0F
    truncated = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(truncated % (10**DIGITS)).zfill(DIGITS)


def code_at(secret: str, timestamp: Optional[float] = None) -> str:
    """The code this secret produces at ``timestamp`` (default: now)."""
    # Clamped at zero: a negative counter cannot be packed into the RFC's
    # big-endian 8-byte field, and a pre-1970 timestamp is not a real clock.
    counter = max(0, int(timestamp if timestamp is not None else time.time()) // STEP_SECONDS)
    return _hotp(secret, counter)


def verify(
    secret: str,
    code: str,
    timestamp: Optional[float] = None,
    drift: int = DRIFT_STEPS,
) -> bool:
    """Check ``code`` against ``secret``, allowing ``drift`` steps either way.

    ``code`` may arrive with the spaces or dashes authenticator apps display,
    so those are stripped before comparing. Anything that is not exactly
    ``DIGITS`` digits is rejected without touching the HMAC.
    """
    if not secret or not code:
        return False

    candidate = "".join(ch for ch in str(code) if ch.isdigit())
    if len(candidate) != DIGITS:
        return False

    now = timestamp if timestamp is not None else time.time()
    for offset in range(-abs(drift), abs(drift) + 1):
        expected = code_at(secret, now + offset * STEP_SECONDS)
        # compare_digest on equal-length strings does not early-exit.
        if hmac.compare_digest(expected, candidate):
            return True
    return False


def provisioning_uri(
    secret: str, account: str, issuer: str = "ART Workspace"
) -> str:
    """The ``otpauth://`` URI an authenticator app scans as a QR code."""
    label = quote(f"{issuer}:{account}", safe="")
    query = urlencode(
        {
            "secret": secret,
            "issuer": issuer,
            "algorithm": "SHA1",
            "digits": DIGITS,
            "period": STEP_SECONDS,
        }
    )
    return f"otpauth://totp/{label}?{query}"


def normalize_recovery_code(code: str) -> str:
    """Recovery codes are stored/compared as uppercase hex without separators."""
    return "".join(ch for ch in str(code or "").upper() if ch.isalnum())


def hash_recovery_code(code: str) -> str:
    """SHA-256 of the normalised code.

    SHA-256 rather than Argon2 is deliberate: a recovery code carries 40 bits
    of entropy from :func:`secrets.token_hex`, it is single-use, and the login
    path already pays an Argon2 verification for the password — a second slow
    hash per attempt would just be a denial-of-service lever.
    """
    return hashlib.sha256(normalize_recovery_code(code).encode("utf-8")).hexdigest()


def generate_recovery_codes(
    count: int = RECOVERY_CODE_COUNT,
) -> tuple[List[str], List[str]]:
    """Return ``(plaintext_codes, hashes)``.

    Plaintext is shown to the user exactly once; only the hashes are stored.
    Codes are 10 hex characters, displayed as ``abcde-12345``.
    """
    plaintext: List[str] = []
    hashes: List[str] = []
    for _ in range(count):
        raw = secrets.token_hex(5).upper()  # 10 hex chars = 40 bits
        plaintext.append(f"{raw[:5]}-{raw[5:]}")
        hashes.append(hash_recovery_code(raw))
    return plaintext, hashes


def load_recovery_hashes(raw: Optional[str]) -> List[str]:
    """Parse the stored JSON array, treating NULL and garbage as "no codes".

    A corrupt value must not raise inside login: the password still works and
    an admin can reset 2FA, but a 500 there would lock the account out of every
    session it could still legitimately open.
    """
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(data, list):
        return []
    return [str(item) for item in data]


def match_recovery_code(code: str, stored_hashes: List[str]) -> Optional[int]:
    """Index of the recovery code that matches, or ``None``.

    The caller removes the matched entry so a code cannot be replayed.
    """
    candidate = hash_recovery_code(code)
    for index, stored in enumerate(stored_hashes):
        if hmac.compare_digest(candidate, stored):
            return index
    return None


__all__ = [
    "DIGITS",
    "STEP_SECONDS",
    "RECOVERY_CODE_COUNT",
    "generate_secret",
    "code_at",
    "verify",
    "provisioning_uri",
    "normalize_recovery_code",
    "hash_recovery_code",
    "generate_recovery_codes",
    "load_recovery_hashes",
    "match_recovery_code",
]
