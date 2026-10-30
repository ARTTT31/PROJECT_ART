"""Tests for the dashboard finance and watchlist preference endpoints.

These cover the two serialisers in ``app.core.personal_lists`` directly as well
as the HTTP endpoints. The endpoint tests matter because the serialisers used to
receive pydantic models: finance silently saved ``[]`` and watchlist raised a
``TypeError`` (HTTP 500) on every save.
"""

import json

import pytest
from pydantic import ValidationError

from app.core.personal_lists import (
    MAX_FINANCE_ENTRIES,
    MAX_WATCHLIST_SYMBOLS,
    parse_finance_entries,
    parse_watchlist,
    serialize_finance_entries,
    serialize_watchlist,
)
from app.models.user import User
from app.schemas.user import FinanceEntry, WatchlistItem


async def _csrf_header(client) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    if not token:
        token = (await client.get("/api/v1/auth/csrf")).json()["data"]["csrf_token"]
    return {"X-CSRF-Token": token}


FINANCE_ENTRIES = [
    {"id": "f1", "type": "income", "label": "ขายของ", "amount": 1250.5, "date": "2026-10-29"},
    {"id": "f2", "type": "expense", "label": "ค่ากาแฟ", "amount": 85, "date": "2026-10-29"},
]


# ── Serialisers (regressions) ────────────────────────────────────────────────


def test_finance_serialiser_accepts_pydantic_models():
    saved = serialize_finance_entries(
        [
            FinanceEntry(
                id="f1",
                type="income",
                label="ขายของ",
                amount=1250.5,
                date="2026-10-29",
            )
        ]
    )

    assert json.loads(saved) == [
        {
            "id": "f1",
            "type": "income",
            "label": "ขายของ",
            "amount": 1250.5,
            "date": "2026-10-29",
        }
    ]


def test_watchlist_serialiser_accepts_pydantic_models():
    saved = serialize_watchlist([WatchlistItem(symbol="ptt.bk", label="PTT")])

    assert json.loads(saved) == [{"symbol": "PTT.BK", "label": "PTT"}]


def test_finance_serialiser_rejects_non_finite_amounts():
    """NaN comparisons are all false, so it used to slip past the range check."""
    entries = [
        {"id": "nan", "type": "income", "label": "", "amount": float("nan"), "date": "2026-10-29"},
        {"id": "inf", "type": "income", "label": "", "amount": float("inf"), "date": "2026-10-29"},
        {"id": "text", "type": "income", "label": "", "amount": "NaN", "date": "2026-10-29"},
        {"id": "ok", "type": "income", "label": "", "amount": 10, "date": "2026-10-29"},
    ]

    saved = json.loads(serialize_finance_entries(entries))

    assert [entry["id"] for entry in saved] == ["ok"]


def test_finance_parser_drops_invalid_rows_but_keeps_good_ones():
    raw = json.dumps(
        [
            FINANCE_ENTRIES[0],
            {"id": "", "type": "income", "label": "", "amount": 10, "date": "2026-10-29"},
            {"id": "x", "type": "transfer", "label": "", "amount": 10, "date": "2026-10-29"},
            {"id": "y", "type": "income", "label": "", "amount": 10, "date": "2026-02-31"},
            {"id": "z", "type": "income", "label": "", "amount": -1, "date": "2026-10-29"},
        ]
    )

    assert [entry["id"] for entry in parse_finance_entries(raw)] == ["f1"]


def test_watchlist_parser_dedupes_and_normalises():
    raw = json.dumps([{"symbol": " PTT.BK ", "label": "PTT"}, "ptt.bk", {"symbol": "aapl"}])

    assert parse_watchlist(raw) == [
        {"symbol": "PTT.BK", "label": "PTT"},
        {"symbol": "AAPL"},
    ]


def test_watchlist_parser_keeps_only_valid_symbols():
    raw = json.dumps(["bad symbol", "<script>", "", 42, {"symbol": "OK"}])

    assert parse_watchlist(raw) == [{"symbol": "OK"}]


@pytest.mark.parametrize(
    "payload",
    [
        {"symbol": "bad symbol"},
        {"symbol": "<script>"},
        {"symbol": ""},
    ],
)
def test_watchlist_schema_rejects_bad_symbols(payload):
    with pytest.raises(ValidationError):
        WatchlistItem(**payload)


def test_finance_schema_rejects_impossible_date():
    with pytest.raises(ValidationError):
        FinanceEntry(id="x", type="income", label="", amount=10, date="2026-02-31")


@pytest.mark.parametrize("amount", [float("nan"), float("inf")])
def test_finance_schema_rejects_non_finite_amount(amount):
    with pytest.raises(ValidationError):
        FinanceEntry(id="x", type="income", label="", amount=amount, date="2026-10-29")


# ── Endpoints ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_finance_and_watchlist_require_auth(client):
    assert (await client.get("/api/v1/profile/finance")).status_code == 401
    assert (await client.get("/api/v1/profile/watchlist")).status_code == 401
    assert (
        await client.put("/api/v1/profile/finance", json={"entries": []})
    ).status_code in (401, 403)
    assert (
        await client.put("/api/v1/profile/watchlist", json={"symbols": []})
    ).status_code in (401, 403)


