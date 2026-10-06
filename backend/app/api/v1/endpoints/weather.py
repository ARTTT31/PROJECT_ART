# -*- coding: utf-8 -*-
"""
Weather & Geocode Backend Proxy

Prevents client IP leakage and keeps CSP tight by routing third-party
requests (Open-Meteo, BigDataCloud) through the ART Workspace API server.

Frontend widgets must never call weather / geocode providers directly from
the browser — always go through these proxies.
"""

import asyncio
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.utils import utcnow
from app.services import weather_cache

logger = logging.getLogger(__name__)
router = APIRouter()

# These proxies are intentionally reachable without authentication so the login
# page can still show weather, but that makes them a free relay to third-party
# APIs for anyone who finds the URL. Rate limiting bounds that abuse without
# breaking the unauthenticated widget.
_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"


# ═══════════════════════════════════════════════════════════════════════════════
# Upstream provider URLs
# ═══════════════════════════════════════════════════════════════════════════════
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
BIGDATACLOUD_REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"


# ═══════════════════════════════════════════════════════════════════════════════
# Shared in-process cache — Open-Meteo free tier tolerates this well enough
# for an internal dashboard but we still cache to stay kind and resilient.
# ═══════════════════════════════════════════════════════════════════════════════
_WEATHER_CACHE: dict[tuple, dict] = {}
_AQI_CACHE: dict[tuple, dict] = {}
_GEOCODE_CACHE: dict[tuple, dict] = {}

FORECAST_CACHE_TTL = 600      # 10 minutes
AIR_QUALITY_CACHE_TTL = 1800  # 30 minutes
GEOCODE_CACHE_TTL = 86400     # 24 hours (geocoding is effectively static)

# Upper bound per cache. Coordinates come from user input, so without a cap a
# long-lived process (Render keeps instances warm between requests) would grow
# these dicts without bound.
MAX_CACHE_ENTRIES = 200


def _cache_get(cache: dict, key: tuple, ttl: int) -> Optional[dict]:
    entry = cache.get(key)
    if not entry:
        return None
    age = (utcnow() - entry["ts"]).total_seconds()
    if age > ttl:
        return None
    return entry["data"]


def _cache_get_stale(cache: dict, key: tuple) -> Optional[dict]:
    """Return an entry even if its TTL has passed.

    Used as a last resort when the upstream provider is throttling: expired
    weather beats no weather, and the caller flags it as stale.
    """
    entry = cache.get(key)
    return entry["data"] if entry else None


def _cache_set(cache: dict, key: tuple, data: dict) -> None:
    """Insert an entry, dropping expired rows and enforcing MAX_CACHE_ENTRIES.

    Expired entries are purged first because they are pure waste; if the cache is
    still at the cap afterwards, the oldest inserted entry is evicted (dicts
    preserve insertion order).
    """
    now = utcnow()

    if len(cache) >= MAX_CACHE_ENTRIES:
        stale = [k for k, v in cache.items() if (now - v["ts"]).total_seconds() > 0]
        for k in stale:
            del cache[k]
        # Still full (all entries fresh) -> evict oldest first-in.
        while len(cache) >= MAX_CACHE_ENTRIES:
            del cache[next(iter(cache))]

    cache[key] = {"ts": now, "data": data}


def _cache_key_forecast(lat: float, lon: float, days: int) -> tuple:
    return (round(lat, 4), round(lon, 4), days)


def _cache_key_aqi(lat: float, lon: float) -> tuple:
    return (round(lat, 4), round(lon, 4))


def _cache_key_geocode(lat: float, lon: float, lang: str) -> tuple:
    return (round(lat, 4), round(lon, 4), lang)


# L2 namespaces — keep them stable, they are part of the stored key.
NS_FORECAST = "forecast"
NS_AIR_QUALITY = "air-quality"
NS_GEOCODE = "geocode"


# ═══════════════════════════════════════════════════════════════════════════════
# L1 + L2 cache access
# ═══════════════════════════════════════════════════════════════════════════════

async def _cached_payload(
    db: AsyncSession, cache: dict, namespace: str, key: tuple, ttl: int
) -> Optional[dict]:
    """Return a fresh payload from the process cache or, failing that, the database.

    The database layer is what makes the fallback survive a restart: a cold
    instance would otherwise have no data at all when the provider throttles.
    """
    cached = _cache_get(cache, key, ttl)
    if cached is not None:
        cached["_from_cache"] = True
        return cached

    persisted = await weather_cache.get_fresh(db, namespace, key, ttl)
    if persisted is None:
        return None

    _cache_set(cache, key, persisted)  # warm the process cache
    payload = dict(persisted)
    payload["_from_cache"] = True
    return payload


async def _stale_payload(
    db: AsyncSession, cache: dict, namespace: str, key: tuple
) -> Optional[dict]:
    """Last-resort payload after an upstream failure: expired data beats no data."""
    stale = _cache_get_stale(cache, key)
    if stale is None:
        stale = await weather_cache.get_stale(db, namespace, key)
    if stale is None:
        return None
    payload = dict(stale)
    payload["_from_cache"] = True
    payload["_stale"] = True
    return payload


# ═══════════════════════════════════════════════════════════════════════════════
# HTTP helpers
# ═══════════════════════════════════════════════════════════════════════════════

# Upstream providers throttle per-IP. Render instances share egress IPs, so a
# 429 here is routine rather than exceptional — back off and retry before giving
# up, and let the caller fall back to stale cache.
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
RETRY_DELAYS = (0.6, 1.8)


