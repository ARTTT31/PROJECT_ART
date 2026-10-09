# -*- coding: utf-8 -*-
"""
Weather & Geocode Backend Proxy

Prevents client IP leakage and keeps CSP tight by routing third-party
requests (Open-Meteo, BigDataCloud) through the ART Workspace API server.

Frontend widgets must never call weather / geocode providers directly from
the browser — always go through these proxies.
"""

import asyncio
import datetime
import logging
import math
from typing import Optional
from zoneinfo import ZoneInfo

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

# Secondary forecast provider (MET Norway / api.met.no)
# Free, open, global forecast used when Open-Meteo throttles Render's shared IP.
MET_NORWAY_FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
MET_NORWAY_HEADERS = {
    "User-Agent": "ARTWorkspace/1.0 (https://github.com/project-art)",
}

# Secondary reverse-geocode provider (OpenStreetMap Nominatim)
# Open, accurate address lookup used when BigDataCloud throttles or fails.
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_HEADERS = {
    "User-Agent": "ARTWorkspace/1.0 (https://github.com/project-art)",
}


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
MAX_RETRY_AFTER_SECONDS = 5.0


def _retry_delay(attempt: int, response: httpx.Response | None) -> Optional[float]:
    """Seconds to wait before the next attempt, or ``None`` to stop retrying.

    A provider that answers 429 knows how long its window lasts; ignoring
    ``Retry-After`` and retrying on our own schedule just spends another request
    inside the same window, which is what turns a throttle into a cascade. If the
    window is longer than this request can afford to wait, we stop rather than
    fire a request we already know will be refused — the caller then falls back to
    stale cache instead of a hard 502.
    """
    fallback = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
    if response is None:
        return fallback

    raw = response.headers.get("Retry-After")
    if raw is None:
        return fallback
    try:
        seconds = float(raw)
    except ValueError:
        # HTTP-date form: cannot be honoured inside this request, keep our own schedule.
        return fallback
    if seconds > MAX_RETRY_AFTER_SECONDS:
        return None
    if seconds < 0:
        return fallback
    return seconds


