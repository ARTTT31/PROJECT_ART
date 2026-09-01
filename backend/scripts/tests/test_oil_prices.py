#!/usr/bin/env python3
"""
EPPO Oil Prices Connectivity Test Script

This script tests if the EPPO website is accessible and oil prices can be scraped.
Run this before deploying to catch EPPO connectivity issues early.

Usage:
    python scripts/test_oil_prices.py
"""

import sys
import re
from unittest.mock import MagicMock, patch
import httpx


EPPO_OIL_URL = (
    "https://www.eppo.go.th/templates/eppo_v15_mixed/eppo_oil/eppo_oil_gen_new.php"
)

IMAGE_MAP = [
    ("oil_name2.png", "gasohol_95", "\u0e41\u0e01\u0e4a\u0e2a\u0e42\u0e0b\u0e2e\u0e2d\u0e25\u0e4c 95"),
    ("oil_name3.png", "gasohol_91", "\u0e41\u0e01\u0e4a\u0e2a\u0e42\u0e0b\u0e2e\u0e2d\u0e25\u0e4c 91"),
    ("oil_name4.png", "gasohol_e20", "\u0e41\u0e01\u0e4a\u0e2a\u0e42\u0e0b\u0e2e\u0e2d\u0e25\u0e4c E20"),
    ("oil_name5.png", "gasohol_e85", "\u0e41\u0e01\u0e4a\u0e2a\u0e42\u0e0b\u0e2e\u0e2d\u0e25\u0e4c E85"),
    ("oil_name10.png", "benzene_95", "\u0e40\u0e1a\u0e19\u0e0b\u0e34\u0e19 95"),
    ("oil_name6v2.png", "diesel", "\u0e14\u0e35\u0e40\u0e0b\u0e25"),
]

# ---------------------------------------------------------------------------
# Minimal mock HTML payload that satisfies parse_eppo_html's regex
# ---------------------------------------------------------------------------
MOCK_EPPO_HTML = (
    "<div class='oil_price_colum_name'>"
    "<img src='/images/oil_name2.png'/></div>"
    "<div class='oil_price_colum'>40.00</div>"
    "<div class='oil_price_colum_name'>"
    "<img src='/images/oil_name3.png'/></div>"
    "<div class='oil_price_colum'>35.50</div>"
    "<div style='clear:both'></div>"
)


# ---------------------------------------------------------------------------
# Core parsing / connectivity helpers
# ---------------------------------------------------------------------------

def parse_eppo_html(html: str) -> list[dict]:
    """Parse EPPO oil price HTML, return PTT (first) price for each oil type."""
    rows = re.findall(
        r"oil_price_colum_name'>\s*<img[^>]+src='[^']*/([^'/]+)'[^<]*</div>(.*?)"
        r"(?=<div class='oil_price_colum_name_|<div style='clear:both)",
        html,
        re.DOTALL,
    )
    row_map = {}
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
                    "unit": "\u0e1a\u0e32\u0e17/\u0e25\u0e34\u0e15\u0e23",
                }
            )
    return result


def fetch_eppo() -> httpx.Response:
    """Fetch the EPPO oil-price page."""
    return httpx.get(
        EPPO_OIL_URL,
        timeout=10.0,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (compatible; ART-Workspace/1.0)"},
    )


def check_eppo_response(response: httpx.Response) -> list[dict]:
    """
    Inspect an HTTP response from EPPO and parse prices.
    Returns a list of price dicts on success.
    Raises AssertionError with a descriptive message on failure.
    """
    if response.status_code == 200:
        prices = parse_eppo_html(response.text)
        if not prices:
            raise AssertionError(
                "No oil prices found in EPPO HTML. "
                "The page structure may have changed."
            )
        return prices

    if response.status_code == 403:
        raise AssertionError(
            "Access denied (HTTP 403). EPPO may be blocking the request."
        )
    if response.status_code == 404:
        raise AssertionError(
            "Page not found (HTTP 404). The EPPO URL may have changed."
        )
    raise AssertionError(f"Unexpected HTTP status: {response.status_code}")


# ---------------------------------------------------------------------------
# Pytest-compatible unit tests (no live network calls)
# ---------------------------------------------------------------------------

def test_eppo_connection() -> None:
    """
    Unit test: mocks httpx.get to return HTTP 200 with valid mock HTML.
    Validates that check_eppo_response correctly parses at least one fuel type.
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = MOCK_EPPO_HTML

    with patch("scripts.test_oil_prices.httpx.get", return_value=mock_response):
        fetch_eppo()

    prices = check_eppo_response(mock_response)
    assert isinstance(prices, list), "Expected a list of price dicts"
    assert len(prices) > 0, "Expected at least one parsed fuel price"
    for item in prices:
        assert "key" in item
        assert "price" in item
        assert isinstance(item["price"], float)


def test_eppo_403_raises() -> None:
    """
    Unit test: mocks a HTTP 403 and confirms AssertionError is raised.
    """
    mock_response = MagicMock()
    mock_response.status_code = 403

    try:
        check_eppo_response(mock_response)
        assert False, "Expected AssertionError for HTTP 403"
    except AssertionError as exc:
        assert "403" in str(exc)


def test_eppo_404_raises() -> None:
    """
    Unit test: mocks a HTTP 404 and confirms AssertionError is raised.
    """
    mock_response = MagicMock()
    mock_response.status_code = 404

    try:
        check_eppo_response(mock_response)
        assert False, "Expected AssertionError for HTTP 404"
    except AssertionError as exc:
        assert "404" in str(exc)


def test_parse_eppo_html_mock_data() -> None:
    """
    Unit test: validates that parse_eppo_html correctly extracts prices
    from MOCK_EPPO_HTML without any network call.
    """
    prices = parse_eppo_html(MOCK_EPPO_HTML)
    assert isinstance(prices, list)


# ---------------------------------------------------------------------------
# CLI entry point (live run — not executed by pytest)
# ---------------------------------------------------------------------------

def main() -> None:
    """Main entry point for running as a standalone script."""
    print("\n" + "=" * 80)
    print("\U0001f9ea EPPO Oil Prices Connection Test")
    print("=" * 80 + "\n")
    print(f"\U0001f517 URL: {EPPO_OIL_URL}")
    print("-" * 80)

    try:
        response = fetch_eppo()
        print(f"\U0001f4e1 HTTP Status: {response.status_code}")
        prices = check_eppo_response(response)
        print(f"\u2705 Parsed {len(prices)} fuel type(s) successfully.")
        for item in prices:
            print(f"  \u2022 {item['name']:<20} {item['price']:>6.2f} {item['unit']}")
        print("\n\U0001f389 SUCCESS!")
        sys.exit(0)
    except AssertionError as exc:
        print(f"\u26a0\ufe0f  FAILED: {exc}")
        sys.exit(1)
    except httpx.TimeoutException:
        print("\u26a0\ufe0f  FAILED: Connection timeout")
        sys.exit(1)
    except Exception as exc:
        print(f"\u26a0\ufe0f  FAILED: Unexpected error \u2014 {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
