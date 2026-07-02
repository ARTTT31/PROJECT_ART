# -*- coding: utf-8 -*-
"""
Oil Prices API Endpoint
Scrapes retail fuel prices from EPPO website (eppo_oil_gen_new.php)
Returns PTT column prices as JSON for the frontend widget.
"""

import re
import logging
import datetime
from fastapi import APIRouter
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

EPPO_OIL_URL = (
    "https://www.eppo.go.th/templates/eppo_v15_mixed/eppo_oil/eppo_oil_gen_new.php"
)

# image filename → (key, display name)
# Order matches the desired display order
IMAGE_MAP: list[tuple[str, str, str]] = [
    ("oil_name2.png",   "gasohol_95",  "แก๊สโซฮอล์ 95"),
    ("oil_name3.png",   "gasohol_91",  "แก๊สโซฮอล์ 91"),
    ("oil_name4.png",   "gasohol_e20", "แก๊สโซฮอล์ E20"),
    ("oil_name5.png",   "gasohol_e85", "แก๊สโซฮอล์ E85"),
    ("oil_name10.png",  "benzene_95",  "เบนซิน 95"),
    ("oil_name6v2.png", "diesel",      "ดีเซล"),
]


def _parse_eppo_html(html: str) -> list[dict]:
    """Parse EPPO oil price HTML, return PTT (first) price for each oil type."""
    rows = re.findall(
        r"oil_price_colum_name'>\s*<img[^>]+src='[^']*/([^'/]+)'[^<]*</div>(.*?)"
        r"(?=<div class='oil_price_colum_name_|<div style='clear:both)",
        html,
        re.DOTALL,
    )
    row_map: dict[str, float] = {}
    for img_file, rest in rows:
        prices = re.findall(r"oil_price_colum'>([\d.]+)<", rest)
        if prices:
            try:
                row_map[img_file] = float(prices[0])
            except ValueError:
                pass

    result = []
    for img_file, key, name in IMAGE_MAP:
        if img_file in row_map:
            result.append(
                {
                    "key": key,
                    "name": name,
                    "price": row_map[img_file],
                    "unit": "บาท/ลิตร",
                }
            )
    return result


_cache = {
    "timestamp": None,
    "data": None,
}
CACHE_TTL = 3600  # 1 hour in seconds


def _iso_now() -> str:
    """ISO-8601 timestamp of the current UTC time, for client staleness checks."""
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.get("/health", response_model=dict)
async def check_eppo_health():
    """
    Health check endpoint to verify EPPO website accessibility

    Returns:
        Status of EPPO connection and cache state
    """
    status = {
        "service": "Oil Prices API",
        "eppo_url": EPPO_OIL_URL,
        "cache_age_seconds": None,
        "cache_available": bool(_cache["data"]),
        "is_accessible": False,
        "message": "",
    }

    # Check cache age
    if _cache["timestamp"]:
        age = (datetime.datetime.now() - _cache["timestamp"]).total_seconds()
        status["cache_age_seconds"] = int(age)
        status["cache_is_fresh"] = age < CACHE_TTL

    # Test EPPO connectivity
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(5.0, connect=3.0),
            follow_redirects=True
        ) as client:
            response = await client.get(
                EPPO_OIL_URL,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ART-Workspace/1.0)"}
            )

        if response.status_code == 200:
            # Try to parse to ensure data is valid
            prices = _parse_eppo_html(response.text)
            if prices:
                status["is_accessible"] = True
                status["message"] = f"✅ EPPO is accessible and returning {len(prices)} prices"
                status["last_fetch_success"] = True
            else:
                status["is_accessible"] = False
                status["message"] = "⚠️ EPPO is accessible but no prices found in HTML"
                status["last_fetch_success"] = False
        else:
            status["is_accessible"] = False
            status["message"] = f"❌ EPPO returned HTTP {response.status_code}"
            status["last_fetch_success"] = False

    except httpx.TimeoutException:
        status["is_accessible"] = False
        status["message"] = "⏱️ Connection to EPPO timed out"
        status["last_fetch_success"] = False
    except Exception as e:
        status["is_accessible"] = False
        status["message"] = f"❌ Error connecting to EPPO: {str(e)}"
        status["last_fetch_success"] = False

    return status


@router.get("/oil-prices", response_model=dict)
async def get_oil_prices():
    """
    Fetch current retail fuel prices from EPPO website

    Returns PTT column prices for each fuel type with caching.
    Falls back to stale cache or hardcoded prices if live fetch fails.
    """
    now = datetime.datetime.now()

    # Serve fresh cache if available
    if _cache["data"] and _cache["timestamp"] and (now - _cache["timestamp"]).total_seconds() < CACHE_TTL:
        logger.info("✅ Serving oil prices from fresh cache")
        return _cache["data"]

    # Attempt to fetch fresh data from EPPO
    try:
        logger.info(f"🔄 Fetching fresh oil prices from EPPO: {EPPO_OIL_URL}")

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=True
        ) as client:
            response = await client.get(
                EPPO_OIL_URL,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ART-Workspace/1.0)"}
            )

        if response.status_code == 200:
            prices = _parse_eppo_html(response.text)
            if prices:
                today = datetime.date.today().strftime("%d/%m/%Y")
                data = {
                    "success": True,
                    "prices": prices,
                    "update_date": today,
                    "fetched_at": _iso_now(),
                    "is_stale": False,
                    "source": "EPPO",
                }
                _cache["data"] = data
                _cache["timestamp"] = now
                logger.info(f"✅ Successfully fetched {len(prices)} oil prices from EPPO")
                return data
            else:
                logger.warning("⚠️ EPPO HTML parsed but no prices found")
        else:
            logger.error(f"❌ EPPO scrape failed: HTTP {response.status_code}")

    except httpx.TimeoutException as e:
        logger.error(f"⏱️ EPPO fetch timeout: {str(e)}")
    except httpx.HTTPError as e:
        logger.error(f"🌐 EPPO HTTP error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ EPPO scrape unexpected error: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

    # Fallback to stale cache if available
    if _cache["data"]:
        logger.warning("⚠️ Returning stale cache due to fetch failure")
        stale = dict(_cache["data"])
        stale["is_stale"] = True
        stale["source"] = stale.get("source", "EPPO") + " (cache)"
        return stale

    # Last resort: return hardcoded fallback prices
    logger.warning("⚠️ Returning hardcoded fallback prices")
    return _fallback_prices()


def _fallback_prices():
    """
    Hardcoded fallback prices — PTT Station, Bangkok area
    Last updated: 2 July 2026 (2 กรกฎาคม 2569)
    Source: bangkokbiznews / kapook / siamrath
    """
    today = datetime.date.today().strftime("%d/%m/%Y")
    return {
        "success": True,
        "prices": [
            {
                "key": "gasohol_95",
                "name": "แก๊สโซฮอล์ 95",
                "price": 38.05,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_91",
                "name": "แก๊สโซฮอล์ 91",
                "price": 37.68,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_e20",
                "name": "แก๊สโซฮอล์ E20",
                "price": 33.05,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_e85",
                "name": "แก๊สโซฮอล์ E85",
                "price": 28.99,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "benzene_95",
                "name": "เบนซิน 95",
                "price": 47.64,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "diesel",
                "name": "ดีเซล",
                "price": 37.50,
                "unit": "บาท/ลิตร",
            },
        ],
        "update_date": today,
        "fetched_at": None,
        "is_stale": True,
        "source": "Hardcoded fallback",
    }
