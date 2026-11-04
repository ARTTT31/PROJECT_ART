"""Server-side notification archive.

The bell derives most of what it shows on the client (holidays, weather, oil
prices) and also receives admin broadcasts over the WebSocket, so the backend is
not the source of those events. This table is the durable copy: the client pushes
what it displayed, and the same account gets it back on any device instead of
losing it with that browser's localStorage.

``client_id`` is the id the client generated for the event, unique per account,
which makes re-syncing the same list idempotent.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.utils import utcnow
from app.models.base import Base, TimestampMixin


class NotificationLog(Base, TimestampMixin):
    __tablename__ = "notification_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_notification_user_client"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # The id the client used for this notification, e.g. ``holiday-upcoming-...``.
    client_id: Mapped[str] = mapped_column(String(80))
    type: Mapped[str] = mapped_column(String(24), default="system")
    level: Mapped[str] = mapped_column(String(16), default="info")
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)

    # When the event happened (the client's timestamp), not when it was synced.
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)

    def __repr__(self) -> str:
        return f"<NotificationLog(id={self.id}, user_id={self.user_id}, client_id='{self.client_id}')>"
