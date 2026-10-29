"""Tests for the dashboard market summary endpoint (/market/summary)."""

from datetime import timedelta

import pytest

from app.api.v1.endpoints import market
from app.core.utils import utcnow

FRANKFURTER_PAYLOAD = {
    "id": "frankfurter",
    "source": "Frankfurter · blended central-bank rates",
    "updated_at": "2026-10-28",
    "rates": [{"code": "USD", "name": "ดอลลาร์สหรัฐ", "unit": 1, "thb": 33.77}],
}
ECB_PAYLOAD = {
    **FRANKFURTER_PAYLOAD,
    "id": "ecb",
    "source": "Frankfurter · ECB",
}
GOLD_PAYLOAD = {
    "id": "thai_gold",
    "source": "สมาคมค้าทองคำ · ทองคำแท่ง 96.5%",
    "market": "ทองคำแท่งไทย 96.5% · บาททองคำ",
    "updated_at": "28/10/2569 เวลา 15:45 น.",
    "buy": 64600.0,
    "sell": 64800.0,
}
GOLD_FUTURES_PAYLOAD = {
    "id": "comex_gold",
    "source": "Yahoo Finance · COMEX Gold Futures (GC=F)",
    "market": "COMEX Gold Futures · USD/oz · อาจมีความล่าช้า",
    "updated_at": "2026-10-28T15:40:00+07:00",
    "value": 4062.3,
    "change": 54.4,
    "change_percent": 1.36,
    "currency": "USD",
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


def _patch_sources(
    monkeypatch,
    *,
    currency=FRANKFURTER_PAYLOAD,
    ecb=ECB_PAYLOAD,
    gold=GOLD_PAYLOAD,
    gold_futures=GOLD_FUTURES_PAYLOAD,
    set_index=SET_PAYLOAD,
):
    def source_loader(payload):
        async def _load():
            if isinstance(payload, Exception):
                raise payload
            return payload

        return _load

    monkeypatch.setattr(market, "_fetch_currency", source_loader(currency))
    monkeypatch.setattr(market, "_fetch_currency_ecb", source_loader(ecb))
    monkeypatch.setattr(market, "_fetch_gold", source_loader(gold))
    monkeypatch.setattr(market, "_fetch_gold_futures", source_loader(gold_futures))
    monkeypatch.setattr(market, "_fetch_set_index", source_loader(set_index))


@pytest.mark.asyncio
async def test_market_summary_requires_auth(client):
    assert (await client.get("/api/v1/market/summary")).status_code == 401


@pytest.mark.asyncio
async def test_returns_all_three_blocks(client, logged_in_user, monkeypatch):
    _patch_sources(
        monkeypatch,
        currency=FRANKFURTER_PAYLOAD,
        gold=GOLD_PAYLOAD,
        set_index=SET_PAYLOAD,
    )

    response = await client.get("/api/v1/market/summary")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["currency"]["rates"][0]["code"] == "USD"
    assert {source["id"] for source in body["currency_sources"]} == {
        "frankfurter",
        "ecb",
    }
    assert {source["id"] for source in body["gold_sources"]} == {"thai_gold", "comex_gold"}
    assert body["gold"]["sell"] == 64800.0
    assert body["set_index"]["value"] == 1568.19
    assert body["is_stale"] is False


@pytest.mark.asyncio
async def test_one_failing_source_leaves_the_others(client, logged_in_user, monkeypatch):
    _patch_sources(
        monkeypatch,
        gold=RuntimeError("gold provider down"),
        gold_futures=RuntimeError("futures provider down"),
    )

    body = (await client.get("/api/v1/market/summary")).json()
    assert body["gold"] is None
    assert body["gold_sources"] == []
    assert body["currency"]["rates"][0]["code"] == "USD"
    assert body["set_index"]["value"] == 1568.19


@pytest.mark.asyncio
async def test_expired_entry_is_served_stale_when_the_source_fails(
    client, logged_in_user, monkeypatch
):
    # An entry older than GOLD_TTL that can no longer be refreshed.
    market._CACHE["gold:thai_gold"] = (utcnow() - timedelta(hours=2), GOLD_PAYLOAD)
    _patch_sources(monkeypatch, gold=RuntimeError("timeout"))

    body = (await client.get("/api/v1/market/summary")).json()
    thai_gold = next(source for source in body["gold_sources"] if source["id"] == "thai_gold")
    assert thai_gold["buy"] == 64600.0
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
        monkeypatch, currency=FRANKFURTER_PAYLOAD, gold=GOLD_PAYLOAD, set_index=SET_PAYLOAD
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
            return [
                {"date": "2026-10-28", "base": "THB", "quote": "USD", "rate": 0.03125},
                {"date": "2026-10-28", "base": "THB", "quote": "JPY", "rate": 4.7},
            ]

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None):
            return _Response()

    monkeypatch.setattr(market.httpx, "AsyncClient", _Client)

    payload = asyncio.run(market._fetch_currency())
    usd = next(row for row in payload["rates"] if row["code"] == "USD")
    jpy = next(row for row in payload["rates"] if row["code"] == "JPY")

    assert payload["id"] == "frankfurter"
    assert usd["thb"] == 32.0
    # Quoted per 100 yen, like a bank board.
    assert jpy["unit"] == 100
    assert jpy["thb"] == 21.28


