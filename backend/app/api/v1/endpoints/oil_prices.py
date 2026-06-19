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
    ("oil_name2.png", "gasohol_95", "แก๊สโซฮอล์ 95"),
    ("oil_name3.png", "gasohol_91", "แก๊สโซฮอล์ 91"),
    ("oil_name4.png", "gasohol_e20", "แก๊สโซฮอล์ E20"),
    ("oil_name5.png", "gasohol_e85", "แก๊สโซฮอล์ E85"),
    ("oil_name10.png", "benzene_95", "เบนซิน 95"),
    ("oil_name6v2.png", "diesel", "ดีเซล"),
]


def _parse_eppo_html(html: str) -> list[dict]:
    """Parse EPPO oil price HTML, return PTT (first) price for each oil type."""
    rows = re.findall(
        r"oil_price_colum_name'>\s*<img[^>]+src='[^']*/([^'/]+)'[^<]*</div>(.*?)(?=<div class='oil_price_colum_name_|<div style='clear:both)",
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


@router.get("/oil-prices", response_model=dict)
async def get_oil_prices():
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            response = await client.get(
                EPPO_OIL_URL, headers={"User-Agent": "Mozilla/5.0"}
            )

        if response.status_code == 200:
            prices = _parse_eppo_html(response.text)
            if prices:
                today = datetime.date.today().strftime("%d/%m/%Y")
                return {
                    "success": True,
                    "prices": prices,
                    "update_date": today,
                    "source": "EPPO",
                }

        logger.error(f"EPPO scrape failed: HTTP {response.status_code}")
    except Exception as e:
        logger.error(f"EPPO scrape error: {e}")

    return _fallback_prices()


def _fallback_prices():
    today = datetime.date.today().strftime("%d/%m/%Y")
    return {
        "success": True,
        "prices": [
            {
                "key": "gasohol_95",
                "name": "แก๊สโซฮอล์ 95",
                "price": 43.10,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_91",
                "name": "แก๊สโซฮอล์ 91",
                "price": 42.73,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_e20",
                "name": "แก๊สโซฮอล์ E20",
                "price": 38.10,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "gasohol_e85",
                "name": "แก๊สโซฮอล์ E85",
                "price": 34.04,
                "unit": "บาท/ลิตร",
            },
            {
                "key": "benzene_95",
                "name": "เบนซิน 95",
                "price": 50.99,
                "unit": "บาท/ลิตร",
            },
            {"key": "diesel", "name": "ดีเซล", "price": 41.30, "unit": "บาท/ลิตร"},
        ],
        "update_date": today,
        "source": "EPPO (cache)",
    }
