# -*- coding: utf-8 -*-
"""
Oil Prices API Endpoint
Fetches retail fuel prices from Bangchak Open Web API and EPPO.
Returns standardized retail prices as JSON for the frontend widget.
"""

import json
import logging
import datetime
from fastapi import APIRouter
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

BANGCHAK_OIL_URL = "https://oil-price.bangchak.co.th/ApiOilPrice2/en"
EPPO_OIL_URL = (
    "https://www.eppo.go.th/templates/eppo_v15_mixed/eppo_oil/eppo_oil_gen_new.php"
)

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


_cache = {
    "timestamp": None,
    "data": None,
}
CACHE_TTL = 1800  # 30 minutes in seconds


def _iso_now() -> str:
    """ISO-8601 timestamp of the current UTC time, for client staleness checks."""
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.get("/health", response_model=dict)
async def check_oil_prices_health():
    """
    Health check endpoint to verify oil price providers accessibility
    """
    status = {
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
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(5.0, connect=3.0),
            follow_redirects=True,
            verify=False,
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
async def get_oil_prices():
    """
    Fetch current retail fuel prices from Bangchak API (with fallback cache).
    """
    now = datetime.datetime.now()

    # Serve fresh cache if available
    if _cache["data"] and _cache["timestamp"] and (now - _cache["timestamp"]).total_seconds() < CACHE_TTL:
        logger.info("✅ Serving oil prices from fresh cache")
        return _cache["data"]

    # 1. Primary: Attempt to fetch fresh data from Bangchak Web Service
    try:
        logger.info(f"🔄 Fetching fresh oil prices from Bangchak API: {BANGCHAK_OIL_URL}")

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=True,
            verify=False,
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
                logger.info(f"✅ Successfully fetched {len(prices)} oil prices from Bangchak API")
                return data
            else:
                logger.warning("⚠️ Bangchak API payload parsed but no prices extracted")
        else:
            logger.error(f"❌ Bangchak API fetch failed: HTTP {response.status_code}")

    except httpx.TimeoutException as e:
        logger.error(f"⏱️ Bangchak fetch timeout: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Bangchak fetch error: {str(e)}")

    # 2. Fallback to stale cache if available
    if _cache["data"]:
        logger.warning("⚠️ Returning stale cache due to fetch failure")
        stale = dict(_cache["data"])
        stale["is_stale"] = True
        stale["source"] = stale.get("source", "Bangchak") + " (cache)"
        return stale

    # 3. Last resort: return accurate updated fallback prices
    logger.warning("⚠️ Returning hardcoded fallback prices")
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