async def _upstream_get(
    url: str,
    params: dict,
    timeout_seconds: float = 10.0,
    retries: int = 2,
) -> dict:
    """GET an upstream provider, retrying throttled/transient failures.

    Raises 502 (or 504 on timeout) once retries are exhausted.
    """
    last_response: httpx.Response | None = None

    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(timeout_seconds, connect=5.0),
                follow_redirects=True,
            ) as client:
                response = await client.get(url, params=params)
        except httpx.TimeoutException as exc:
            logger.warning("Upstream %s timeout: %s", url, exc)
            raise HTTPException(status_code=504, detail="Weather provider timed out")
        except httpx.HTTPError as exc:
            logger.warning("Upstream %s HTTP error: %s", url, exc)
            raise HTTPException(status_code=502, detail="Weather provider unreachable")

        last_response = response
        if response.status_code not in RETRY_STATUSES:
            break

        if attempt < retries:
            delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
            logger.warning(
                "Upstream %s returned HTTP %s; retry %d/%d in %.1fs",
                url, response.status_code, attempt + 1, retries, delay,
            )
            await asyncio.sleep(delay)

    # `response` is bound by the loop above on every path that reaches here.
    assert last_response is not None
    response = last_response

    if response.status_code != 200:
        logger.warning(
            "Upstream %s returned HTTP %s: %s",
            url,
            response.status_code,
            response.text[:200],
        )
        raise HTTPException(
            status_code=502,
            detail=f"Upstream provider returned HTTP {response.status_code}",
        )

    try:
        return response.json()
    except ValueError as exc:
        logger.warning("Upstream %s returned invalid JSON: %s", url, exc)
        raise HTTPException(status_code=502, detail="Weather provider returned invalid JSON")


# ═══════════════════════════════════════════════════════════════════════════════
# Forecast endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/forecast")
@limiter.limit(_GENERAL_LIMIT)
async def get_forecast_proxy(
    request: Request,
    db: AsyncSession = Depends(get_db),
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees"),
    timezone: str = Query("Asia/Bangkok", description="IANA timezone for response"),
    forecast_days: int = Query(2, ge=1, le=7, description="Number of forecast days"),
):
    """Proxy to Open-Meteo /forecast. Returns the exact upstream JSON shape
    so the existing frontend widget can drop in without re-parsing."""
    cache_key = _cache_key_forecast(latitude, longitude, forecast_days)
    cached = await _cached_payload(
        db, _WEATHER_CACHE, NS_FORECAST, cache_key, FORECAST_CACHE_TTL
    )
    if cached is not None:
        return cached

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
        "hourly": "temperature_2m,weather_code,precipitation_probability",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "timezone": timezone,
        "forecast_days": forecast_days,
    }

    try:
        payload = await _upstream_get(OPEN_METEO_FORECAST_URL, params)
    except HTTPException:
        stale = await _stale_payload(db, _WEATHER_CACHE, NS_FORECAST, cache_key)
        if stale is not None:
            logger.warning("Serving stale forecast for %s after upstream failure", cache_key)
            return stale
        raise

    _cache_set(_WEATHER_CACHE, cache_key, payload)
    await weather_cache.store(db, NS_FORECAST, cache_key, payload)
    return payload


# ═══════════════════════════════════════════════════════════════════════════════
# Air Quality endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/air-quality")
@limiter.limit(_GENERAL_LIMIT)
async def get_air_quality_proxy(
    request: Request,
    db: AsyncSession = Depends(get_db),
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    timezone: str = Query("Asia/Bangkok"),
):
    """Proxy to Open-Meteo air-quality API (PM2.5 / PM10 / US AQI)."""
    cache_key = _cache_key_aqi(latitude, longitude)
    cached = await _cached_payload(
        db, _AQI_CACHE, NS_AIR_QUALITY, cache_key, AIR_QUALITY_CACHE_TTL
    )
    if cached is not None:
        return cached

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "pm2_5,pm10,us_aqi",
        "timezone": timezone,
    }

    try:
        payload = await _upstream_get(OPEN_METEO_AIR_QUALITY_URL, params)
    except HTTPException:
        stale = await _stale_payload(db, _AQI_CACHE, NS_AIR_QUALITY, cache_key)
        if stale is not None:
            logger.warning("Serving stale air quality for %s after upstream failure", cache_key)
            return stale
        raise

    _cache_set(_AQI_CACHE, cache_key, payload)
    await weather_cache.store(db, NS_AIR_QUALITY, cache_key, payload)
    return payload


# ═══════════════════════════════════════════════════════════════════════════════
# Reverse Geocode endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reverse-geocode")
@limiter.limit(_GENERAL_LIMIT)
async def get_reverse_geocode_proxy(
    request: Request,
    db: AsyncSession = Depends(get_db),
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    locality_language: str = Query("th", description="ISO 639-1 language code for labels"),
):
    """Proxy to BigDataCloud reverse-geocode. Returns locality/city names
    in the requested language. Safe default: Thai (th)."""
    cache_key = _cache_key_geocode(latitude, longitude, locality_language)
    cached = await _cached_payload(
        db, _GEOCODE_CACHE, NS_GEOCODE, cache_key, GEOCODE_CACHE_TTL
    )
    if cached is not None:
        return cached

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "localityLanguage": locality_language,
    }

    try:
        payload = await _upstream_get(BIGDATACLOUD_REVERSE_URL, params)
    except HTTPException:
        stale = await _stale_payload(db, _GEOCODE_CACHE, NS_GEOCODE, cache_key)
        if stale is not None:
            logger.warning("Serving stale geocode for %s after upstream failure", cache_key)
            return stale
        raise

    _cache_set(_GEOCODE_CACHE, cache_key, payload)
    await weather_cache.store(db, NS_GEOCODE, cache_key, payload)
    return payload
