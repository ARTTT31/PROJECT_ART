"""Backfill and rebuild for the finance table migration (plan Task 1).

The move off the JSON columns is only safe if a row the API used to return can
be written into the new tables and read back identical. These tests drive the
two helpers against a synchronous SQLite engine — the same kind of connection
Alembic hands a revision through ``op.get_bind()``.
"""

import json
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, delete, insert, select

from app.core.personal_lists import (
    parse_finance_budget,
    parse_finance_entries,
    parse_finance_tombstones,
)
from app.models.base import Base
from app.models.finance import FinanceDeletedEntry, FinanceEntry, FinanceSettings
from app.models.user import User
from app.services.finance_service import backfill_finance_from_json, rebuild_finance_json

LEGACY_ENTRIES = [
    {"id": "f1", "type": "income", "label": "ขายของ", "amount": 1250.5, "date": "2026-10-29"},
    {
        "id": "f2",
        "type": "expense",
        "label": "ค่ากาแฟ",
        # Written by an older build: the amount was a string.
        "amount": "85",
        "date": "2026-10-29",
        "category": "อาหาร",
    },
]


@pytest.fixture
def conn():
    """A synchronous in-memory database built from the models."""
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with engine.connect() as connection:
        yield connection
    engine.dispose()


def _add_user(conn, email, *, entries=None, budget=None, deleted=None) -> int:
    """Insert a raw legacy account, bypassing the API."""
    result = conn.execute(
        insert(User).values(
            email=email,
            name="Legacy",
            hashed_password="x",
            finance_entries=entries,
            finance_budget=budget,
            finance_deleted=deleted,
        )
    )
    return result.inserted_primary_key[0]


def _rows(conn, user_id):
    # ``select(Model)`` on a plain Connection returns raw column rows rather than
    # ORM instances, so the table itself is selected here.
    return conn.execute(
        select(FinanceEntry.__table__)
        .where(FinanceEntry.user_id == user_id)
        .order_by(FinanceEntry.position)
    ).all()


def test_backfill_writes_what_the_api_used_to_return(conn):
    raw = json.dumps(LEGACY_ENTRIES)
    user_id = _add_user(conn, "one@example.com", entries=raw)

    counters = backfill_finance_from_json(conn)

    rows = _rows(conn, user_id)
    expected = parse_finance_entries(raw)
    assert [row.client_id for row in rows] == [entry["id"] for entry in expected]
    assert [row.entry_type for row in rows] == [entry["type"] for entry in expected]
    assert [row.label for row in rows] == [entry["label"] for entry in expected]
    assert [float(row.amount) for row in rows] == [entry["amount"] for entry in expected]
    assert [row.entry_date.isoformat() for row in rows] == [entry["date"] for entry in expected]
    # No category on the first row, a real one on the second.
    assert [row.category for row in rows] == [entry.get("category") for entry in expected]
    assert counters["entries"] == 2


def test_backfill_preserves_the_list_order(conn):
    raw = json.dumps(
        [
            {"id": "c", "type": "expense", "label": "", "amount": 3, "date": "2026-10-30"},
            {"id": "a", "type": "expense", "label": "", "amount": 1, "date": "2026-10-30"},
            {"id": "b", "type": "expense", "label": "", "amount": 2, "date": "2026-10-30"},
        ]
    )
    user_id = _add_user(conn, "order@example.com", entries=raw)

    backfill_finance_from_json(conn)

    rows = _rows(conn, user_id)
    # Same-day entries keep the order the client sent, not date or id order.
    assert [row.client_id for row in rows] == ["c", "a", "b"]
    assert [row.position for row in rows] == [0, 1, 2]


def test_duplicate_client_ids_keep_the_first_occurrence(conn):
    """The JSON list never deduped; a unique column cannot hold both rows."""
    raw = json.dumps(
        [
            {"id": "dup", "type": "income", "label": "first", "amount": 10, "date": "2026-10-29"},
            {"id": "dup", "type": "income", "label": "second", "amount": 20, "date": "2026-10-29"},
        ]
    )
    user_id = _add_user(conn, "dup@example.com", entries=raw)

    counters = backfill_finance_from_json(conn)

    rows = _rows(conn, user_id)
    assert counters["duplicates"] == 1
    assert [(row.client_id, row.label, float(row.amount)) for row in rows] == [("dup", "first", 10.0)]


