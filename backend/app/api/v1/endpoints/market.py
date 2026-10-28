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
from fastapi import APIRouter, Depends, Request
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
CURRENCY_URL = "https://open.er-api.com/v6/latest/THB"
GOLD_URL = "https://api.chnwt.dev/thai-gold-api/latest"
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
async def _fetch_currency() -> dict[str, Any]:
    """THB → foreign rates, inverted to "how many baht per unit" for display."""
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(CURRENCY_URL)
        response.raise_for_status()
        body = response.json()

    rates = body.get("rates") or {}
    rows: list[dict[str, Any]] = []
    for code, name, unit in CURRENCIES:
        rate = rates.get(code)
        if not rate:
            continue
        rows.append(
            {
                "code": code,
                "name": name,
                "unit": unit,
                # `rate` is foreign units per 1 THB, so inverting gives THB per
                # unit; multiplying by `unit` quotes e.g. 100 yen at once.
                "thb": round(unit / float(rate), 2),
            }
        )
    if not rows:
        raise ValueError("no supported currency rates in the payload")
    return {
        "source": "exchangerate-api.com",
        "updated_at": body.get("time_last_update_utc"),
        "rates": rows,
    }


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
        "source": "สมาคมค้าทองคำ",
        "updated_at": " ".join(part for part in (update_date, update_time) if part).strip(),
        "buy": buy,
        "sell": sell,
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
    source: str
    updated_at: Optional[str] = None
    rates: list[CurrencyRate]


class GoldBlock(BaseModel):
    source: str
    updated_at: Optional[str] = None
    buy: float
    sell: float


class SetIndexBlock(BaseModel):
    source: str
    updated_at: Optional[str] = None
    value: float
    change: float
    change_percent: float


class MarketSummary(BaseModel):
    """Any block may be ``null``: a provider that is down must not fail the rest."""

    currency: Optional[CurrencyBlock] = None
    gold: Optional[GoldBlock] = None
    set_index: Optional[SetIndexBlock] = None
    fetched_at: datetime
    is_stale: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoint
# ═══════════════════════════════════════════════════════════════════════════════
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
    (currency, currency_stale), (gold, gold_stale), (set_index, set_stale) = await asyncio.gather(
        _cached("currency", CURRENCY_TTL, _fetch_currency),
        _cached("gold", GOLD_TTL, _fetch_gold),
        _cached("set", SET_TTL, _fetch_set_index),
    )

    return MarketSummary(
        # Rebuilding the models here both satisfies the type checker and
        # validates whatever the provider returned (a shape change upstream
        # becomes a 500 the error boundary can catch, not a broken render).
        currency=CurrencyBlock(**currency) if currency else None,
        gold=GoldBlock(**gold) if gold else None,
        set_index=SetIndexBlock(**set_index) if set_index else None,
        fetched_at=utcnow(),
        is_stale=currency_stale or gold_stale or set_stale,
    )
