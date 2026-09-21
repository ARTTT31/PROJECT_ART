"""Personal task model for the single-user workspace."""

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PersonalTask(Base, TimestampMixin):
    """A small, private task item owned by one workspace user."""

    __tablename__ = "personal_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(250))
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    priority: Mapped[str] = mapped_column(String(12), default="medium")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