def test_corrupt_json_reads_as_empty_without_raising(conn):
    user_id = _add_user(conn, "corrupt@example.com", entries="{not valid json")

    counters = backfill_finance_from_json(conn)

    assert counters["entries"] == 0
    assert _rows(conn, user_id) == []


def test_untouched_accounts_are_not_scanned(conn):
    _add_user(conn, "empty@example.com")

    counters = backfill_finance_from_json(conn)

    assert counters["users"] == 0
    assert counters["entries"] == 0


def test_backfill_is_idempotent(conn):
    user_id = _add_user(conn, "twice@example.com", entries=json.dumps(LEGACY_ENTRIES))

    first = backfill_finance_from_json(conn)
    second = backfill_finance_from_json(conn)

    assert first["entries"] == 2
    assert second["entries"] == 0
    assert second["skipped"] == 1
    assert len(_rows(conn, user_id)) == 2


def test_backfill_copies_the_budget_and_tombstones(conn):
    user_id = _add_user(
        conn,
        "budget@example.com",
        entries=json.dumps(LEGACY_ENTRIES),
        budget=json.dumps({"monthly": 15000}),
        deleted=json.dumps({"f9": 1_762_000_000}),
    )

    counters = backfill_finance_from_json(conn)

    settings = conn.execute(
        select(FinanceSettings.__table__).where(FinanceSettings.user_id == user_id)
    ).one()
    tombstones = conn.execute(
        select(FinanceDeletedEntry.__table__).where(
            FinanceDeletedEntry.user_id == user_id
        )
    ).all()
    assert float(settings.monthly_budget) == 15000
    assert counters["budgets"] == 1
    assert counters["tombstones"] == 1
    # Stored as naive UTC, handed back to the API as the same unix seconds.
    stamp = int(tombstones[0].deleted_at.replace(tzinfo=timezone.utc).timestamp())
    assert (tombstones[0].client_id, stamp) == ("f9", 1_762_000_000)


def test_rebuild_restores_the_json_columns(conn):
    raw = json.dumps(LEGACY_ENTRIES)
    user_id = _add_user(
        conn,
        "rebuild@example.com",
        entries=raw,
        budget=json.dumps({"monthly": 15000}),
    )
    backfill_finance_from_json(conn)

    rebuild_finance_json(conn)

    row = conn.execute(
        select(User.finance_entries, User.finance_budget, User.finance_deleted).where(
            User.id == user_id
        )
    ).one()
    assert parse_finance_entries(row.finance_entries) == parse_finance_entries(raw)
    assert parse_finance_budget(row.finance_budget) == 15000
    assert parse_finance_tombstones(row.finance_deleted) == {}


def test_rebuild_writes_rows_created_after_the_migration(conn):
    """A downgrade must not lose what only ever existed in the tables."""
    user_id = _add_user(conn, "after@example.com", entries=json.dumps(LEGACY_ENTRIES))
    backfill_finance_from_json(conn)

    conn.execute(delete(FinanceEntry).where(FinanceEntry.user_id == user_id))
    conn.execute(
        insert(FinanceEntry).values(
            user_id=user_id,
            client_id="brand-new",
            entry_type="expense",
            label="created in a table",
            amount=Decimal("12.34"),
            entry_date=datetime(2026, 11, 27).date(),
            category=None,
            position=0,
        )
    )

    rebuild_finance_json(conn)

    entries = (
        conn.execute(select(User.finance_entries).where(User.id == user_id)).scalar_one()
    )
    assert parse_finance_entries(entries) == [
        {
            "id": "brand-new",
            "type": "expense",
            "label": "created in a table",
            "amount": 12.34,
            "date": "2026-11-27",
        }
    ]


def test_rebuild_clears_an_emptied_account(conn):
    user_id = _add_user(conn, "cleared@example.com", entries=json.dumps(LEGACY_ENTRIES))
    backfill_finance_from_json(conn)
    conn.execute(delete(FinanceEntry).where(FinanceEntry.user_id == user_id))

    rebuild_finance_json(conn)

    entries = (
        conn.execute(select(User.finance_entries).where(User.id == user_id)).scalar_one()
    )
    assert parse_finance_entries(entries) == []
