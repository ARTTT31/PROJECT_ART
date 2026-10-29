# -*- coding: utf-8 -*-
"""Market summary proxy for the dashboard widget.

The browser must not call these providers directly: it would leak the user's IP
to three third parties, trip CORS, and let any page in the app hammer them. The
proxy keeps one short-lived cache per source so a busy dashboard costs the
upstreams one request per TTL window instead of one per viewer.

Each source is fetched independently. When one provider is down the other two
still render — the failing block comes back as ``null`` (or as its last known
value, flagged ``is_stale``), never as a whole-endpoint error.
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Awaitable, Callable, Optional
from zoneinfo import ZoneInfo

import httpx
from urllib.parse import quote
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.utils import utcnow
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"

# ═══════════════════════════════════════════════════════════════════════════════
# Upstream providers (all public, no API key)
# ═══════════════════════════════════════════════════════════════════════════════
FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rates"
GOLD_URL = "https://api.chnwt.dev/thai-gold-api/latest"
GOLD_FUTURES_URL = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=5d"
SET_INDEX_URL = "https://query1.finance.yahoo.com/v8/finance/chart/%5ESET.BK?interval=1d&range=5d"
SET_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ARTWorkspace/1.0)"}

# TTLs follow how often each source actually moves: the exchange-rate feed is
# daily, gold is quoted a handful of times a day, and the index changes only
# while the market is open.
CURRENCY_TTL = 6 * 3600
GOLD_TTL = 10 * 60
SET_TTL = 5 * 60

# Codes shown on the widget, with the unit each is quoted in. The yen is quoted
# per 100 so the number stays in a readable range, like a bank board.
CURRENCIES: tuple[tuple[str, str, int], ...] = (
    ("USD", "ดอลลาร์สหรัฐ", 1),
    ("EUR", "ยูโร", 1),
    ("GBP", "ปอนด์อังกฤษ", 1),
    ("CNY", "หยวนจีน", 1),
    ("JPY", "เยนญี่ปุ่น", 100),
)

BANGKOK = ZoneInfo("Asia/Bangkok")

# key -> (fetched_at, payload)
_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}


# ═══════════════════════════════════════════════════════════════════════════════
# Cache
# ═══════════════════════════════════════════════════════════════════════════════
async def _cached(
    key: str,
    ttl: int,
    loader: Callable[[], Awaitable[dict[str, Any]]],
) -> tuple[Optional[dict[str, Any]], bool]:
    """Return ``(payload, is_stale)`` for one source.

    A fresh entry is served as-is. On expiry the loader runs; if it fails, the
    previous payload is served with ``is_stale=True`` so the widget keeps
    showing yesterday's price instead of an empty card.
    """
    entry = _CACHE.get(key)
    if entry and (utcnow() - entry[0]).total_seconds() <= ttl:
        return entry[1], False

    try:
        payload = await loader()
    except Exception:
        logger.warning("market source %s failed", key, exc_info=True)
        if entry:
            return entry[1], True
        return None, False

    _CACHE[key] = (utcnow(), payload)
    return payload, False


def reset_cache() -> None:
    """Drop every cached payload (used by tests and after a config change)."""
    _CACHE.clear()


# ═══════════════════════════════════════════════════════════════════════════════
# Providers
# ═══════════════════════════════════════════════════════════════════════════════
def _currency_rows(rates: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert provider THB→foreign quotes to the dashboard's baht units."""
    rows: list[dict[str, Any]] = []
    for code, name, unit in CURRENCIES:
        rate = rates.get(code)
        if rate:
            rows.append(
                {
                    "code": code,
                    "name": name,
                    "unit": unit,
                    "thb": round(unit / float(rate), 2),
                }
            )
    if not rows:
        raise ValueError("no supported currency rates in the payload")
    return rows


async def _fetch_frankfurter(provider: str | None = None) -> dict[str, Any]:
    """Daily blended or ECB-only central-bank reference rates."""
    params = {
        "base": "THB",
        "quotes": ",".join(code for code, _, _ in CURRENCIES),
    }
    if provider:
        params["providers"] = provider

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(FRANKFURTER_URL, params=params)
        response.raise_for_status()
        body = response.json()

    rates: dict[str, float] = {}
    updated_at = None
    for row in body:
        if isinstance(row, dict) and row.get("quote") and row.get("rate"):
            rates[row["quote"]] = float(row["rate"])
            updated_at = max(updated_at or "", str(row.get("date") or "")) or None

    return {
        "id": "ecb" if provider == "ecb" else "frankfurter",
        "source": "Frankfurter · ECB" if provider == "ecb" else "Frankfurter · blended central-bank rates",
        "updated_at": updated_at,
        "rates": _currency_rows(rates),
    }


