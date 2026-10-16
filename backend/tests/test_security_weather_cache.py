"""Regression tests for the unbounded weather-cache growth (T7).

- Coordinates map onto cache keys at 2-decimal resolution, so two requests
  ~0.004° apart share ONE cache row and ONE upstream call.
- The number of rows the unauthenticated forecast endpoint can create per
  namespace is capped (oldest rows deleted first).
"""

from sqlalchemy import select

from app.models.weather_cache import WeatherCacheEntry
from app.services import weather_cache


FAKE_FORECAST = {
    "latitude": 0.0,
    "longitude": 0.0,
    "timezone": "Asia/Bangkok",
    "current": {},
    "hourly": {},
    "daily": {},
}


def _patch_upstream(monkeypatch, calls):
    """Replace the upstream getter with a recorder returning a constant payload."""

    async def fake_get(url, params, *a, **k):
        calls.append((params.get("latitude"), params.get("longitude")))
        import copy
        data = copy.deepcopy(FAKE_FORECAST)
        data["latitude"] = params.get("latitude")
        data["longitude"] = params.get("longitude")
        return data

    from app.api.v1.endpoints import weather as w
    monkeypatch.setattr(w, "_upstream_get", fake_get)


async def test_nearby_coordinates_share_one_cache_row(client, db_session, monkeypatch):
    calls = []
    _patch_upstream(monkeypatch, calls)

    r1 = await client.get(
        "/api/v1/weather/forecast",
        params={"latitude": 13.7545, "longitude": 100.5021},
    )
    r2 = await client.get(
        "/api/v1/weather/forecast",
        params={"latitude": 13.7548, "longitude": 100.5023},  # within ~0.004 deg
    )
    assert r1.status_code == r2.status_code == 200
    assert len(calls) == 1, "both requests must hit one cache key at 2 decimals"

    rows = await db_session.execute(
        select(WeatherCacheEntry).where(WeatherCacheEntry.key.like("forecast:%"))
    )
    assert len(rows.scalars().all()) == 1, "nearby coordinates share one L2 row"

    # upstream params are rounded too (kind to the provider's coordinate space)
    assert calls[0] == (13.75, 100.5)


async def test_forecast_rows_per_namespace_is_capped(client, db_session, monkeypatch):
    """Even 50+ distinct far-apart coordinates cannot grow the namespace freely."""
    monkeypatch.setattr(weather_cache, "MAX_ROWS_PER_NAMESPACE", 10, raising=False)

    _patch_upstream(monkeypatch, [])

    for i in range(50):
        r = await client.get(
            "/api/v1/weather/forecast",
            params={"latitude": -60 + i * 2.4, "longitude": -170 + i * 3.4},  # far apart
        )
        assert r.status_code == 200

    rows = await db_session.execute(
        select(WeatherCacheEntry).where(WeatherCacheEntry.key.like("forecast:%"))
    )
    count = len(rows.scalars().all())
    assert count <= 10, f"namespace row cap must hold (got {count})"


async def test_prune_runs_at_most_once_per_interval(db_session, monkeypatch):
    """The full-table prune is throttled, not per-write."""
    monkeypatch.setattr(weather_cache, "_last_prune_at", None, raising=False)
    calls = []

    async def fake_prune(db):
        calls.append(1)

    monkeypatch.setattr(weather_cache, "_prune", fake_prune)

    await weather_cache.store(db_session, "geocode", (1.0, 1.0, "th"), {"ok": True})
    assert len(calls) == 1, "first write still prunes"

    for i in range(5):
        await weather_cache.store(db_session, "geocode", (1.0, f"{i}.0.0", "th"), {"ok": True})
    assert len(calls) == 1, "writes inside the interval must NOT re-prune"
