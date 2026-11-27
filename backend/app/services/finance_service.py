"""Finance storage: the tables, the service the endpoints use, and the one-off
helpers that move the old JSON columns into them.

``FinanceService`` is the only reader/writer the API uses once the migration has
run; it keeps the widget's contract exactly (whole-list replace, ``position``
order preserved, tombstones for cross-device deletes).

``backfill_finance_from_json`` / ``rebuild_finance_json`` take a *synchronous*
SQLAlchemy ``Connection`` because that is what Alembic hands a revision through
``op.get_bind()``. They disappear together with the legacy columns they serve.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Iterable

from sqlalchemy import Connection, insert, literal, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.personal_lists import (
    FINANCE_TOMBSTONE_TTL_SECONDS,
    MAX_FINANCE_TOMBSTONES,
    parse_finance_budget,
    parse_finance_entries,
    parse_finance_tombstones,
    prune_finance_tombstones,
    serialize_finance_budget,
    serialize_finance_entries,
    serialize_finance_tombstones,
)
from app.core.utils import utcnow
from app.models.finance import FinanceDeletedEntry, FinanceEntry, FinanceSettings
from app.models.user import User

logger = logging.getLogger(__name__)

_CENTS = Decimal("0.01")


def _money(value: Any) -> Decimal:
    """Round to cents through ``str`` so float noise never reaches the column."""
    return Decimal(str(value)).quantize(_CENTS)


def _unix_seconds(value: datetime) -> int:
    """Naive UTC timestamp → the unix seconds the widget's contract uses."""
    return int(value.replace(tzinfo=timezone.utc).timestamp())


def _from_unix(seconds: int) -> datetime:
    """Unix seconds → the naive UTC timestamp the columns store."""
    return datetime.fromtimestamp(seconds, tz=timezone.utc).replace(tzinfo=None)


def _now_seconds() -> int:
    """The stamp a deletion made right now gets."""
    return _unix_seconds(utcnow())


def _has_finance_rows(conn: Connection, user_id: int) -> bool:
    """Whether any of the three tables already holds a row for this account."""
    for table in (
        FinanceEntry.__table__,
        FinanceSettings.__table__,
        FinanceDeletedEntry.__table__,
    ):
        found = conn.execute(
            select(literal(1)).select_from(table).where(table.c.user_id == user_id).limit(1)
        ).first()
        if found is not None:
            return True
    return False


def _all_user_ids(conn: Connection) -> list[int]:
    """Every account id, not just the ones with rows.

    An account whose entries were all deleted has no rows in any table, and
    rebuilding only the accounts that still have rows would leave its old JSON
    list in place — a rollback would then resurrect every row the user deleted.
    """
    return list(conn.execute(select(User.id).order_by(User.id)).scalars())


