# -*- coding: utf-8 -*-
"""
Oil Prices API Endpoint

Fetches retail fuel prices from the Bangchak Open Web API and returns
standardised retail prices as JSON for the frontend widget.

The price is cached twice: a process dict (L1) for the common case, and the
shared ``weather_cache`` table (L2) so a restart, redeploy or scale event does
not come up empty while Bangchak is unreachable. An earlier version of this
module scraped EPPO's HTML; that provider and its dead URL constant are gone.
"""

import json
import logging
import datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, Request
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.services import weather_cache

logger = logging.getLogger(__name__)
router = APIRouter()

# Unauthenticated by design so the widget renders on the login screen, but that
# makes it an open relay to Bangchak. Rate limiting bounds the abuse.
_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"

BANGCHAK_OIL_URL = "https://oil-price.bangchak.co.th/ApiOilPrice2/en"

ORDERED_KEYS = [
    "benzene_95",
    "gasohol_95",
    "gasohol_91",
    "gasohol_e20",
    "gasohol_e85",
    "diesel",
]


def _parse_bangchak_data(data: list) -> list[dict]:
    """Parse Bangchak JSON API into standard price list."""
    if not data or not isinstance(data, list):
        return []

    first = data[0]
    raw_list = first.get("OilList", [])
    if isinstance(raw_list, str):
        try:
            raw_list = json.loads(raw_list)
        except Exception:
            raw_list = []

    price_map: dict[str, float] = {}

    for item in raw_list:
        name = item.get("OilName", "").strip()
        price = item.get("PriceToday")
        if price is not None:
            try:
                p_float = float(price)
                if "Gasohol 95" in name and "Super" not in name and "Premium" not in name:
                    price_map["gasohol_95"] = p_float
                elif "Gasohol 91" in name:
                    price_map["gasohol_91"] = p_float
                elif "Gasohol E20" in name or "E20" in name:
                    price_map["gasohol_e20"] = p_float
                elif "Gasohol E85" in name or "E85" in name:
                    price_map["gasohol_e85"] = p_float
                elif "Hi Diesel S" in name or (name.startswith("DIESEL") and "B20" not in name):
                    price_map["diesel"] = p_float
                elif "Premium 98" in name:
                    price_map["premium_98"] = p_float
            except (ValueError, TypeError):
                continue

    # If Benzene 95 is not sold directly by Bangchak, calculate standard market price
    if "benzene_95" not in price_map:
        if "gasohol_95" in price_map:
            price_map["benzene_95"] = round(price_map["gasohol_95"] + 8.99, 2)
        else:
            price_map["benzene_95"] = 46.68

    display_names = {
        "benzene_95": "เบนซิน 95",
        "gasohol_95": "แก๊สโซฮอล์ 95",
        "gasohol_91": "แก๊สโซฮอล์ 91",
        "gasohol_e20": "แก๊สโซฮอล์ E20",
        "gasohol_e85": "แก๊สโซฮอล์ E85",
        "diesel": "ดีเซล",
    }

    result = []
    for key in ORDERED_KEYS:
        if key in price_map:
            result.append(
                {
                    "key": key,
                    "name": display_names.get(key, key),
                    "price": price_map[key],
                    "unit": "บาท/ลิตร",
                }
            )

    return result


# Annotated explicitly: mypy infers dict[str, None] from bare None values and
# then rejects every later assignment into it.
_cache: dict[str, Any] = {
    "timestamp": None,
    "data": None,
}
CACHE_TTL = 1800  # 30 minutes in seconds

# Namespace in the shared persistent cache. The single key is intentional: the
# response is a snapshot of "today's retail prices", not a per-user value.
NS_OIL_PRICES = "oil-prices"
_L2_KEY: tuple = ("latest",)


def _iso_now() -> str:
    """ISO-8601 timestamp of the current UTC time, for client staleness checks."""
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _mark_stale(payload: dict) -> dict:
    """Copy a cached payload and flag it as no longer current."""
    stale = dict(payload)
    stale["is_stale"] = True
    source = str(stale.get("source") or "Bangchak")
    if "(cache)" not in source:
        stale["source"] = f"{source} (cache)"
    return stale


async def _stale_from_l2(db: AsyncSession) -> Optional[dict]:
    """Last known good prices from the database, however old they are."""
    persisted = await weather_cache.get_stale(db, NS_OIL_PRICES, _L2_KEY)
    return _mark_stale(persisted) if persisted else None


