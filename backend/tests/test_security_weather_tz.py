"""Regression tests for timezone handling in the weather cache keys (T10).

Forecast or air-quality payloads differ per requested timezone, so the cache
key must include it — otherwise a request with tz=Bangkok poisons the row that
a tz=Tokyo request later reads. The timezone must also be a valid IANA name
(zoneinfo), not free-form user input.
"""

import pytest


@pytest.fixture(autouse=True)
async def _authenticated(logged_in_user):
    """The forecast proxy requires a signed-in user now."""
    return logged_in_user


FAKE_FORECAST = {
    "latitude": 0.0, "longitude": 0.0, "timezone": "Asia/Bangkok",
    "current": {}, "hourly": {}, "daily": {},
}


def _patch_upstream(monkeypatch, calls):
    async def fake_get(url, params, *a, **k):
        calls.append(params.get("timezone"))
        import copy
        data = copy.deepcopy(FAKE_FORECAST)
        data["timezone"] = params.get("timezone")
        return data

    from app.api.v1.endpoints import weather as w
    monkeypatch.setattr(w, "_upstream_get", fake_get)


async def test_different_timezones_are_different_cache_rows(client, monkeypatch):
    from app.api.v1.endpoints import weather as w

    w._WEATHER_CACHE.clear()
    calls = []
    _patch_upstream(monkeypatch, calls)

    r1 = await client.get("/api/v1/weather/forecast", params={
        "latitude": 50.0, "longitude": 8.0, "timezone": "Asia/Bangkok"})
    r2 = await client.get("/api/v1/weather/forecast", params={
        "latitude": 50.0, "longitude": 8.0, "timezone": "Europe/Berlin"})

    assert r1.status_code == r2.status_code == 200
    assert len(calls) == 2, "different timezones must not share one cache row"
    assert r1.json()["timezone"] == "Asia/Bangkok"
    assert r2.json()["timezone"] == "Europe/Berlin"


@pytest.mark.parametrize("tz", ["Not/AZone", "America/__FaKe__", ""])
async def test_invalid_timezone_rejected(client, monkeypatch, tz):
    _patch_upstream(monkeypatch, [])
    r = await client.get("/api/v1/weather/forecast", params={
        "latitude": 50.0, "longitude": 8.0, "timezone": tz})
    assert r.status_code == 422
