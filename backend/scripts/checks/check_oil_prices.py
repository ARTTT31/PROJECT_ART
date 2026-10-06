#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Oil Prices Connectivity Check

Manual pre-deploy check for the fuel-price integration. It fetches the live
provider the API actually uses (Bangchak) and parses the response with the
*application's own* parser, so a green run means the integration still works —
rather than that some parallel copy of the parser still works.

This is a manual check, NOT part of the pytest suite: `pytest.ini` pins
`testpaths = tests`. The offline parser checks below can still be driven
explicitly:

    pytest scripts/checks/check_oil_prices.py

Usage (from the backend directory):
    python scripts/checks/check_oil_prices.py
"""

import os
import sys

# This file prints emoji and Thai text. A Windows console defaults to a legacy
# code page (cp874 here), where that raises UnicodeEncodeError before the check
# can even start — so force UTF-8 on the stream first.
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
except Exception:  # pragma: no cover - non-reconfigurable stream
    pass

# The application imports settings at module load, so provide harmless defaults
# before importing anything from `app`. SECRET_KEY must be >= 32 characters
# because DEBUG defaults to False.
os.environ.setdefault("SECRET_KEY", "dev-only-secret-key-for-manual-checks")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

from pathlib import Path  # noqa: E402

# Make `import app...` work when this file is run directly from `backend/`.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import httpx  # noqa: E402

from app.api.v1.endpoints.oil_prices import (  # noqa: E402
    BANGCHAK_OIL_URL,
    ORDERED_KEYS,
    _parse_bangchak_data,
)

REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
TIMEOUT = 10.0


def fetch_prices(verify: bool = True) -> httpx.Response:
    """Fetch the provider payload, optionally without TLS verification."""
    return httpx.get(
        BANGCHAK_OIL_URL,
        timeout=TIMEOUT,
        follow_redirects=True,
        headers=REQUEST_HEADERS,
        verify=verify,
    )


def check_response(response: httpx.Response) -> list[dict]:
    """Validate a provider response and return the parsed prices.

    Raises AssertionError with an actionable message on failure.
    """
    if response.status_code == 403:
        raise AssertionError(
            "Access denied (HTTP 403). The provider is blocking this egress IP or "
            "rejecting the User-Agent."
        )
    if response.status_code == 404:
        raise AssertionError("Page not found (HTTP 404). The provider URL has changed.")
    if response.status_code != 200:
        raise AssertionError(f"Unexpected HTTP status: {response.status_code}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise AssertionError(f"Response was not JSON: {exc}")

    prices = _parse_bangchak_data(payload)
    if not prices:
        raise AssertionError(
            "The provider answered 200 but no prices were parsed. Product names have "
            "probably changed — update the matching branches in `_parse_bangchak_data`."
        )
    return prices


# ---------------------------------------------------------------------------
# Offline self-checks of the application's parser (no network)
# ---------------------------------------------------------------------------

def _keys(prices: list) -> set:
    return {price["key"] for price in prices}


def test_parses_a_json_string_oil_list() -> None:
    """Bangchak ships `OilList` as an embedded JSON string."""
    import json

    raw = json.dumps([
        {"OilName": "Gasohol 95", "PriceToday": "37.69"},
        {"OilName": "Hi Diesel S", "PriceToday": "38.39"},
    ])

    prices = _parse_bangchak_data([{"OilList": raw}])

    assert {"gasohol_95", "diesel"} <= _keys(prices)
    assert next(p for p in prices if p["key"] == "gasohol_95")["price"] == 37.69


def test_parses_an_object_list() -> None:
    prices = _parse_bangchak_data([{"OilList": [
        {"OilName": "Gasohol 91", "PriceToday": 37.32},
        {"OilName": "Gasohol E20", "PriceToday": 32.69},
        {"OilName": "Gasohol E85", "PriceToday": 28.63},
    ]}])

    assert {"gasohol_91", "gasohol_e20", "gasohol_e85"} <= _keys(prices)


def test_premium_95_does_not_overwrite_standard_95() -> None:
    """A premium grade must not win the `gasohol_95` slot."""
    prices = _parse_bangchak_data([{"OilList": [
        {"OilName": "Gasohol 95", "PriceToday": 37.69},
        {"OilName": "Gasohol 95 Premium", "PriceToday": 44.00},
    ]}])

    standard = next(price for price in prices if price["key"] == "gasohol_95")
    assert standard["price"] == 37.69


def test_b20_diesel_is_not_treated_as_standard_diesel() -> None:
    prices = _parse_bangchak_data([{"OilList": [
        {"OilName": "Hi Diesel S", "PriceToday": 38.39},
        {"OilName": "DIESEL B20", "PriceToday": 30.00},
    ]}])

    diesel = next(price for price in prices if price["key"] == "diesel")
    assert diesel["price"] == 38.39


def test_unparseable_prices_are_skipped_instead_of_crashing() -> None:
    prices = _parse_bangchak_data([{"OilList": [
        {"OilName": "Gasohol 95", "PriceToday": "not-a-number"},
        {"OilName": "Gasohol 91", "PriceToday": None},
    ]}])

    assert "gasohol_95" not in _keys(prices)
    assert "gasohol_91" not in _keys(prices)


def test_benzene_95_is_derived_from_gasohol_95() -> None:
    """Bangchak does not sell Benzene 95, so the price is derived."""
    prices = _parse_bangchak_data([{"OilList": [
        {"OilName": "Gasohol 95", "PriceToday": 37.69},
    ]}])

    benzene = next(p for p in prices if p["key"] == "benzene_95")
    assert benzene["price"] == round(37.69 + 8.99, 2)


def test_a_payload_with_no_usable_prices_still_returns_the_benzene_slot() -> None:
    """Documents real behaviour: the parser always fills `benzene_95`.

    So an empty result from the provider must be detected from the *other* fuel
    keys (or by the caller), never by assuming the list is empty.
    """
    assert _parse_bangchak_data([]) == []
    assert _parse_bangchak_data(None) == []
    assert [p["key"] for p in _parse_bangchak_data([{"OilList": "{{not json"}])] == ["benzene_95"]


def test_display_order_follows_ordered_keys() -> None:
    prices = _parse_bangchak_data([{"OilList": [
        {"OilName": "Hi Diesel S", "PriceToday": 38.39},
        {"OilName": "Gasohol 95", "PriceToday": 37.69},
        {"OilName": "Gasohol 91", "PriceToday": 37.32},
    ]}])

    emitted = [price["key"] for price in prices]
    assert emitted == [key for key in ORDERED_KEYS if key in emitted]


# ---------------------------------------------------------------------------
# CLI entry point (live run — not executed by pytest)
# ---------------------------------------------------------------------------

def main() -> None:
    print("\n" + "=" * 80)
    print("\U0001f9ea Oil Prices Connectivity Check (Bangchak)")
    print("=" * 80 + "\n")
    print(f"\U0001f517 URL: {BANGCHAK_OIL_URL}")
    print("-" * 80)

    try:
        response = fetch_prices(verify=True)
    except httpx.HTTPError as exc:
        # Triage aid only: distinguish "the provider is down" from "the certificate
        # chain is the problem". The endpoint itself always validates TLS.
        print(f"\u26a0\ufe0f  Verified request failed: {exc}")
        print("\U0001f512 Retrying without TLS verification to isolate the cause...")
        try:
            response = fetch_prices(verify=False)
        except Exception as retry_exc:
            print(f"\u26a0\ufe0f  FAILED: provider unreachable — {retry_exc}")
            sys.exit(1)
        print("\u26a0\ufe0f  NOTE: the provider only answered with verification disabled.")
        print("    The endpoint keeps verify=True, so the widget would fail here too —")
        print("    investigate the provider's certificate chain instead of weakening the client.")

    print(f"\U0001f4e1 HTTP Status: {response.status_code}")

    try:
        prices = check_response(response)
    except AssertionError as exc:
        print(f"\u26a0\ufe0f  FAILED: {exc}")
        sys.exit(1)

    print(f"\u2705 Parsed {len(prices)} fuel type(s) successfully.")
    for item in prices:
        print(f"  \u2022 {item['name']:<20} {item['price']:>6.2f} {item['unit']}")

    missing = [key for key in ORDERED_KEYS if key not in {p["key"] for p in prices}]
    if missing:
        print(f"\n\u26a0\ufe0f  Missing fuel types: {', '.join(missing)}")

    print("\n\U0001f389 SUCCESS!")
    sys.exit(0)


if __name__ == "__main__":
    main()
