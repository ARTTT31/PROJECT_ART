"""Tests for the Premier League scoreboard proxy (/football/premier-league)."""

import datetime

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
async def test_expired_live_l2_entry_is_refetched(client, logged_in_user, monkeypatch):
    calls = {"count": 0}
    live = {**_payload(), "is_live": True}

    async def _aged(db, namespace, key):
        return live, football.LIVE_CACHE_TTL + 1

    async def _load(date):
        calls["count"] += 1
        return live

    monkeypatch.setattr(football.weather_cache, "get_fresh_with_age", _aged)
    monkeypatch.setattr(football, "_fetch_events", _load)

    await client.get("/api/v1/football/premier-league")
    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_fresh_live_l2_entry_is_served(client, logged_in_user, monkeypatch):
    calls = {"count": 0}
    live = {**_payload(), "is_live": True}

    async def _aged(db, namespace, key):
        return live, football.LIVE_CACHE_TTL - 10

    async def _load(date):
        calls["count"] += 1
        return live

    monkeypatch.setattr(football.weather_cache, "get_fresh_with_age", _aged)
    monkeypatch.setattr(football, "_fetch_events", _load)

    response = await client.get("/api/v1/football/premier-league")
    assert response.json()["is_live"] is True
    assert calls["count"] == 0


@pytest.mark.asyncio
async def test_l2_entry_without_live_match_keeps_the_long_ttl(
    client, logged_in_user, monkeypatch
):
    calls = {"count": 0}

    async def _aged(db, namespace, key):
        return _payload(), football.LIVE_CACHE_TTL + 1

    async def _load(date):
        calls["count"] += 1
        return _payload()

    monkeypatch.setattr(football.weather_cache, "get_fresh_with_age", _aged)
    monkeypatch.setattr(football, "_fetch_events", _load)

    await client.get("/api/v1/football/premier-league")
    assert calls["count"] == 0


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


@pytest.mark.asyncio
async def test_fetch_events_falls_back_to_latest_completed_matchday(monkeypatch):
    class MockResponse:
        def __init__(self, data, status_code=200):
            self._data = data
            self.status_code = status_code
            self.is_success = status_code == 200

        def json(self):
            return self._data

        def raise_for_status(self):
            if not self.is_success:
                raise RuntimeError("HTTP error")

    # Relative dates, not pinned ones: the fallback only fires while the newest
    # calendar day is still ahead of the clock, so a fixed date rots — on
    # 2026-11-22 the old 2026-11-21 fixture became "the latest past matchday"
    # and the test asserted against a day the mock never served.
    today = football.utcnow().date()
    past_day = today - datetime.timedelta(days=7)
    future_day = today + datetime.timedelta(days=3)
    past_stamp = f"{past_day.isoformat()}T15:00Z"

    scheduled_payload = {
        "leagues": [
            {
                "calendar": [
                    f"{(past_day - datetime.timedelta(days=7)).isoformat()}T07:00Z",
                    f"{past_day.isoformat()}T07:00Z",
                    f"{future_day.isoformat()}T07:00Z",
                ]
            }
        ],
        "events": [
            {
                "id": "future1",
                "date": f"{future_day.isoformat()}T15:00Z",
                "status": {"type": {"state": "pre", "completed": False, "description": "Scheduled"}},
                "competitions": [
                    {
                        "competitors": [
                            {"homeAway": "home", "team": {"displayName": "Team A"}},
                            {"homeAway": "away", "team": {"displayName": "Team B"}},
                        ]
                    }
                ],
            }
        ],
    }

    completed_payload = {
        "events": [
            {
                "id": "past1",
                "date": past_stamp,
                "status": {"type": {"state": "post", "completed": True, "description": "Full Time"}},
                "competitions": [
                    {
                        "competitors": [
                            {"homeAway": "home", "team": {"displayName": "Past Home"}, "score": "2"},
                            {"homeAway": "away", "team": {"displayName": "Past Away"}, "score": "1"},
                        ]
                    }
                ],
            }
        ]
    }

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url, params=None, headers=None):
            if params and params.get("dates") == past_day.strftime("%Y%m%d"):
                return MockResponse(completed_payload)
            return MockResponse(scheduled_payload)

    monkeypatch.setattr(football.httpx, "AsyncClient", MockAsyncClient)
    res = await football._fetch_events(None)
    assert res["success"] is True
    ids = [e["id"] for e in res["events"]]
    assert "past1" in ids
    assert "future1" in ids


def test_parse_standings_extracts_table():
    sample = {
        "children": [
            {
                "standings": {
                    "entries": [
                        {
                            "team": {
                                "id": "359",
                                "displayName": "Arsenal",
                                "shortDisplayName": "Arsenal",
                                "logos": [{"href": "https://espn.com/ars.png"}],
                            },
                            "stats": [
                                {"name": "rank", "value": 1},
                                {"name": "gamesPlayed", "value": 10},
                                {"name": "wins", "value": 9},
                                {"name": "ties", "value": 0},
                                {"name": "losses", "value": 1},
                                {"name": "pointDifferential", "displayValue": "+10"},
                                {"name": "points", "value": 27},
                            ],
                        }
                    ]
                }
            }
        ]
    }
    standings = football._parse_standings(sample)
    assert len(standings) == 1
    team = standings[0]
    assert team["rank"] == 1
    assert team["team"]["name"] == "Arsenal"
    assert team["played"] == 10
    assert team["won"] == 9
    assert team["drawn"] == 0
    assert team["lost"] == 1
    assert team["goal_diff"] == "+10"
    assert team["points"] == 27


@pytest.mark.asyncio
async def test_get_standings_endpoint(client, logged_in_user, monkeypatch):
    async def _mock_standings():
        return {
            "success": True,
            "league": "English Premier League",
            "season": 2026,
            "standings": [{"rank": 1, "team": {"name": "Arsenal"}, "points": 27}],
            "fetched_at": "2026-11-15T00:00:00Z",
            "is_stale": False,
            "source": "ESPN",
        }

    monkeypatch.setattr(football, "_fetch_standings", _mock_standings)
    res = await client.get("/api/v1/football/standings")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["standings"][0]["team"]["name"] == "Arsenal"
