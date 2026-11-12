"""Tests for the Premier League scoreboard proxy (/football/premier-league)."""

import pytest

from app.api.v1.endpoints import football

SCOREBOARD_PAYLOAD = {
    "events": [
        {
            "id": "401879244",
            "date": "2026-11-08T14:00Z",
            "status": {
                "type": {
                    "description": "Full Time",
                    "shortDetail": "FT",
                    "state": "post",
                    "completed": True,
                }
            },
            "competitions": [
                {
                    "venue": {"fullName": "American Express Stadium"},
                    "competitors": [
                        {
                            "homeAway": "home",
                            "winner": True,
                            "score": "2",
                            "team": {
                                "id": "331",
                                "displayName": "Brighton & Hove Albion",
                                "shortDisplayName": "Brighton",
                                "abbreviation": "BHA",
                            },
                        },
                        {
                            "homeAway": "away",
                            "winner": False,
                            "score": "0",
                            "team": {
                                "id": "337",
                                "displayName": "Brentford",
                                "shortDisplayName": "Brentford",
                                "abbreviation": "BRE",
                            },
                        },
                    ],
                }
            ],
        }
    ]
}


def _payload() -> dict:
    return {
        "success": True,
        "league": "English Premier League",
        "events": football._parse_events(SCOREBOARD_PAYLOAD),
        "fetched_at": "2026-11-08T15:00:00Z",
        "is_stale": False,
        "source": "ESPN",
    }


@pytest.fixture(autouse=True)
def clear_football_cache():
    football.reset_cache()
    yield
    football.reset_cache()


@pytest.mark.asyncio
async def test_requires_auth(client):
    assert (await client.get("/api/v1/football/premier-league")).status_code == 401


def test_normalize_date_accepts_both_forms():
    assert football.normalize_date("2026-11-08") == "20261108"
    assert football.normalize_date("20261108") == "20261108"
    assert football.normalize_date(None) is None


def test_parse_events_flattens_the_scoreboard():
    events = football._parse_events(SCOREBOARD_PAYLOAD)

    assert len(events) == 1
    match = events[0]
    assert match["id"] == "401879244"
    assert match["completed"] is True
    assert match["home"]["name"] == "Brighton"
    assert match["home"]["score"] == 2
    assert match["away"]["score"] == 0
    assert match["venue"] == "American Express Stadium"


@pytest.mark.asyncio
async def test_returns_latest_results(client, logged_in_user, monkeypatch):
    async def _load(date):
        return _payload()

    monkeypatch.setattr(football, "_fetch_events", _load)

    response = await client.get("/api/v1/football/premier-league")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["success"] is True
    assert body["is_stale"] is False
    assert body["events"][0]["home"]["score"] == 2


@pytest.mark.asyncio
async def test_fresh_cache_skips_the_provider(client, logged_in_user, monkeypatch):
    calls = {"count": 0}

    async def _load(date):
        calls["count"] += 1
        return _payload()

    monkeypatch.setattr(football, "_fetch_events", _load)

    await client.get("/api/v1/football/premier-league")
    await client.get("/api/v1/football/premier-league")
    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_selected_date_is_forwarded_to_the_provider(
    client, logged_in_user, monkeypatch
):
    seen = {}

    async def _load(date):
        seen["date"] = date
        return _payload()

    monkeypatch.setattr(football, "_fetch_events", _load)

    response = await client.get("/api/v1/football/premier-league?date=2026-11-08")
    assert response.status_code == 200
    assert seen["date"] == "20261108"


@pytest.mark.asyncio
async def test_invalid_date_is_rejected(client, logged_in_user):
    response = await client.get("/api/v1/football/premier-league?date=08-11-2026")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_provider_failure_reports_unavailable(client, logged_in_user, monkeypatch):
    async def _load(date):
        raise RuntimeError("espn down")

    monkeypatch.setattr(football, "_fetch_events", _load)

    response = await client.get("/api/v1/football/premier-league")
    assert response.status_code == 503