async def _fetch_currency() -> dict[str, Any]:
    return await _fetch_frankfurter()


async def _fetch_currency_ecb() -> dict[str, Any]:
    return await _fetch_frankfurter("ecb")


async def _fetch_gold() -> dict[str, Any]:
    """Gold bar (96.5%) buy/sell price per one baht-weight."""
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(GOLD_URL)
        response.raise_for_status()
        body = response.json()

    bar = (body.get("response") or {}).get("price", {}).get("gold_bar") or {}
    buy = float(str(bar.get("buy", "")).replace(",", ""))
    sell = float(str(bar.get("sell", "")).replace(",", ""))
    if buy <= 0 or sell <= 0:
        raise ValueError("gold payload has no usable price")

    update_date = (body.get("response") or {}).get("update_date") or ""
    update_time = (body.get("response") or {}).get("update_time") or ""
    return {
        "id": "thai_gold",
        "source": "สมาคมค้าทองคำ · ทองคำแท่ง 96.5%",
        "market": "ทองคำแท่งไทย 96.5% · บาททองคำ",
        "updated_at": " ".join(part for part in (update_date, update_time) if part).strip(),
        "buy": buy,
        "sell": sell,
    }


async def _fetch_gold_futures() -> dict[str, Any]:
    """COMEX gold futures quote; distinct from Thai retail bullion/spot gold."""
    async with httpx.AsyncClient(timeout=10, headers=SET_HEADERS) as client:
        response = await client.get(GOLD_FUTURES_URL)
        response.raise_for_status()
        body = response.json()

    result = (body.get("chart") or {}).get("result") or []
    if not result:
        raise ValueError("gold futures payload has no result")
    meta = result[0].get("meta") or {}
    value = float(meta["regularMarketPrice"])
    previous = float(meta.get("chartPreviousClose") or meta.get("previousClose") or value)
    change = value - previous
    market_time = meta.get("regularMarketTime")
    updated_at = (
        datetime.fromtimestamp(int(market_time), tz=BANGKOK).isoformat()
        if market_time
        else None
    )
    return {
        "id": "comex_gold",
        "source": "Yahoo Finance · COMEX Gold Futures (GC=F)",
        "market": "COMEX Gold Futures · USD/oz · อาจมีความล่าช้า",
        "updated_at": updated_at,
        "value": round(value, 2),
        "change": round(change, 2),
        "change_percent": round((change / previous * 100) if previous else 0.0, 2),
        "currency": meta.get("currency") or "USD",
    }


