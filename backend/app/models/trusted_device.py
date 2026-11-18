"""
Trusted Device Model — browsers allowed to skip the 2FA prompt
"""

from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class TrustedDevice(Base, TimestampMixin):
    """One browser that may sign in without a TOTP code.

    The cookie itself is a signed JWT, so it cannot be revoked on its own. This
    row is the revocation list: ``token_id`` is the cookie's ``jti``, and login
    only honours a token whose row still exists, is unrevoked, unexpired and
    carries the account's current salt.

    ``salt_version`` is ``get_user_2fa_salt(hashed_password, totp_secret)`` at
    issue time. A password change or a 2FA reset changes that value, so every
    older row stops counting without a write on those paths — the list endpoint
    filters on it and purges what no longer matches.
    """

    __tablename__ = "trusted_devices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    salt_version: Mapped[str] = mapped_column(String(32), nullable=False)

    device_label: Mapped[str | None] = mapped_column(String(255))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(45))

    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)

    user = relationship("User", back_populates="trusted_devices")

    def __repr__(self):
        return (
            f"<TrustedDevice(id={self.id}, user_id={self.user_id}, "
            f"revoked={'yes' if self.revoked_at else 'no'})>"
        )