async def _upstream_get(
    url: str,
    params: dict,
    timeout_seconds: float = 10.0,
    retries: int = 2,
    headers: Optional[dict] = None,
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
                get_kwargs: dict = {}
                if headers:
                    get_kwargs["headers"] = headers
                response = await client.get(url, params=params, **get_kwargs)
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
            delay = _retry_delay(attempt, response)
            if delay is None:
                logger.warning(
                    "Upstream %s Retry-After exceeds %.0fs; not retrying a request we know will be refused",
                    url,
                    MAX_RETRY_AFTER_SECONDS,
                )
                break
            logger.warning(
                "Upstream %s returned HTTP %s; retry %d/%d in %.1fs",
                url,
                response.status_code,
                attempt + 1,
                retries,
                delay,
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
# Secondary Provider (MET Norway) Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _symbol_to_wmo(symbol: str) -> int:
    """Map MET Norway symbol_code string to standard WMO code."""
    base = symbol.split("_")[0]
    mapping = {
        "clearsky": 0,
        "fair": 1,
        "partlycloudy": 2,
        "cloudy": 3,
        "fog": 45,
        "lightrain": 51,
        "lightrainshowers": 51,
        "rain": 61,
        "rainshowers": 61,
        "heavyrain": 81,
        "heavyrainshowers": 81,
        "lightsleet": 68,
        "lightsleetshowers": 68,
        "sleet": 68,
        "sleetshowers": 68,
        "heavysleet": 68,
        "heavysleetshowers": 68,
        "lightsnow": 71,
        "lightsnowshowers": 71,
        "snow": 71,
        "snowshowers": 71,
        "heavysnow": 85,
        "heavysnowshowers": 85,
        "lightrainandthunder": 95,
        "rainandthunder": 95,
        "heavyrainandthunder": 95,
        "lightrainshowersandthunder": 95,
        "rainshowersandthunder": 95,
        "heavyrainshowersandthunder": 95,
        "lightsleetandthunder": 95,
        "sleetandthunder": 95,
        "heavysleetandthunder": 95,
        "lightsnowandthunder": 95,
        "snowandthunder": 95,
        "heavysnowandthunder": 95,
    }
    return mapping.get(base, 2)


def _calc_apparent_temp(temp: float, rh: float, wind_speed_kmh: float) -> float:
    """Steadman apparent temperature / heat index approximation."""
    try:
        e = (rh / 100.0) * 6.105 * math.exp((17.27 * temp) / (237.7 + temp))
        ws_ms = wind_speed_kmh / 3.6
        return round(temp + 0.33 * e - 0.70 * ws_ms - 4.0, 1)
    except Exception:
        return temp


def _calc_rain_prob(precip_mm: float, symbol: str) -> int:
    """Derive estimated rain probability % from precipitation amount or symbol."""
    if precip_mm >= 5.0:
        return 85
    elif precip_mm >= 2.0:
        return 70
    elif precip_mm >= 0.5:
        return 50
    elif precip_mm > 0.0:
        return 30
    elif "rain" in symbol:
        return 40
    elif "drizzle" in symbol:
        return 25
    return 0


def _convert_met_norway_to_open_meteo(
    data: dict,
    latitude: float,
    longitude: float,
    timezone_str: str = "Asia/Bangkok",
    forecast_days: int = 2,
) -> dict:
    """Convert MET Norway GeoJSON timeseries into the Open-Meteo response shape."""
    timeseries = data.get("properties", {}).get("timeseries", [])
    if not timeseries:
        raise ValueError("MET Norway returned empty timeseries")

    try:
        tz = ZoneInfo(timezone_str)
    except Exception:
        tz = ZoneInfo("Asia/Bangkok")

    now_local = datetime.datetime.now(tz)
    first = timeseries[0]
    instant = first.get("data", {}).get("instant", {}).get("details", {})
    n1 = first.get("data", {}).get("next_1_hours", {})
    symbol = n1.get("summary", {}).get("symbol_code", "partlycloudy_day")
    w_code = _symbol_to_wmo(symbol)
    temp = instant.get("air_temperature", 28.0)
    rh = instant.get("relative_humidity", 60.0)
    ws_kmh = round(instant.get("wind_speed", 0.0) * 3.6, 1)
    app_temp = _calc_apparent_temp(temp, rh, ws_kmh)

    hourly_time: list[str] = []
    hourly_temp: list[float] = []
    hourly_code: list[int] = []
    hourly_rain: list[int] = []
    daily_temps: dict[str, list[float]] = {}
    daily_rains: dict[str, list[int]] = {}

    max_hours = forecast_days * 24

    for item in timeseries:
        utc_raw = item.get("time", "")
        if not utc_raw:
            continue
        try:
            utc_str = utc_raw.replace("Z", "+00:00")
            dt_local = datetime.datetime.fromisoformat(utc_str).astimezone(tz)
        except Exception:
            continue

        date_key = dt_local.strftime("%Y-%m-%d")
        time_key = dt_local.strftime("%Y-%m-%dT%H:00")

        dtl = item.get("data", {}).get("instant", {}).get("details", {})
        t_val = dtl.get("air_temperature")
        if t_val is None:
            continue

        n_1 = item.get("data", {}).get("next_1_hours", {})
        n_6 = item.get("data", {}).get("next_6_hours", {})
        sym = (
            n_1.get("summary", {}).get("symbol_code")
            or n_6.get("summary", {}).get("symbol_code")
            or "partlycloudy_day"
        )
        code = _symbol_to_wmo(sym)
        precip = (
            n_1.get("details", {}).get("precipitation_amount")
            or n_6.get("details", {}).get("precipitation_amount")
            or 0.0
        )
        r_prob = _calc_rain_prob(precip, sym)

        if len(hourly_time) < max_hours:
            hourly_time.append(time_key)
            hourly_temp.append(t_val)
            hourly_code.append(code)
            hourly_rain.append(r_prob)

        daily_temps.setdefault(date_key, []).append(t_val)
        daily_rains.setdefault(date_key, []).append(r_prob)

    sorted_dates = sorted(daily_temps.keys())[:forecast_days]
    daily_max = [max(daily_temps[d]) for d in sorted_dates]
    daily_min = [min(daily_temps[d]) for d in sorted_dates]
    daily_rain_max = [max(daily_rains[d]) for d in sorted_dates]

    return {
        "_provider": "met_norway",
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone_str,
        "current": {
            "time": now_local.strftime("%Y-%m-%dT%H:%M"),
            "temperature_2m": temp,
            "relative_humidity_2m": rh,
            "apparent_temperature": app_temp,
            "weather_code": w_code,
            "wind_speed_10m": ws_kmh,
        },
        "hourly": {
            "time": hourly_time,
            "temperature_2m": hourly_temp,
            "weather_code": hourly_code,
            "precipitation_probability": hourly_rain,
        },
        "daily": {
            "time": sorted_dates,
            "temperature_2m_max": daily_max,
            "temperature_2m_min": daily_min,
            "precipitation_probability_max": daily_rain_max,
        },
    }


async def _fetch_secondary_forecast(
    latitude: float,
    longitude: float,
    timezone: str = "Asia/Bangkok",
    forecast_days: int = 2,
) -> dict:
    """Fetch forecast from MET Norway (api.met.no) and adapt to the Open-Meteo response shape."""
    params = {"lat": round(latitude, 4), "lon": round(longitude, 4)}
    raw_data = await _upstream_get(
        MET_NORWAY_FORECAST_URL,
        params=params,
        headers=MET_NORWAY_HEADERS,
        retries=1,
    )
    return _convert_met_norway_to_open_meteo(
        raw_data,
        latitude=latitude,
        longitude=longitude,
        timezone_str=timezone,
        forecast_days=forecast_days,
    )


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
    """Proxy to Open-Meteo /forecast with automated failover to MET Norway.

    Returns the standard forecast JSON shape so frontend widgets need no re-parsing.
    """
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
    except HTTPException as exc:
        logger.warning(
            "Primary weather provider (Open-Meteo) failed with HTTP %s; falling back to secondary provider",
            exc.status_code,
        )
        try:
            payload = await _fetch_secondary_forecast(
                latitude, longitude, timezone=timezone, forecast_days=forecast_days
            )
            logger.info("Successfully fetched weather forecast from secondary provider (MET Norway)")
        except Exception as sec_exc:
            logger.warning("Secondary weather provider (MET Norway) also failed: %s", sec_exc)
            stale = await _stale_payload(db, _WEATHER_CACHE, NS_FORECAST, cache_key)
            if stale is not None:
                logger.warning("Serving stale forecast for %s after all upstream failures", cache_key)
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


async def _fetch_secondary_geocode(
    latitude: float,
    longitude: float,
    locality_language: str = "th",
) -> dict:
    """Fetch reverse geocoding from OpenStreetMap Nominatim when BigDataCloud fails."""
    params = {
        "lat": round(latitude, 4),
        "lon": round(longitude, 4),
        "format": "json",
        "accept-language": locality_language,
    }
    raw = await _upstream_get(
        NOMINATIM_REVERSE_URL,
        params=params,
        headers=NOMINATIM_HEADERS,
        retries=1,
    )
    addr = raw.get("address", {})
    locality = (
        addr.get("suburb")
        or addr.get("city_district")
        or addr.get("district")
        or addr.get("county")
        or addr.get("town")
        or ""
    )
    city = addr.get("city") or addr.get("province") or addr.get("state") or ""
    province = addr.get("province") or addr.get("state") or ""
    country = addr.get("country") or "ประเทศไทย"

    return {
        "_provider": "nominatim",
        "latitude": latitude,
        "longitude": longitude,
        "locality": locality,
        "city": city,
        "principalSubdivision": province,
        "countryName": country,
    }


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
    """Proxy to BigDataCloud reverse-geocode with automated failover to OpenStreetMap Nominatim.

    Returns locality/city names in the requested language. Safe default: Thai (th).
    """
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
    except HTTPException as exc:
        logger.warning(
            "Primary geocode provider (BigDataCloud) failed with HTTP %s; falling back to OpenStreetMap Nominatim",
            exc.status_code,
        )
        try:
            payload = await _fetch_secondary_geocode(latitude, longitude, locality_language)
            logger.info("Successfully fetched geocode from secondary provider (Nominatim)")
        except Exception as sec_exc:
            logger.warning("Secondary geocode provider (Nominatim) failed: %s", sec_exc)
            stale = await _stale_payload(db, _GEOCODE_CACHE, NS_GEOCODE, cache_key)
            if stale is not None:
                logger.warning("Serving stale geocode for %s after upstream failures", cache_key)
                return stale
            return {
                "_provider": "coordinates_fallback",
                "latitude": latitude,
                "longitude": longitude,
                "locality": f"พิกัด {latitude:.2f}",
                "city": f"{longitude:.2f}",
                "principalSubdivision": "",
                "countryName": "ประเทศไทย",
            }

    _cache_set(_GEOCODE_CACHE, cache_key, payload)
    await weather_cache.store(db, NS_GEOCODE, cache_key, payload)
    return payload