def backfill_finance_from_json(conn: Connection) -> dict[str, int]:
    """Copy ``users.finance_*`` into the tables; returns counters for the log.

    Parsing goes through the same functions the API used on read
    (``parse_finance_entries`` / ``_budget`` / ``_tombstones``), which is the
    whole safety argument: a row a user could see before the migration is
    exactly a row those parsers accept, and a row the API already dropped stays
    dropped. Nothing is invented and nothing changes shape.

    Re-runnable: an account that already has rows is skipped, so a partially
    applied revision never duplicates data.
    """
    counters = {
        "users": 0,
        "entries": 0,
        "budgets": 0,
        "tombstones": 0,
        "duplicates": 0,
        "dropped": 0,
        "skipped": 0,
    }

    legacy = conn.execute(
        select(
            User.id,
            User.finance_entries,
            User.finance_budget,
            User.finance_deleted,
        ).where(
            or_(
                User.finance_entries.is_not(None),
                User.finance_budget.is_not(None),
                User.finance_deleted.is_not(None),
            )
        )
    ).all()

    for user_id, entries_raw, budget_raw, deleted_raw in legacy:
        counters["users"] += 1
        if _has_finance_rows(conn, user_id):
            counters["skipped"] += 1
            continue

        rows: list[dict[str, Any]] = []
        seen: set[str] = set()
        for entry in parse_finance_entries(entries_raw):
            if entry["id"] in seen:
                # The JSON list never deduplicated; a unique column cannot hold
                # both copies, so the first one (the visible one) wins.
                counters["duplicates"] += 1
                continue
            seen.add(entry["id"])
            rows.append(
                {
                    "user_id": user_id,
                    "client_id": entry["id"],
                    "entry_type": entry["type"],
                    "label": entry["label"],
                    "amount": _money(entry["amount"]),
                    "entry_date": date.fromisoformat(entry["date"]),
                    "category": entry.get("category"),
                    "position": len(rows),
                }
            )
        if rows:
            conn.execute(insert(FinanceEntry), rows)
            counters["entries"] += len(rows)

        budget = parse_finance_budget(budget_raw)
        if budget is not None:
            conn.execute(
                insert(FinanceSettings).values(
                    user_id=user_id, monthly_budget=_money(budget)
                )
            )
            counters["budgets"] += 1

        for client_id, stamp in parse_finance_tombstones(deleted_raw).items():
            try:
                deleted_at = datetime.fromtimestamp(stamp, tz=timezone.utc).replace(tzinfo=None)
            except (OverflowError, OSError, ValueError):
                # A stamp no calendar can express: the API's prune would drop it
                # too, so it is counted rather than aborting the migration.
                counters["dropped"] += 1
                continue
            conn.execute(
                insert(FinanceDeletedEntry).values(
                    user_id=user_id, client_id=client_id, deleted_at=deleted_at
                )
            )
            counters["tombstones"] += 1

    logger.info(
        "finance backfill: users=%(users)s entries=%(entries)s budgets=%(budgets)s "
        "tombstones=%(tombstones)s duplicates=%(duplicates)s dropped=%(dropped)s "
        "skipped=%(skipped)s",
        counters,
    )
    return counters


def rebuild_finance_json(conn: Connection) -> dict[str, int]:
    """Write the tables back into ``users.finance_*``; returns counters.

    The downgrade path: rows written after the deploy exist only in the tables,
    so rolling the revision back must first put them where the old code reads.
    """
    # ``users`` counts the accounts written, which is every account: an empty
    # list has to overwrite the old column too, for the reason above.
    counters = {"users": 0, "entries": 0, "budgets": 0, "tombstones": 0}

    for user_id in _all_user_ids(conn):
        entries = conn.execute(
            select(
                FinanceEntry.client_id,
                FinanceEntry.entry_type,
                FinanceEntry.label,
                FinanceEntry.amount,
                FinanceEntry.entry_date,
                FinanceEntry.category,
            )
            .where(FinanceEntry.user_id == user_id)
            .order_by(FinanceEntry.position, FinanceEntry.id)
        ).all()

        # ``serialize_finance_entries`` is the exact function that wrote this
        # column before the migration, so floats keep the JSON shape identical
        # (its validator rejects Decimal, which is what SQLite returns here).
        payload = [
            {
                "id": row.client_id,
                "type": row.entry_type,
                "label": row.label,
                "amount": float(row.amount),
                "date": row.entry_date.isoformat(),
                "category": row.category,
            }
            for row in entries
        ]

        budget = conn.execute(
            select(FinanceSettings.monthly_budget).where(FinanceSettings.user_id == user_id)
        ).first()
        tombstones = conn.execute(
            select(FinanceDeletedEntry.client_id, FinanceDeletedEntry.deleted_at)
            .where(FinanceDeletedEntry.user_id == user_id)
            .order_by(FinanceDeletedEntry.deleted_at.desc())
        ).all()

        conn.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                # An account with nothing left reads as "never used", which is
                # what NULL already meant.
                finance_entries=serialize_finance_entries(payload) if payload else None,
                finance_budget=(
                    serialize_finance_budget(float(budget.monthly_budget))
                    if budget is not None and budget.monthly_budget is not None
                    else None
                ),
                finance_deleted=serialize_finance_tombstones(
                    {row.client_id: _unix_seconds(row.deleted_at) for row in tombstones}
                ),
            )
        )

        counters["users"] += 1
        counters["entries"] += len(payload)
        if budget is not None and budget.monthly_budget is not None:
            counters["budgets"] += 1
        counters["tombstones"] += len(tombstones)

    logger.info(
        "finance rebuild: users=%(users)s entries=%(entries)s budgets=%(budgets)s "
        "tombstones=%(tombstones)s",
        counters,
    )
    return counters


