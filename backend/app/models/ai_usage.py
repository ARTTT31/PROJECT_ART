# -*- coding: utf-8 -*-
"""Per-account daily AI usage counter (see ``app.services.ai_quota``)."""

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class AiUsage(TimestampMixin, Base):
    __tablename__ = "ai_usage"
    __table_args__ = (UniqueConstraint("user_id", "day", name="uq_ai_usage_user_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # UTC calendar day (YYYY-MM-DD): one row per account per day, not per hour, so
    # the counter cannot be reset by travelling across timezones.
    day: Mapped[str] = mapped_column(String(10), index=True)
    requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
