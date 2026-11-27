"""FinanceService — the table write path behind ``GET/PUT /profile/finance``.

The endpoint tests in ``test_finance_watchlist`` prove the HTTP contract did not
move; these cover the rules a request cannot reach in isolation (diffing rows,
the cap, the budget row, tombstone revival) and the per-account isolation that a
single signed-in client never exercises.
"""

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.core.personal_lists import (
    FINANCE_TOMBSTONE_TTL_SECONDS,
    MAX_FINANCE_ENTRIES,
    MAX_FINANCE_TOMBSTONES,
)
from app.models.finance import FinanceDeletedEntry, FinanceEntry, FinanceSettings
from app.services.finance_service import FinanceService

ENTRIES = [
    {"id": "f1", "type": "income", "label": "ขายของ", "amount": 1250.5, "date": "2026-10-29"},
    {"id": "f2", "type": "expense", "label": "ค่ากาแฟ", "amount": 85, "date": "2026-10-29"},
]


async def _replace(db_session, user_id, entries, budget=None, deleted_ids=(), now=None):
    return await FinanceService(db_session).replace(
        user_id, entries, budget, deleted_ids, now=now
    )


async def _count(db_session, model) -> int:
    return int(
        (await db_session.execute(select(func.count()).select_from(model))).scalar_one()
    )


async def _rows(db_session, user_id):
    return list(
        (
            await db_session.execute(
                select(FinanceEntry)
                .where(FinanceEntry.user_id == user_id)
                .order_by(FinanceEntry.position)
            )
        ).scalars()
    )


@pytest.mark.asyncio
async def test_replace_updates_an_existing_row_in_place(db_session, make_user):
    user = await make_user()
    await _replace(db_session, user.id, ENTRIES)

    edited = [dict(ENTRIES[0], amount=999.99, label="ขายของ (แก้ไข)"), ENTRIES[1]]
    state = await _replace(db_session, user.id, edited)
    await db_session.commit()

    rows = await _rows(db_session, user.id)
    assert [row.client_id for row in rows] == ["f1", "f2"]
    assert float(rows[0].amount) == 999.99
    assert rows[0].label == "ขายของ (แก้ไข)"
    assert state.entries[0]["amount"] == 999.99


@pytest.mark.asyncio
async def test_replace_deletes_rows_missing_from_the_payload(db_session, make_user):
    user = await make_user()
    await _replace(db_session, user.id, ENTRIES)

    await _replace(db_session, user.id, [ENTRIES[0]])
    await db_session.commit()

    assert [row.client_id for row in await _rows(db_session, user.id)] == ["f1"]


@pytest.mark.asyncio
async def test_read_keeps_the_order_the_list_was_sent_in(db_session, make_user):
    """Same-day entries must come back in payload order, not date or id order."""
    user = await make_user()
    same_day = [
        {"id": "c", "type": "expense", "label": "", "amount": 3, "date": "2026-10-30"},
        {"id": "a", "type": "expense", "label": "", "amount": 1, "date": "2026-10-30"},
        {"id": "b", "type": "expense", "label": "", "amount": 2, "date": "2026-10-30"},
    ]
    await _replace(db_session, user.id, same_day)
    await db_session.commit()

    state = await FinanceService(db_session).read(user.id)

    assert [entry["id"] for entry in state.entries] == ["c", "a", "b"]


@pytest.mark.asyncio
async def test_replace_caps_the_list_at_the_entry_limit(db_session, make_user):
    user = await make_user()
    over_cap = [
        {"id": f"f{index}", "type": "income", "label": "", "amount": 1, "date": "2026-10-29"}
        for index in range(MAX_FINANCE_ENTRIES + 5)
    ]

    state = await _replace(db_session, user.id, over_cap)
    await db_session.commit()

    assert len(state.entries) == MAX_FINANCE_ENTRIES
    assert await _count(db_session, FinanceEntry) == MAX_FINANCE_ENTRIES


@pytest.mark.asyncio
async def test_replace_clears_the_budget_row(db_session, make_user):
    user = await make_user()
    await _replace(db_session, user.id, ENTRIES, budget=12000)
    await db_session.commit()
    assert await _count(db_session, FinanceSettings) == 1

    # No budget is "delete the row", not "store a null budget"; 0 means the same.
    state = await _replace(db_session, user.id, ENTRIES, budget=None)
    await db_session.commit()
    assert state.budget is None
    assert await _count(db_session, FinanceSettings) == 0

    await _replace(db_session, user.id, ENTRIES, budget=5000)
    await db_session.commit()
    await _replace(db_session, user.id, ENTRIES, budget=0)
    await db_session.commit()
    assert await _count(db_session, FinanceSettings) == 0