@pytest.mark.asyncio
async def test_new_account_starts_with_empty_lists(client, logged_in_user):
    finance = await client.get("/api/v1/profile/finance")
    watchlist = await client.get("/api/v1/profile/watchlist")

    assert finance.status_code == 200
    assert finance.json()["entries"] == []
    assert watchlist.status_code == 200
    assert watchlist.json()["symbols"] == []


@pytest.mark.asyncio
async def test_finance_saving_and_reading_back(client, logged_in_user):
    """Regression: saving used to return 200 while persisting an empty list."""
    csrf = await _csrf_header(client)

    saved = await client.put(
        "/api/v1/profile/finance", json={"entries": FINANCE_ENTRIES}, headers=csrf
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["entries"] == FINANCE_ENTRIES

    fetched = await client.get("/api/v1/profile/finance")
    assert fetched.json()["entries"] == FINANCE_ENTRIES


@pytest.mark.asyncio
async def test_watchlist_saving_and_reading_back(client, logged_in_user):
    """Regression: saving used to raise TypeError and return HTTP 500."""
    csrf = await _csrf_header(client)

    saved = await client.put(
        "/api/v1/profile/watchlist",
        json={"symbols": [{"symbol": " ptt.bk ", "label": "PTT"}, {"symbol": "aapl"}]},
        headers=csrf,
    )
    assert saved.status_code == 200, saved.text
    assert [item["symbol"] for item in saved.json()["symbols"]] == ["PTT.BK", "AAPL"]

    fetched = await client.get("/api/v1/profile/watchlist")
    assert [item["symbol"] for item in fetched.json()["symbols"]] == ["PTT.BK", "AAPL"]


@pytest.mark.asyncio
async def test_watchlist_dedupes_on_save(client, logged_in_user):
    csrf = await _csrf_header(client)

    response = await client.put(
        "/api/v1/profile/watchlist",
        json={"symbols": [{"symbol": "PTT.BK"}, {"symbol": "ptt.bk"}, {"symbol": "AAPL"}]},
        headers=csrf,
    )

    assert response.status_code == 200, response.text
    assert [item["symbol"] for item in response.json()["symbols"]] == ["PTT.BK", "AAPL"]


@pytest.mark.asyncio
async def test_finance_rejects_more_than_the_cap(client, logged_in_user):
    csrf = await _csrf_header(client)
    entries = [
        {"id": f"f{i}", "type": "income", "label": "", "amount": 1, "date": "2026-10-29"}
        for i in range(MAX_FINANCE_ENTRIES + 1)
    ]

    response = await client.put(
        "/api/v1/profile/finance", json={"entries": entries}, headers=csrf
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_watchlist_rejects_more_than_the_cap(client, logged_in_user):
    csrf = await _csrf_header(client)
    symbols = [{"symbol": f"S{i}"} for i in range(MAX_WATCHLIST_SYMBOLS + 1)]

    response = await client.put(
        "/api/v1/profile/watchlist", json={"symbols": symbols}, headers=csrf
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_bad_payloads_are_rejected_with_422(client, logged_in_user):
    csrf = await _csrf_header(client)

    bad_finance = await client.put(
        "/api/v1/profile/finance",
        json={
            "entries": [
                {"id": "x", "type": "income", "label": "", "amount": 10, "date": "2026-02-31"}
            ]
        },
        headers=csrf,
    )
    bad_symbol = await client.put(
        "/api/v1/profile/watchlist",
        json={"symbols": [{"symbol": "bad symbol"}]},
        headers=csrf,
    )

    assert bad_finance.status_code == 422
    assert bad_symbol.status_code == 422


@pytest.mark.asyncio
async def test_corrupt_stored_values_read_as_empty(
    client, logged_in_user, registered_user, db_session
):
    user = await db_session.get(User, registered_user["data"]["user_id"])
    user.finance_entries = "{not valid json"
    user.watchlist = "42"
    await db_session.commit()

    assert (await client.get("/api/v1/profile/finance")).json()["entries"] == []
    assert (await client.get("/api/v1/profile/watchlist")).json()["symbols"] == []


@pytest.mark.asyncio
async def test_lists_are_per_account(client, make_user, logged_in_user):
    from tests.conftest import TEST_USER_PASSWORD, _login

    csrf = await _csrf_header(client)
    await client.put(
        "/api/v1/profile/finance", json={"entries": FINANCE_ENTRIES}, headers=csrf
    )
    await client.put(
        "/api/v1/profile/watchlist",
        json={"symbols": [{"symbol": "AWS"}]},
        headers=csrf,
    )

    await make_user(email="other-finance@example.com", name="Other")
    await _login(client, "other-finance@example.com", TEST_USER_PASSWORD)

    assert (await client.get("/api/v1/profile/finance")).json()["entries"] == []
    assert (await client.get("/api/v1/profile/watchlist")).json()["symbols"] == []
