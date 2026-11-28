"""Per-account RTSP camera model (credentials encrypted at rest)."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserCamera(Base):
    """Stores an account's RTSP camera with an unguessable MediaMTX stream key."""

    __tablename__ = "user_cameras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stream_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    preset: Mapped[str] = mapped_column(String(32), nullable=False, default="custom")
    rtsp_url_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    masked_host: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    codec: Mapped[str | None] = mapped_column(String(16), nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(32), nullable=True)
    fps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