@pytest.mark.asyncio
async def test_replace_revives_a_row_and_clears_its_tombstone(db_session, make_user):
    user = await make_user()
    await _replace(db_session, user.id, ENTRIES, deleted_ids=["f9"])
    await db_session.commit()

    state = await _replace(
        db_session, user.id, [ENTRIES[0]], deleted_ids=[ENTRIES[0]["id"]]
    )
    await db_session.commit()

    assert state.deleted_ids == ["f9"]
    assert [row.client_id for row in await _rows(db_session, user.id)] == ["f1"]
    stored = (await db_session.execute(select(FinanceDeletedEntry.client_id))).scalars()
    assert list(stored) == ["f9"]


@pytest.mark.asyncio
async def test_tombstones_are_pruned_on_write(db_session, make_user):
    user = await make_user()
    now = 2_000_000_000
    expired = now - FINANCE_TOMBSTONE_TTL_SECONDS - 60
    db_session.add(
        FinanceDeletedEntry(
            user_id=user.id,
            client_id="ancient",
            deleted_at=datetime(1970, 1, 1) + timedelta(seconds=expired),
        )
    )
    for index in range(MAX_FINANCE_TOMBSTONES):
        db_session.add(
            FinanceDeletedEntry(
                user_id=user.id,
                client_id=f"old{index}",
                deleted_at=datetime(1970, 1, 1) + timedelta(seconds=expired),
            )
        )
    await db_session.commit()

    state = await _replace(db_session, user.id, ENTRIES, deleted_ids=["fresh"], now=now)
    await db_session.commit()

    # The expired rows are gone, and the cap keeps the newest stamp.
    assert state.deleted_ids == ["fresh"]
    stored = list(
        (await db_session.execute(select(FinanceDeletedEntry.client_id))).scalars()
    )
    assert stored == ["fresh"]


@pytest.mark.asyncio
async def test_replace_never_touches_another_accounts_rows(db_session, make_user):
    owner = await make_user()
    other = await make_user(email="second-finance@example.com", name="Second")
    await _replace(db_session, owner.id, ENTRIES, budget=12000, deleted_ids=["gone"])
    await _replace(db_session, other.id, [dict(ENTRIES[1], id="other-1")])
    await db_session.commit()

    await _replace(db_session, other.id, [], budget=None, deleted_ids=["other-1"])
    await db_session.commit()

    assert [row.client_id for row in await _rows(db_session, owner.id)] == ["f1", "f2"]
    assert [row.client_id for row in await _rows(db_session, other.id)] == []
    state = await FinanceService(db_session).read(owner.id)
    assert state.budget == 12000
    assert state.deleted_ids == ["gone"]
    assert (await FinanceService(db_session).read(other.id)).deleted_ids == ["other-1"]


@pytest.mark.asyncio
async def test_read_hides_expired_tombstones(db_session, make_user):
    user = await make_user()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_session.add_all(
        [
            FinanceDeletedEntry(
                user_id=user.id,
                client_id="expired",
                deleted_at=now - timedelta(seconds=FINANCE_TOMBSTONE_TTL_SECONDS + 60),
            ),
            FinanceDeletedEntry(user_id=user.id, client_id="live", deleted_at=now),
        ]
    )
    await db_session.commit()

    state = await FinanceService(db_session).read(user.id)

    # Recency order, as the widget's newest-first list expects.
    assert state.deleted_ids == ["live"]
    assert state.entries == []
    assert state.budget is None


@pytest.mark.asyncio
async def test_stored_amount_is_a_decimal_not_a_float(db_session, make_user):
    """Money leaves the API as a number but is stored as cents, not a float."""
    user = await make_user()
    await _replace(
        db_session,
        user.id,
        [dict(ENTRIES[0], amount=0.1 + 0.2, date=date(2026, 10, 29).isoformat())],
    )
    await db_session.commit()

    row = (await _rows(db_session, user.id))[0]
    assert str(row.amount) in ("0.30", "0.3")
