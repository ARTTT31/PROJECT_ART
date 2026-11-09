"""
System Settings Model
Stores global configuration such as Company/Team branding
"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SystemSetting(Base, TimestampMixin):
    """System setting key-value configuration"""

    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True, index=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        # This table also stores the VAPID private key. A repr ends up in log
        # lines and exception traces, so anything key-like is masked.
        if self.value and any(
            marker in self.key.lower()
            for marker in ("secret", "private", "token", "key")
        ):
            return f"<SystemSetting(key='{self.key}', value='***')>"
        return f"<SystemSetting(key='{self.key}', value='{self.value}')>"