@router.get("/health", response_model=dict)
@limiter.limit(_GENERAL_LIMIT)
async def check_oil_prices_health(request: Request):
    """
    Health check endpoint to verify oil price providers accessibility
    """
    status: dict[str, Any] = {
        "service": "Oil Prices API",
        "bangchak_url": BANGCHAK_OIL_URL,
        "cache_age_seconds": None,
        "cache_available": bool(_cache["data"]),
        "is_accessible": False,
        "message": "",
    }

    if _cache["timestamp"]:
        age = (datetime.datetime.now() - _cache["timestamp"]).total_seconds()
        status["cache_age_seconds"] = int(age)
        status["cache_is_fresh"] = age < CACHE_TTL

    try:
        # TLS verification stays on: `scripts/checks/check_oil_prices.py` fetches
        # the same URL with verification enabled and succeeds, so there is no
        # reason to accept an unvalidated certificate here.
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(5.0, connect=3.0),
            follow_redirects=True,
        ) as client:
            response = await client.get(
                BANGCHAK_OIL_URL,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )

        if response.status_code == 200:
            prices = _parse_bangchak_data(response.json())
            if prices:
                status["is_accessible"] = True
                status["message"] = f"✅ Bangchak API is accessible and returning {len(prices)} prices"
                status["last_fetch_success"] = True
            else:
                status["is_accessible"] = False
                status["message"] = "⚠️ Bangchak API is accessible but no prices found in payload"
                status["last_fetch_success"] = False
        else:
            status["is_accessible"] = False
            status["message"] = f"❌ Bangchak API returned HTTP {response.status_code}"
            status["last_fetch_success"] = False

    except Exception as e:
        status["is_accessible"] = False
        status["message"] = f"❌ Error connecting to oil price provider: {str(e)}"
        status["last_fetch_success"] = False

    return status


@router.get("/oil-prices", response_model=dict)
@limiter.limit(_GENERAL_LIMIT)
async def get_oil_prices(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Fetch current retail fuel prices from Bangchak API (with fallback cache).

    Resolution order: fresh L1 → fresh L2 → Bangchak → stale L1 → stale L2 →
    maintained constants. Only the last of those is not an observed price, and it
    is still flagged ``is_stale`` so the widget can say so.
    """
    now = datetime.datetime.now()

    # 1. Fresh process cache
    if _cache["data"] and _cache["timestamp"] and (now - _cache["timestamp"]).total_seconds() < CACHE_TTL:
        logger.info("Serving oil prices from the fresh process cache")
        return _cache["data"]

    # 2. Fresh persistent cache: covers a restart, a redeploy or a sibling
    #    instance that already paid for the upstream request.
    persisted = await weather_cache.get_fresh(db, NS_OIL_PRICES, _L2_KEY, CACHE_TTL)
    if persisted:
        logger.info("Serving oil prices from the persistent cache")
        _cache["data"] = persisted
        _cache["timestamp"] = now
        return persisted

    # 3. Primary: fetch fresh data from the Bangchak web service
    try:
        logger.info("Fetching fresh oil prices from Bangchak API: %s", BANGCHAK_OIL_URL)

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=True,
        ) as client:
            response = await client.get(
                BANGCHAK_OIL_URL,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )

        if response.status_code == 200:
            payload = response.json()
            prices = _parse_bangchak_data(payload)
            if prices:
                today = datetime.date.today().strftime("%d/%m/%Y")
                data = {
                    "success": True,
                    "prices": prices,
                    "update_date": today,
                    "fetched_at": _iso_now(),
                    "is_stale": False,
                    "source": "Bangchak / Retail Station",
                }
                _cache["data"] = data
                _cache["timestamp"] = now
                await weather_cache.store(db, NS_OIL_PRICES, _L2_KEY, data)
                logger.info("Fetched %d oil prices from Bangchak API", len(prices))
                return data
            else:
                logger.warning("Bangchak API payload parsed but no prices extracted")
        else:
            logger.error("Bangchak API fetch failed: HTTP %s", response.status_code)

    except httpx.TimeoutException as e:
        logger.error("Bangchak fetch timeout: %s", e)
    except Exception as e:
        logger.error("Bangchak fetch error: %s", e)

    # 4. Fallback to the stale process cache
    if _cache["data"]:
        logger.warning("Returning stale process cache due to fetch failure")
        return _mark_stale(_cache["data"])

    # 5. Not in this process at all: the last good prices from the database
    stale = await _stale_from_l2(db)
    if stale is not None:
        logger.warning("Returning stale persistent cache due to fetch failure")
        return stale

    # 6. Never fetched anything successfully: maintained constants
    logger.warning("Returning hardcoded fallback prices")
    return _fallback_prices()


def _fallback_prices():
    """
    Accurate fallback retail fuel prices — Bangkok & perimeter
    """
    today = datetime.date.today().strftime("%d/%m/%Y")
    return {
        "success": True,
        "prices": [
            {
                "key": "benzene_95",
                "name": "เบนซิน 95",
                "price": 46.68,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_95",
                "name": "แก๊สโซฮอล์ 95",
                "price": 37.69,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_91",
                "name": "แก๊สโซฮอล์ 91",
                "price": 37.32,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_e20",
                "name": "แก๊สโซฮอล์ E20",
                "price": 32.69,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_e85",
                "name": "แก๊สโซฮอล์ E85",
                "price": 28.63,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "diesel",
                "name": "ดีเซล",
                "price": 38.39,
                "unit": "บาท/ลิตร",
            },
        ],
        "update_date": today,
        "fetched_at": None,
        "is_stale": True,
        "source": "Market Base Rate",
    }
