"""
User Model
"""

from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    """User model for authentication and profile"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))

    # Profile fields
    avatar: Mapped[str | None] = mapped_column(Text)  # Base64 or URL
    role: Mapped[str] = mapped_column(String(50), default="user")  # user, admin

    # Quick links (JSON stored as text)
    quick_links: Mapped[str | None] = mapped_column(Text)

    # Dashboard layout and widget preferences (JSON stored as text)
    dashboard_layout: Mapped[str | None] = mapped_column(Text)

    # Camera streams configuration (JSON stored as text)
    camera_config: Mapped[str | None] = mapped_column(Text)

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)

    # Login tracking
    last_login: Mapped[datetime | None] = mapped_column(DateTime)
    last_login_ip: Mapped[str | None] = mapped_column(String(45))
    last_login_device: Mapped[str | None] = mapped_column(String(255))

    # Failed login attempts
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime)

    # Relationships
    sessions = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', name='{self.name}')>"