# ── The endpoint-facing service ──────────────────────────────────────────────


@dataclass(frozen=True)
class FinanceState:
    """One account's finance widget state, in the API's response shape."""

    entries: list[dict[str, Any]]
    budget: float | None
    deleted_ids: list[str]


def _entry_payload(row: FinanceEntry) -> dict[str, Any]:
    """A stored row as the API returns it — no ``category`` key when unset."""
    payload: dict[str, Any] = {
        "id": row.client_id,
        "type": row.entry_type,
        "label": row.label,
        "amount": float(row.amount),
        "date": row.entry_date.isoformat(),
    }
    if row.category:
        payload["category"] = row.category
    return payload


def _normalise(
    entries: Iterable[Any], budget: float | None
) -> tuple[list[dict[str, Any]], float | None]:
    """Clean a request with the serialiser that used to write the column.

    The JSON path ran every save through ``serialize_finance_entries`` and every
    read through ``parse_finance_entries``; keeping that round trip means the
    stored and returned values are unchanged (label/category trimmed, amount
    rounded to cents, unusable rows dropped) without a second validator drifting
    from the first. A duplicate id collapses to its first occurrence, which is
    the one rule the unique column forces and the only observable difference.
    """
    parsed = parse_finance_entries(serialize_finance_entries(entries))
    unique: dict[str, dict[str, Any]] = {}
    for entry in parsed:
        unique.setdefault(entry["id"], entry)
    return list(unique.values()), parse_finance_budget(serialize_finance_budget(budget))


