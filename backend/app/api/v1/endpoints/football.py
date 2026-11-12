# -*- coding: utf-8 -*-
"""
Premier League scoreboard proxy for the dashboard widget.

The browser must not call ESPN directly: it would leak the user's IP to a third
party, trip CORS, and let any page in the app hammer the feed. The proxy keeps a
short-lived cache (L1 in-process, L2 in the shared ``weather_cache`` table) so a
dashboard full of widgets costs ESPN one request per TTL window.

``date`` selects a calendar day (``YYYY-MM-DD`` or ``YYYYMMDD``); without it the
provider answers with the current matchday, which is the widget's default view.
"""

import datetime
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.utils import utcnow
from app.models.user import User
from app.services import weather_cache

logger = logging.getLogger(__name__)
router = APIRouter()

_GENERAL_LIMIT = f"{settings.RATE_LIMIT_GENERAL_PER_MINUTE}/minute"

ESPN_SCOREBOARD_URL = (
    "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard"
)

# A finished matchday barely moves, but a live score does. The TTL is picked per
# payload so an in-progress match is refreshed about once a minute.
CACHE_TTL = 5 * 60
LIVE_CACHE_TTL = 60

NS_FOOTBALL = "football"

# date key ("latest" or YYYYMMDD) → (fetched_at, payload)
_CACHE: dict[str, tuple[datetime.datetime, dict]] = {}


def reset_cache() -> None:
    """Drop the process cache (tests and manual refreshes)."""
    _CACHE.clear()


def _iso_now() -> str:
    return utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_date(value: Optional[str]) -> Optional[str]:
    """Validate a widget date and return it as ESPN's ``YYYYMMDD`` form."""
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    for fmt in ("%Y-%m-%d", "%Y%m%d"):
        try:
            parsed = datetime.datetime.strptime(cleaned, fmt)
        except ValueError:
            continue
        return parsed.strftime("%Y%m%d")
    raise HTTPException(status_code=400, detail="รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)")


def _ttl_for(payload: dict) -> int:
    return LIVE_CACHE_TTL if payload.get("is_live") else CACHE_TTL


def _team(competitor: dict) -> dict:
    team = competitor.get("team") or {}
    score = competitor.get("score")
    try:
        numeric_score: Optional[int] = int(score) if score not in (None, "") else None
    except (TypeError, ValueError):
        numeric_score = None
    return {
        "id": str(team.get("id") or competitor.get("id") or ""),
        "name": team.get("shortDisplayName") or team.get("displayName") or "—",
        "full_name": team.get("displayName") or "",
        "abbreviation": team.get("abbreviation") or "",
        "logo": team.get("logo") or None,
        "score": numeric_score,
        "winner": bool(competitor.get("winner")),
    }


def _parse_events(payload: dict) -> list[dict]:
    """Turn ESPN's scoreboard payload into the widget's flat match list."""
    parsed: list[dict] = []
    for raw in payload.get("events") or []:
        competitions = raw.get("competitions") or []
        competition = competitions[0] if competitions else {}
        competitors = competition.get("competitors") or []
        home = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if home is None or away is None:
            continue

        status = raw.get("status") or {}
        status_type = status.get("type") or {}
        venue = competition.get("venue") or {}
        broadcasts = competition.get("broadcasts") or []
        broadcast_names: list[str] = []
        for entry in broadcasts:
            broadcast_names.extend(entry.get("names") or [])

        parsed.append(
            {
                "id": str(raw.get("id") or ""),
                "kickoff": raw.get("date"),
                "status": status_type.get("description") or "",
                "detail": status_type.get("shortDetail") or "",
                "clock": status.get("displayClock") or "",
                "state": status_type.get("state") or "pre",
                "completed": bool(status_type.get("completed")),
                "home": _team(home),
                "away": _team(away),
                "venue": venue.get("fullName") or "",
                "broadcast": ", ".join(dict.fromkeys(broadcast_names)),
            }
        )
    return parsed


async def _fetch_events(date: Optional[str]) -> dict:
    """Fetch and parse one scoreboard day; raises when ESPN fails."""
    params = {"dates": date} if date else None
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),
        follow_redirects=True,
    ) as client:
        response = await client.get(
            ESPN_SCOREBOARD_URL,
            params=params,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ARTWorkspace/1.0)"},
        )
    response.raise_for_status()

    events = _parse_events(response.json())

    return {
        "success": True,
        "league": "English Premier League",
        "date": date,
        "events": events,
        "is_live": any(event["state"] == "in" for event in events),
        "fetched_at": _iso_now(),
        "is_stale": False,
        "source": "ESPN",
    }


def _mark_stale(payload: dict) -> dict:
    stale = dict(payload)
    stale["is_stale"] = True
    source = str(stale.get("source") or "ESPN")
    if "(cache)" not in source:
        stale["source"] = f"{source} (cache)"
    return stale


async def _stale_from_l2(db: AsyncSession, date: Optional[str]) -> Optional[dict]:
    persisted = await weather_cache.get_stale(db, NS_FOOTBALL, _l2_key(date))
    return _mark_stale(persisted) if persisted else None


def _l2_key(date: Optional[str]) -> tuple:
    return (date or "latest",)


@router.get("", response_model=dict)
@router.get("/", response_model=dict)
@router.get("/premier-league", response_model=dict)
@limiter.limit(_GENERAL_LIMIT)
async def get_premier_league(
    request: Request,
    date: Optional[str] = Query(None, max_length=10),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Premier League results for a day (or the current matchday)."""
    day = normalize_date(date)
    cache_key = day or "latest"
    now = utcnow()

    cached = _CACHE.get(cache_key)
    if cached and (now - cached[0]).total_seconds() < _ttl_for(cached[1]):
        return cached[1]

    # The L2 TTL depends on the payload: a day with a match in progress must be
    # re-fetched after LIVE_CACHE_TTL, not after the finished-day CACHE_TTL.
    persisted = await weather_cache.get_fresh_with_age(db, NS_FOOTBALL, _l2_key(day))
    if persisted:
        payload, age = persisted
        if age <= _ttl_for(payload):
            _CACHE[cache_key] = (now, payload)
            return payload

    try:
        data = await _fetch_events(day)
    except Exception as exc:
        logger.warning("Premier League fetch failed: %s", exc)
        if cached:
            return _mark_stale(cached[1])
        stale = await _stale_from_l2(db, day)
        if stale is not None:
            return stale
        raise HTTPException(status_code=503, detail="ไม่สามารถโหลดผลพรีเมียร์ลีกได้")

    _CACHE[cache_key] = (now, data)
    await weather_cache.store(db, NS_FOOTBALL, _l2_key(day), data)
    return data