async def _fetch_set_index() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10, headers=SET_HEADERS) as client:
        response = await client.get(SET_INDEX_URL)
        response.raise_for_status()
        body = response.json()

    result = (body.get("chart") or {}).get("result") or []
    if not result:
        raise ValueError("SET payload has no result")
    meta = result[0].get("meta") or {}
    value = float(meta["regularMarketPrice"])

    previous = meta.get("chartPreviousClose") or meta.get("previousClose") or value
    previous = float(previous)
    change = value - previous
    percent = (change / previous * 100) if previous else 0.0

    updated_at: Optional[str] = None
    market_time = meta.get("regularMarketTime")
    if market_time:
        updated_at = datetime.fromtimestamp(int(market_time), tz=BANGKOK).isoformat()

    return {
        "source": "SET (Yahoo Finance)",
        "updated_at": updated_at,
        "value": round(value, 2),
        "change": round(change, 2),
        "change_percent": round(percent, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Response models
# ═══════════════════════════════════════════════════════════════════════════════
class CurrencyRate(BaseModel):
    code: str
    name: str
    unit: int
    thb: float = Field(..., description="บาทต่อ 1 หน่วย (หรือต่อ `unit` หน่วย)")


class CurrencyBlock(BaseModel):
    id: str = "frankfurter"
    source: str
    updated_at: Optional[str] = None
    rates: list[CurrencyRate]


class GoldBlock(BaseModel):
    id: str = "thai_gold"
    source: str
    market: Optional[str] = None
    updated_at: Optional[str] = None
    buy: Optional[float] = None
    sell: Optional[float] = None
    value: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    currency: Optional[str] = None


class SetIndexBlock(BaseModel):
    source: str
    updated_at: Optional[str] = None
    value: float
    change: float
    change_percent: float


class MarketSummary(BaseModel):
    """Any block may be ``null``: a provider that is down must not fail the rest."""

    currency: Optional[CurrencyBlock] = None
    currency_sources: list[CurrencyBlock] = Field(default_factory=list)
    gold: Optional[GoldBlock] = None
    gold_sources: list[GoldBlock] = Field(default_factory=list)
    set_index: Optional[SetIndexBlock] = None
    fetched_at: datetime
    is_stale: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoint
# ═══════════════════════════════════════════════════════════════════════════════
# ── Watchlist quotes ─────────────────────────────────────────────────────
# One symbol = one upstream chart call, so the list is capped and every call is
# isolated: a delisted symbol must not blank out the whole widget.
QUOTE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d"
MAX_QUOTE_SYMBOLS = 12


class QuoteItem(BaseModel):
    symbol: str
    price: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    currency: Optional[str] = None
    name: Optional[str] = None


async def _fetch_quote(symbol: str) -> Optional[QuoteItem]:
    """Latest price + day change for one symbol, or ``None`` when unavailable."""
    try:
        async with httpx.AsyncClient(timeout=8, headers=SET_HEADERS) as client:
            response = await client.get(QUOTE_URL.format(symbol=quote(symbol, safe="")))
            response.raise_for_status()
            body = response.json()

        result = (body.get("chart") or {}).get("result") or []
        if not result:
            return None
        meta = result[0].get("meta") or {}
        price = meta.get("regularMarketPrice")
        if price is None:
            return None

        previous = meta.get("chartPreviousClose") or meta.get("previousClose") or price
        price = float(price)
        previous = float(previous)
        change = price - previous
        return QuoteItem(
            symbol=symbol,
            price=round(price, 4),
            change=round(change, 4),
            change_percent=round((change / previous * 100) if previous else 0.0, 2),
            currency=meta.get("currency"),
            name=meta.get("shortName") or meta.get("symbol"),
        )
    except Exception as exc:  # noqa: BLE001 - a bad symbol is data, not a crash
        logger.info("quote lookup failed for %s: %s", symbol, exc)
        return None


@router.get("/quotes", response_model=list[QuoteItem])
@limiter.limit(_GENERAL_LIMIT)
async def market_quotes(
    request: Request,
    symbols: str = Query(..., max_length=400),
    current_user: User = Depends(get_current_user),
):
    """Quotes for the watchlist widget. Unknown symbols are simply omitted."""
    wanted: list[str] = []
    for raw in symbols.split(","):
        symbol = raw.strip().upper()
        if symbol and symbol not in wanted:
            wanted.append(symbol)
    wanted = wanted[:MAX_QUOTE_SYMBOLS]

    quotes = await asyncio.gather(*(_fetch_quote(s) for s in wanted), return_exceptions=True)
    return [quote for quote in quotes if isinstance(quote, QuoteItem)]


@router.get("/summary", response_model=MarketSummary)
@limiter.limit(_GENERAL_LIMIT)
async def market_summary(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Exchange rates, Thai gold price and the SET index in one response.

    Authenticated on purpose: the widget only renders inside the dashboard, and
    requiring a session keeps this from being an open relay to three providers.
    """
    (
        (frankfurter, frankfurter_stale),
        (ecb, ecb_stale),
        (thai_gold, thai_gold_stale),
        (comex_gold, comex_gold_stale),
        (set_index, set_stale),
    ) = await asyncio.gather(
        _cached("currency:frankfurter", CURRENCY_TTL, _fetch_currency),
        _cached("currency:ecb", CURRENCY_TTL, _fetch_currency_ecb),
        _cached("gold:thai_gold", GOLD_TTL, _fetch_gold),
        _cached("gold:comex", SET_TTL, _fetch_gold_futures),
        _cached("set", SET_TTL, _fetch_set_index),
    )

    currency_sources = [
        CurrencyBlock(**source)
        for source in (frankfurter, ecb)
        if source
    ]
    gold_sources = [
        GoldBlock(**source) for source in (thai_gold, comex_gold) if source
    ]

    return MarketSummary(
        # Keep the original primary fields for compatibility with older clients.
        currency=currency_sources[0] if currency_sources else None,
        currency_sources=currency_sources,
        gold=gold_sources[0] if gold_sources else None,
        gold_sources=gold_sources,
        set_index=SetIndexBlock(**set_index) if set_index else None,
        fetched_at=utcnow(),
        is_stale=any(
            (frankfurter_stale, ecb_stale, thai_gold_stale, comex_gold_stale, set_stale)
        ),
    )
