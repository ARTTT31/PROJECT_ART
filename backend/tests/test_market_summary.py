"""Tests for the dashboard market summary endpoint (/market/summary)."""

from datetime import timedelta

import pytest

from app.api.v1.endpoints import market
from app.core.utils import utcnow

CURRENCY_PAYLOAD = {
    "source": "exchangerate-api.com",
    "updated_at": "Wed, 28 Oct 2026 00:02:31 +0000",
    "rates": [{"code": "USD", "name": "ดอลลาร์สหรัฐ", "unit": 1, "thb": 32.6}],
}
GOLD_PAYLOAD = {
    "source": "สมาคมค้าทองคำ",
    "updated_at": "28/10/2569 เวลา 15:45 น.",
    "buy": 64600.0,
    "sell": 64800.0,
}
SET_PAYLOAD = {
    "source": "SET (Yahoo Finance)",
    "updated_at": "2026-10-28T15:40:00+07:00",
    "value": 1568.19,
    "change": -6.83,
    "change_percent": -0.43,
}


@pytest.fixture(autouse=True)
def clear_market_cache():
    market.reset_cache()
    yield
    market.reset_cache()


def _patch_sources(monkeypatch, *, currency=None, gold=None, set_index=None):
    async def _currency():
        if isinstance(currency, Exception):
            raise currency
        return currency

    async def _gold():
        if isinstance(gold, Exception):
            raise gold
        return gold

    async def _set_index():
        if isinstance(set_index, Exception):
            raise set_index
        return set_index

    monkeypatch.setattr(market, "_fetch_currency", _currency)
    monkeypatch.setattr(market, "_fetch_gold", _gold)
    monkeypatch.setattr(market, "_fetch_set_index", _set_index)


@pytest.mark.asyncio
async def test_market_summary_requires_auth(client):
    assert (await client.get("/api/v1/market/summary")).status_code == 401


@pytest.mark.asyncio
async def test_returns_all_three_blocks(client, logged_in_user, monkeypatch):
    _patch_sources(
        monkeypatch,
        currency=CURRENCY_PAYLOAD,
        gold=GOLD_PAYLOAD,
        set_index=SET_PAYLOAD,
    )

    response = await client.get("/api/v1/market/summary")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["currency"]["rates"][0]["code"] == "USD"
    assert body["gold"]["sell"] == 64800.0
    assert body["set_index"]["value"] == 1568.19
    assert body["is_stale"] is False


@pytest.mark.asyncio
async def test_one_failing_source_leaves_the_others(client, logged_in_user, monkeypatch):
    _patch_sources(
        monkeypatch,
        currency=CURRENCY_PAYLOAD,
        gold=RuntimeError("gold provider down"),
        set_index=SET_PAYLOAD,
    )

    body = (await client.get("/api/v1/market/summary")).json()
    assert body["gold"] is None
    assert body["currency"]["rates"][0]["code"] == "USD"
    assert body["set_index"]["value"] == 1568.19


@pytest.mark.asyncio
async def test_expired_entry_is_served_stale_when_the_source_fails(
    client, logged_in_user, monkeypatch
):
    # An entry older than GOLD_TTL that can no longer be refreshed.
    market._CACHE["gold"] = (utcnow() - timedelta(hours=2), GOLD_PAYLOAD)
    _patch_sources(
        monkeypatch,
        currency=CURRENCY_PAYLOAD,
        gold=RuntimeError("timeout"),
        set_index=SET_PAYLOAD,
    )

    body = (await client.get("/api/v1/market/summary")).json()
    assert body["gold"]["buy"] == 64600.0
    assert body["is_stale"] is True


@pytest.mark.asyncio
async def test_fresh_entry_does_not_call_the_provider(
    client, logged_in_user, monkeypatch
):
    calls = {"gold": 0}

    async def _gold():
        calls["gold"] += 1
        return GOLD_PAYLOAD

    _patch_sources(
        monkeypatch, currency=CURRENCY_PAYLOAD, gold=GOLD_PAYLOAD, set_index=SET_PAYLOAD
    )
    monkeypatch.setattr(market, "_fetch_gold", _gold)

    await client.get("/api/v1/market/summary")
    await client.get("/api/v1/market/summary")
    assert calls["gold"] == 1


def test_currency_rows_invert_the_rate(monkeypatch):
    """The provider quotes THB→foreign, the widget shows THB per unit."""
    import asyncio

    class _Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "time_last_update_utc": "now",
                "rates": {"USD": 0.03125, "JPY": 4.7},
            }

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url):
            return _Response()

    monkeypatch.setattr(market.httpx, "AsyncClient", _Client)

    payload = asyncio.run(market._fetch_currency())
    usd = next(row for row in payload["rates"] if row["code"] == "USD")
    jpy = next(row for row in payload["rates"] if row["code"] == "JPY")

    assert usd["thb"] == 32.0
    # Quoted per 100 yen, like a bank board.
    assert jpy["unit"] == 100
    assert jpy["thb"] == 21.28