def test_frankfurter_rows_and_provider_selection(monkeypatch):
    import asyncio

    requested = []

    class _Response:
        def raise_for_status(self):
            return None

        def json(self):
            return [
                {"date": "2026-10-28", "base": "THB", "quote": "USD", "rate": 0.02961},
                {"date": "2026-10-28", "base": "THB", "quote": "JPY", "rate": 4.67},
            ]

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url, params=None):
            requested.append((url, params))
            return _Response()

    monkeypatch.setattr(market.httpx, "AsyncClient", _Client)

    blended = asyncio.run(market._fetch_currency())
    ecb = asyncio.run(market._fetch_currency_ecb())

    assert blended["id"] == "frankfurter"
    assert ecb["id"] == "ecb"
    assert next(row for row in blended["rates"] if row["code"] == "USD")["thb"] == 33.77
    assert requested[0][1]["base"] == "THB"
    assert requested[1][1]["providers"] == "ecb"


# ═══════════════════════════════════════════════════════════════════════════════
# Candles — the chart is drawn in-app, so the proxy has to hand back real bars.
# ═══════════════════════════════════════════════════════════════════════════════
CANDLE_PAYLOAD = {
    "symbol": "gold",
    "label": "ทองคำ COMEX · USD/oz",
    "interval": "1d",
    "updated_at": "2026-10-28T15:40:00+07:00",
    "points": [
        {"t": "2026-10-27T00:00:00+07:00", "o": 4000.0, "h": 4050.0, "l": 3980.0, "c": 4040.0},
        {"t": "2026-10-28T00:00:00+07:00", "o": 4040.0, "h": 4090.0, "l": 4020.0, "c": 4025.0},
    ],
}


@pytest.mark.asyncio
async def test_candles_require_auth(client):
    assert (await client.get("/api/v1/market/candles?symbol=gold")).status_code == 401


@pytest.mark.asyncio
async def test_candles_reject_an_unknown_symbol(client, logged_in_user):
    """The whitelist is what stops this being an open relay to Yahoo."""
    response = await client.get("/api/v1/market/candles?symbol=DOGEUSDT")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_candles_return_bars(client, logged_in_user, monkeypatch):
    async def _load(symbol, interval):
        assert symbol == "gold"
        assert interval == "1d"
        return CANDLE_PAYLOAD

    monkeypatch.setattr(market, "_fetch_candles", _load)

    response = await client.get("/api/v1/market/candles?symbol=gold&interval=1d")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["symbol"] == "gold"
    assert body["source"] == "Yahoo Finance"
    assert [point["c"] for point in body["points"]] == [4040.0, 4025.0]


@pytest.mark.asyncio
async def test_candles_fall_back_to_daily_for_an_unknown_interval(
    client, logged_in_user, monkeypatch
):
    seen = {}

    async def _load(symbol, interval):
        seen["interval"] = interval
        return CANDLE_PAYLOAD

    monkeypatch.setattr(market, "_fetch_candles", _load)

    response = await client.get("/api/v1/market/candles?symbol=gold&interval=5y")
    assert response.status_code == 200
    assert seen["interval"] == "1d"


@pytest.mark.asyncio
async def test_candles_report_an_unavailable_source(client, logged_in_user, monkeypatch):
    async def _load(symbol, interval):
        raise RuntimeError("yahoo down")

    monkeypatch.setattr(market, "_fetch_candles", _load)

    response = await client.get("/api/v1/market/candles?symbol=USD&interval=1d")
    assert response.status_code == 503
