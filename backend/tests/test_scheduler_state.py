import pytest

from app.services.scheduler_state import claim_slot

pytestmark = pytest.mark.asyncio


async def test_claim_slot_is_exclusive_per_window(db_session):
    assert await claim_slot(db_session, "unit", "2026-11-09T17") is True
    # A restart or a second instance asking for the same window loses.
    assert await claim_slot(db_session, "unit", "2026-11-09T17") is False
    # The next window is claimable again.
    assert await claim_slot(db_session, "unit", "2026-11-09T18") is True


async def test_claim_slots_are_independent(db_session):
    assert await claim_slot(db_session, "daily_summary", "2026-11-09T08") is True
    assert await claim_slot(db_session, "market_alert", "2026-11-09T08") is True
