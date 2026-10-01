# -*- coding: utf-8 -*-
"""
Weather & Geocode Backend Proxy

Prevents client IP leakage and keeps CSP tight by routing third-party
requests (Open-Meteo, BigDataCloud) through the ART Workspace API server.

Frontend widgets must never call weather / geocode providers directly from
the browser — always go through these proxies.
"""

import datetime
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter()


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


def _cache_get(cache: dict, key: tuple, ttl: int) -> Optional[dict]:
    entry = cache.get(key)
    if not entry:
        return None
    age = (datetime.datetime.utcnow() - entry["ts"]).total_seconds()
    if age > ttl:
        return None
    return entry["data"]


def _cache_set(cache: dict, key: tuple, data: dict) -> None:
    cache[key] = {"ts": datetime.datetime.utcnow(), "data": data}


def _cache_key_forecast(lat: float, lon: float, days: int) -> tuple:
    return (round(lat, 4), round(lon, 4), days)


def _cache_key_aqi(lat: float, lon: float) -> tuple:
    return (round(lat, 4), round(lon, 4))


def _cache_key_geocode(lat: float, lon: float, lang: str) -> tuple:
    return (round(lat, 4), round(lon, 4), lang)


# ═══════════════════════════════════════════════════════════════════════════════
# HTTP helpers
# ═══════════════════════════════════════════════════════════════════════════════

async def _upstream_get(url: str, params: dict, timeout_seconds: float = 10.0) -> dict:
    """Thin wrapper around httpx async GET that raises 502 on upstream failure."""
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
async def get_forecast_proxy(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees"),
    longitude: float = Query(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees"),
    timezone: str = Query("Asia/Bangkok", description="IANA timezone for response"),
    forecast_days: int = Query(2, ge=1, le=7, description="Number of forecast days"),
):
    """Proxy to Open-Meteo /forecast. Returns the exact upstream JSON shape
    so the existing frontend widget can drop in without re-parsing."""
    cache_key = _cache_key_forecast(latitude, longitude, forecast_days)
    cached = _cache_get(_WEATHER_CACHE, cache_key, FORECAST_CACHE_TTL)
    if cached is not None:
        cached["_from_cache"] = True
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

    payload = await _upstream_get(OPEN_METEO_FORECAST_URL, params)
    _cache_set(_WEATHER_CACHE, cache_key, payload)
    return payload


# ═══════════════════════════════════════════════════════════════════════════════
# Air Quality endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/air-quality")
async def get_air_quality_proxy(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    timezone: str = Query("Asia/Bangkok"),
):
    """Proxy to Open-Meteo air-quality API (PM2.5 / PM10 / US AQI)."""
    cache_key = _cache_key_aqi(latitude, longitude)
    cached = _cache_get(_AQI_CACHE, cache_key, AIR_QUALITY_CACHE_TTL)
    if cached is not None:
        cached["_from_cache"] = True
        return cached

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "pm2_5,pm10,us_aqi",
        "timezone": timezone,
    }

    payload = await _upstream_get(OPEN_METEO_AIR_QUALITY_URL, params)
    _cache_set(_AQI_CACHE, cache_key, payload)
    return payload


# ═══════════════════════════════════════════════════════════════════════════════
# Reverse Geocode endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/reverse-geocode")
async def get_reverse_geocode_proxy(
    latitude: float = Query(..., ge=-90.0, le=90.0),
    longitude: float = Query(..., ge=-180.0, le=180.0),
    locality_language: str = Query("th", description="ISO 639-1 language code for labels"),
):
    """Proxy to BigDataCloud reverse-geocode. Returns locality/city names
    in the requested language. Safe default: Thai (th)."""
    cache_key = _cache_key_geocode(latitude, longitude, locality_language)
    cached = _cache_get(_GEOCODE_CACHE, cache_key, GEOCODE_CACHE_TTL)
    if cached is not None:
        cached["_from_cache"] = True
        return cached

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "localityLanguage": locality_language,
    }

    payload = await _upstream_get(BIGDATACLOUD_REVERSE_URL, params)
    _cache_set(_GEOCODE_CACHE, cache_key, payload)
    return payload
