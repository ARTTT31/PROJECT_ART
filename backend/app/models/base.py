"""
Base model with common fields
"""
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime
from app.core.database import Base


def _utcnow() -> datetime:
    """Return current UTC time (timezone-aware). Replaces deprecated datetime.utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps"""

    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=_utcnow, onupdate=_utcnow, nullable=False
    )


# Export Base for other models
__all__ = ["Base", "TimestampMixin"]
