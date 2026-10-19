"""
Email Token Model

Single-use, expiring tokens for account emails: password reset and email
verification. Only the SHA-256 hash of the token is stored — a database leak
must not hand out working reset links (same reasoning as password hashing).
"""

from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class EmailToken(Base, TimestampMixin):
    """One pending email action for one account."""

    __tablename__ = "email_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # "password_reset" | "email_verify" — text for the same reason as
    # users.status: a new purpose is an application change, not a migration.
    purpose: Mapped[str] = mapped_column(String(20), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    # Set the moment the token is redeemed; a used token is never accepted again.
    used_at: Mapped[datetime | None] = mapped_column(DateTime)

    user = relationship("User")

    def __repr__(self) -> str:
        return f"<EmailToken(id={self.id}, purpose='{self.purpose}', user_id={self.user_id})>"
