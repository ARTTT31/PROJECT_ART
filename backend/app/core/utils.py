"""
Shared core utilities - leaf module for helpers used across multiple layers.
This module must NOT import from other app modules (to avoid circular imports).
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return current UTC time (timezone-naive, stripped for DB/storage consistency).
    Replaces deprecated datetime.utcnow() — use this everywhere.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
