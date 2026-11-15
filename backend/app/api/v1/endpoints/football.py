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
ESPN_STANDINGS_URL = (
    "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings"
)

# A finished matchday barely moves, but a live score does. The TTL is picked per
# payload so an in-progress match is refreshed about once a minute.
CACHE_TTL = 5 * 60
LIVE_CACHE_TTL = 60
STANDINGS_CACHE_TTL = 30 * 60

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

        details = competition.get("details") or []
        goals = []
        cards = []
        for det in details:
            clock = det.get("clock", {}).get("displayValue") or ""
            team_id = str(det.get("team", {}).get("id") or "")
            athletes = det.get("athletesInvolved") or []
            player_name = athletes[0].get("displayName") if athletes else ""

            if det.get("scoringPlay"):
                goal_type = (
                    "penalty"
                    if det.get("penaltyKick")
                    else "own_goal"
                    if det.get("ownGoal")
                    else "goal"
                )
                goals.append(
                    {
                        "clock": clock,
                        "team_id": team_id,
                        "player": player_name,
                        "type": goal_type,
                    }
                )
            elif det.get("redCard"):
                cards.append(
                    {
                        "clock": clock,
                        "team_id": team_id,
                        "player": player_name,
                        "type": "red",
                    }
                )
            elif det.get("yellowCard"):
                cards.append(
                    {
                        "clock": clock,
                        "team_id": team_id,
                        "player": player_name,
                        "type": "yellow",
                    }
                )

        headlines = competition.get("headlines") or []
        headline_desc = headlines[0].get("description") if headlines else None

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
                "goals": goals,
                "cards": cards,
                "headline": headline_desc,
                "attendance": competition.get("attendance"),
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
        raw_json = response.json()
        events = _parse_events(raw_json)

        # When viewing the default matchday (no explicit date) and the feed answers with
        # a future day where no matches have kicked off yet, include the latest completed
        # matchday so users immediately see recent results instead of an empty scoreboard.
        if not date:
            has_live = any(e.get("state") == "in" for e in events)
            has_completed = any(e.get("completed") for e in events)
            if not has_live and not has_completed:
                calendar = (
                    raw_json.get("leagues", [{}])[0].get("calendar", [])
                    if raw_json.get("leagues")
                    else []
                )
                now_iso = utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
                past_dates = [
                    c[:10].replace("-", "")
                    for c in calendar
                    if isinstance(c, str) and c[:10] <= now_iso[:10]
                ]
                if past_dates:
                    latest_past = past_dates[-1]
                    try:
                        past_resp = await client.get(
                            ESPN_SCOREBOARD_URL,
                            params={"dates": latest_past},
                            headers={"User-Agent": "Mozilla/5.0 (compatible; ARTWorkspace/1.0)"},
                        )
                        if past_resp.is_success:
                            past_events = _parse_events(past_resp.json())
                            seen_ids = {e["id"] for e in past_events}
                            merged = list(past_events)
                            for ev in events:
                                if ev["id"] not in seen_ids:
                                    seen_ids.add(ev["id"])
                                    merged.append(ev)
                            events = merged
                    except Exception as err:
                        logger.warning(
                            "Failed to fetch latest past matchday (%s): %s",
                            latest_past,
                            err,
                        )

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


def _parse_standings(payload: dict) -> list[dict]:
    entries: list[dict] = []
    children = payload.get("children") or []
    if not children:
        return entries
    raw_entries = children[0].get("standings", {}).get("entries", [])
    for entry in raw_entries:
        team = entry.get("team") or {}
        logos = team.get("logos") or []
        logo_url = logos[0].get("href") if logos else None
        stats_map = {
            s.get("name"): s.get("displayValue", s.get("value"))
            for s in entry.get("stats") or []
        }

        try:
            rank = int(stats_map.get("rank") or 0)
        except (ValueError, TypeError):
            rank = 0

        try:
            played = int(stats_map.get("gamesPlayed") or 0)
        except (ValueError, TypeError):
            played = 0

        try:
            won = int(stats_map.get("wins") or 0)
        except (ValueError, TypeError):
            won = 0

        try:
            drawn = int(stats_map.get("ties") or 0)
        except (ValueError, TypeError):
            drawn = 0

        try:
            lost = int(stats_map.get("losses") or 0)
        except (ValueError, TypeError):
            lost = 0

        try:
            points = int(stats_map.get("points") or 0)
        except (ValueError, TypeError):
            points = 0

        goal_diff = str(stats_map.get("pointDifferential") or "0")

        entries.append(
            {
                "rank": rank,
                "team": {
                    "id": str(team.get("id") or ""),
                    "name": team.get("shortDisplayName") or team.get("displayName") or "",
                    "full_name": team.get("displayName") or "",
                    "abbreviation": team.get("abbreviation") or "",
                    "logo": logo_url,
                },
                "played": played,
                "won": won,
                "drawn": drawn,
                "lost": lost,
                "goal_diff": goal_diff,
                "points": points,
            }
        )
    entries.sort(key=lambda x: x["rank"])
    return entries


async def _fetch_standings() -> dict:
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),
        follow_redirects=True,
    ) as client:
        response = await client.get(
            ESPN_STANDINGS_URL,
            headers={"User-Agent": "Mozilla/5.0 (compatible; ARTWorkspace/1.0)"},
        )
    response.raise_for_status()
    standings = _parse_standings(response.json())
    return {
        "success": True,
        "league": "English Premier League",
        "season": 2026,
        "standings": standings,
        "fetched_at": _iso_now(),
        "is_stale": False,
        "source": "ESPN",
    }


@router.get("/standings", response_model=dict)
@limiter.limit(_GENERAL_LIMIT)
async def get_premier_league_standings(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Premier League 20-team live standings table."""
    cache_key = "standings"
    now = utcnow()

    cached = _CACHE.get(cache_key)
    if cached and (now - cached[0]).total_seconds() < STANDINGS_CACHE_TTL:
        return cached[1]

    persisted = await weather_cache.get_fresh_with_age(db, NS_FOOTBALL, (cache_key,))
    if persisted:
        payload, age = persisted
        if age <= STANDINGS_CACHE_TTL:
            _CACHE[cache_key] = (now, payload)
            return payload

    try:
        data = await _fetch_standings()
    except Exception as exc:
        logger.warning("Premier League standings fetch failed: %s", exc)
        if cached:
            return _mark_stale(cached[1])
        stale = await _stale_from_l2(db, cache_key)
        if stale is not None:
            return stale
        raise HTTPException(status_code=503, detail="ไม่สามารถโหลดตารางคะแนนพรีเมียร์ลีกได้")

    _CACHE[cache_key] = (now, data)
    await weather_cache.store(db, NS_FOOTBALL, (cache_key,), data)
    return data
