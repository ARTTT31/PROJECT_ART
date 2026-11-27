"""Finance widget storage — one row per income/expense entry.

The widget used to keep its whole state in three JSON-as-text columns on
``users`` (``finance_entries``, ``finance_budget``, ``finance_deleted``). Those
columns stay in place for this release as the rollback target, filled back from
these tables by ``app.services.finance_service.rebuild_finance_json``; nothing
reads or writes them once the endpoints move to the service.

Column names deliberately differ from the API field names: ``entry_type`` and
``entry_date`` because ``type`` / ``date`` shadow a builtin and the ``Date``
type, and ``client_id`` because the widget generates its own opaque id while the
table needs a surrogate key.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.utils import utcnow
from app.models.base import Base, TimestampMixin


class FinanceEntry(Base, TimestampMixin):
    """One income/expense row, in the order the widget keeps its list."""

    __tablename__ = "finance_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # The id the widget already uses ("f1", a uuid, ...). Unique per account,
    # not globally: two accounts may pick the same string.
    client_id: Mapped[str] = mapped_column(String(64))
    entry_type: Mapped[str] = mapped_column(String(10))
    label: Mapped[str] = mapped_column(String(60), default="")
    # Money gets a real numeric column; the API still answers with a number.
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    entry_date: Mapped[date] = mapped_column(Date)
    category: Mapped[str | None] = mapped_column(String(40))
    # Position in the widget's list. The JSON array preserved insertion order and
    # the UI keeps that order inside a day, so it is stored rather than derived.
    position: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_finance_entries_user_client"),
        # The read path today is "this account's rows, in order". ``user_id`` is
        # the leftmost column, so it also serves a plain per-account lookup and a
        # separate index on it would be redundant.
        Index("ix_finance_entries_user_position", "user_id", "position"),
    )

    user = relationship("User", back_populates="finance_rows")


class FinanceSettings(Base, TimestampMixin):
    """Per-account finance settings. A missing row means "no budget set"."""

    __tablename__ = "finance_settings"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    monthly_budget: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))

    user = relationship("User", back_populates="finance_settings")


class FinanceDeletedEntry(Base):
    """A row this account deleted, kept so a stale device cannot re-add it.

    ``PUT /profile/finance`` replaces the whole list, so a browser holding an old
    copy would otherwise write a deleted row straight back. The tombstones used
    to live in a JSON object; they are rows now, pruned on read/write with the
    same 90-day TTL and 500-row cap as before.
    """

    __tablename__ = "finance_deleted_entries"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    client_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # Naive UTC like every other timestamp in this schema; the API converts it
    # back to the unix seconds the widget's contract uses.
    deleted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user = relationship("User", back_populates="finance_deleted_rows")
