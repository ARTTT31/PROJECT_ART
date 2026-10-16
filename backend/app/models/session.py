"""
Session Model for tracking user sessions
"""

from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.core.utils import utcnow


class UserSession(Base, TimestampMixin):
    """Session model for tracking active user sessions"""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    # Session metadata
    user_agent: Mapped[str | None] = mapped_column(String(500))
    device_label: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(45))

    # Session status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_activity: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)

    # ── Refresh-token rotation (T19) ────────────────────────────────────────
    # ``refresh_jti`` is the jti of the refresh token this session accepts right
    # now. ``prev_refresh_jti``/``rotated_at`` record the previous one and when
    # it was rotated away, so a second tab that refreshed at the same moment
    # still works inside a short grace window — anything older is a replay and
    # revokes the session.
    refresh_jti: Mapped[str | None] = mapped_column(String(64))
    prev_refresh_jti: Mapped[str | None] = mapped_column(String(64))
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Relationships
    user = relationship("User", back_populates="sessions")

    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, session_id='{self.session_id[:8]}...')>"