class FinanceService:
    """Read and replace one account's finance rows.

    ``replace`` writes inside the caller's transaction and never commits, so the
    rows, the budget, the tombstones and the ``profile_version`` bump either all
    land or none of them do.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def read(self, user_id: int) -> FinanceState:
        """The account's entries in stored order, budget and live tombstones."""
        rows = (
            await self.db.execute(
                select(FinanceEntry)
                .where(FinanceEntry.user_id == user_id)
                .order_by(FinanceEntry.position, FinanceEntry.id)
            )
        ).scalars()

        budget = (
            await self.db.execute(
                select(FinanceSettings.monthly_budget).where(
                    FinanceSettings.user_id == user_id
                )
            )
        ).scalar_one_or_none()

        # Read-time pruning, as before: expired stamps and anything beyond the
        # cap are simply not answered (the next write drops them for good). The
        # upper bound allows the rest of the current second, otherwise a stamp
        # carrying microseconds would be hidden until the clock ticked over.
        now = _now_seconds()
        tombstones = (
            await self.db.execute(
                select(FinanceDeletedEntry.client_id)
                .where(
                    FinanceDeletedEntry.user_id == user_id,
                    FinanceDeletedEntry.deleted_at
                    >= _from_unix(now - FINANCE_TOMBSTONE_TTL_SECONDS),
                    FinanceDeletedEntry.deleted_at < _from_unix(now + 1),
                )
                .order_by(
                    FinanceDeletedEntry.deleted_at.desc(), FinanceDeletedEntry.client_id
                )
                .limit(MAX_FINANCE_TOMBSTONES)
            )
        ).scalars()

        return FinanceState(
            entries=[_entry_payload(row) for row in rows],
            budget=float(budget) if budget is not None else None,
            deleted_ids=list(tombstones),
        )

    async def replace(
        self,
        user_id: int,
        entries: Iterable[Any],
        budget: float | None,
        deleted_ids: Iterable[str],
        *,
        now: int | None = None,
    ) -> FinanceState:
        """Replace the whole list, the budget and the tombstones together.

        The payload is the complete state, so a row missing from it is deleted;
        ``deleted_ids`` leave tombstones (a stale device cannot write them back)
        except for ids that arrive in ``entries`` — an undo, which wins over the
        old deletion.
        """
        stamp = _now_seconds() if now is None else now
        kept, stored_budget = _normalise(entries, budget)

        existing = {
            row.client_id: row
            for row in (
                await self.db.execute(
                    select(FinanceEntry).where(FinanceEntry.user_id == user_id)
                )
            ).scalars()
        }

        wanted = {entry["id"] for entry in kept}
        for client_id, row in existing.items():
            if client_id not in wanted:
                await self.db.delete(row)

        for position, entry in enumerate(kept):
            values = {
                "entry_type": entry["type"],
                "label": entry["label"],
                "amount": _money(entry["amount"]),
                "entry_date": date.fromisoformat(entry["date"]),
                "category": entry.get("category"),
                "position": position,
            }
            stored_row = existing.get(entry["id"])
            if stored_row is None:
                self.db.add(
                    FinanceEntry(user_id=user_id, client_id=entry["id"], **values)
                )
                continue
            for field, value in values.items():
                setattr(stored_row, field, value)

        await self._replace_budget(user_id, stored_budget)
        tombstones = await self._replace_tombstones(user_id, deleted_ids, wanted, stamp)

        await self.db.flush()
        return FinanceState(
            entries=kept, budget=stored_budget, deleted_ids=list(tombstones)
        )

    async def _replace_budget(self, user_id: int, budget: float | None) -> None:
        """Upsert the settings row; unset (or 0, "clear it") removes it."""
        row = await self.db.get(FinanceSettings, user_id)
        if budget is None:
            if row is not None:
                await self.db.delete(row)
            return
        if row is None:
            self.db.add(FinanceSettings(user_id=user_id, monthly_budget=_money(budget)))
        else:
            row.monthly_budget = _money(budget)

    async def _replace_tombstones(
        self,
        user_id: int,
        deleted_ids: Iterable[str],
        kept_ids: set[str],
        now: int,
    ) -> dict[str, int]:
        """Apply the old tombstone rules against the rows, and return what is live."""
        rows = {
            row.client_id: row
            for row in (
                await self.db.execute(
                    select(FinanceDeletedEntry).where(
                        FinanceDeletedEntry.user_id == user_id
                    )
                )
            ).scalars()
        }
        stamps = {client_id: _unix_seconds(row.deleted_at) for client_id, row in rows.items()}

        for deleted_id in deleted_ids:
            # Same trimming ``parse_finance_tombstones`` did: the column is 64
            # characters, and a longer id must not fail the write on Postgres.
            client_id = deleted_id.strip()[:64]
            if client_id and client_id not in kept_ids:
                stamps[client_id] = now
        for kept_id in kept_ids:
            stamps.pop(kept_id, None)

        pruned = prune_finance_tombstones(stamps, now=now)
        for client_id, row in rows.items():
            if client_id not in pruned:
                await self.db.delete(row)
        for client_id, stamp in pruned.items():
            stored_row = rows.get(client_id)
            if stored_row is None:
                self.db.add(
                    FinanceDeletedEntry(
                        user_id=user_id,
                        client_id=client_id,
                        deleted_at=_from_unix(stamp),
                    )
                )
            elif stamps[client_id] != _unix_seconds(stored_row.deleted_at):
                stored_row.deleted_at = _from_unix(stamp)
        return pruned
