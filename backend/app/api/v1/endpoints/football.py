# -*- coding: utf-8 -*-
"""
Premier League scoreboard proxy for the dashboard widget.

The browser must not call ESPN directly: it would leak the user's IP to a third
party, trip CORS, and let any page in the app hammer the feed. The proxy keeps a
short-lived cache (L1 in-process, L2 in the shared ``weather_cache`` table) so a
dashboard full of widgets costs ESPN one request per TTL window.

Only the parsed match list is returned — team names, badges and scores — so the
widget never depends on the provider's full payload shape.
"""

import logging
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
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

# Scores change only while matches are being played, and the widget refreshes
# every five minutes anyway.
CACHE_TTL = 5 * 60

NS_FOOTBALL = "football"
_L2_KEY: tuple = ("premier-league",)

# Annotated explicitly: mypy infers dict[str, None] from bare None values and
# then rejects every later assignment into it.
_cache: dict[str, Any] = {
    "timestamp": None,
    "data": None,
}


def reset_cache() -> None:
    """Drop the process cache (tests and manual refreshes)."""
    _cache["timestamp"] = None
    _cache["data"] = None


def _iso_now() -> str:
    return utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


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

        parsed.append(
            {
                "id": str(raw.get("id") or ""),
                "kickoff": raw.get("date"),
                "status": status_type.get("description") or "",
                "detail": status_type.get("shortDetail") or "",
                "state": status_type.get("state") or "pre",
                "completed": bool(status_type.get("completed")),
                "home": _team(home),
                "away": _team(away),
                "venue": venue.get("fullName") or "",
            }
        )
    return parsed


async def _fetch_events() -> dict:
    """Fetch and parse the current scoreboard; raises when ESPN fails."""
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),
        follow_redirects=True,
    ) as client:
        response = await client.get(
            ESPN_SCOREBOARD_URL,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ARTWorkspace/1.0)"},
        )
    response.raise_for_status()

    events = _parse_events(response.json())
    if not events:
        raise ValueError("ESPN scoreboard returned no events")

    return {
        "success": True,
        "league": "English Premier League",
        "events": events,
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


async def _stale_from_l2(db: AsyncSession) -> Optional[dict]:
    persisted = await weather_cache.get_stale(db, NS_FOOTBALL, _L2_KEY)
    return _mark_stale(persisted) if persisted else None


@router.get("", response_model=dict)
@router.get("/", response_model=dict)
@router.get("/premier-league", response_model=dict)
@limiter.limit(_GENERAL_LIMIT)
async def get_premier_league(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Latest Premier League results, with a last-known-good fallback."""
    now = utcnow()

    if (
        _cache["data"]
        and _cache["timestamp"]
        and (now - _cache["timestamp"]).total_seconds() < CACHE_TTL
    ):
        return _cache["data"]

    persisted = await weather_cache.get_fresh(db, NS_FOOTBALL, _L2_KEY, CACHE_TTL)
    if persisted:
        _cache["data"] = persisted
        _cache["timestamp"] = now
        return persisted

    try:
        data = await _fetch_events()
    except Exception as exc:
        logger.warning("Premier League fetch failed: %s", exc)
        if _cache["data"]:
            return _mark_stale(_cache["data"])
        stale = await _stale_from_l2(db)
        if stale is not None:
            return stale
        raise HTTPException(status_code=503, detail="ไม่สามารถโหลดผลพรีเมียร์ลีกได้")

    _cache["data"] = data
    _cache["timestamp"] = now
    await weather_cache.store(db, NS_FOOTBALL, _L2_KEY, data)
    return data
