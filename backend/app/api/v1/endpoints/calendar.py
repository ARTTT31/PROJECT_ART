"""
Google Calendar Integration API
Fetches calendar events from Google Calendar public iCal feed
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import httpx
from icalendar import Calendar
import pytz

router = APIRouter()


class CalendarEvent(BaseModel):
    """Calendar event model"""

    id: str
    title: str
    start: str
    end: str
    description: Optional[str] = None
    location: Optional[str] = None


@router.get("/events", response_model=List[CalendarEvent])
async def get_calendar_events(
    calendar_id: str = Query(..., description="Google Calendar ID"),
    time_min: Optional[str] = Query(None, description="Start time (ISO format)"),
    time_max: Optional[str] = Query(None, description="End time (ISO format)"),
    filter_text: Optional[str] = Query(
        None, description="Filter events by text in title"
    ),
):
    """
    Fetch events from Google Calendar using public iCal feed

    Args:
        calendar_id: Google Calendar ID
        time_min: Filter events starting from this time (ISO 8601 format)
        time_max: Filter events ending before this time (ISO 8601 format)
        filter_text: Filter events containing this text in title

    Returns:
        List of calendar events
    """
    try:
        # Construct iCal feed URL
        ical_url = (
            f"https://calendar.google.com/calendar/ical/{calendar_id}/public/basic.ics"
        )

        # Fetch iCal data with retry
        last_error = None
        response = None
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(45.0, connect=10.0)
        ) as client:
            for attempt in range(3):
                try:
                    response = await client.get(ical_url)
                    response.raise_for_status()
                    break
                except (httpx.TimeoutException, httpx.ConnectError) as e:
                    last_error = e
                    if attempt == 2:
                        raise
        if response is None:
            raise last_error

        # Parse iCal data
        calendar = Calendar.from_ical(response.content)

        # Parse time filters — keep as UTC-aware for comparison
        tz_thai = pytz.timezone("Asia/Bangkok")
        time_min_dt = None
        time_max_dt = None

        if time_min:
            time_min_dt = datetime.fromisoformat(time_min.replace("Z", "+00:00"))
            if time_min_dt.tzinfo is None:
                time_min_dt = pytz.utc.localize(time_min_dt)

        if time_max:
            time_max_dt = datetime.fromisoformat(time_max.replace("Z", "+00:00"))
            if time_max_dt.tzinfo is None:
                time_max_dt = pytz.utc.localize(time_max_dt)

        # Extract events
        events = []
        for component in calendar.walk():
            if component.name == "VEVENT":
                # Get event properties
                summary = str(component.get("summary", ""))

                # Get start time
                dtstart = component.get("dtstart")
                if not dtstart:
                    continue  # Skip events without start time
                start = dtstart.dt

                # Get end time (use start time if not available)
                dtend = component.get("dtend")
                if dtend:
                    end = dtend.dt
                else:
                    # Use duration or default to start time
                    duration = component.get("duration")
                    if duration:
                        end = start + duration.dt
                    else:
                        end = start

                description = (
                    str(component.get("description", ""))
                    if component.get("description")
                    else None
                )
                location = (
                    str(component.get("location", ""))
                    if component.get("location")
                    else None
                )
                uid = str(component.get("uid", ""))

                # Convert date to datetime if needed
                if isinstance(start, datetime):
                    start_dt = start
                    if start_dt.tzinfo is None:
                        start_dt = tz_thai.localize(start_dt)
                    else:
                        start_dt = start_dt.astimezone(tz_thai)
                else:  # all-day date object
                    start_dt = tz_thai.localize(
                        datetime.combine(start, datetime.min.time())
                    )

                if isinstance(end, datetime):
                    end_dt = end
                    if end_dt.tzinfo is None:
                        end_dt = tz_thai.localize(end_dt)
                    else:
                        end_dt = end_dt.astimezone(tz_thai)
                else:  # all-day date object
                    end_dt = tz_thai.localize(
                        datetime.combine(end, datetime.min.time())
                    )

                # Apply time range filter
                if time_min_dt and start_dt < time_min_dt:
                    continue
                if time_max_dt and start_dt > time_max_dt:
                    continue

                # Apply text filter
                if filter_text and filter_text.lower() not in summary.lower():
                    continue

                events.append(
                    CalendarEvent(
                        id=uid,
                        title=summary,
                        start=start_dt.isoformat(),
                        end=end_dt.isoformat(),
                        description=description,
                        location=location,
                    )
                )

        # Sort events by start time
        events.sort(key=lambda x: x.start)

        return events

    except httpx.TimeoutException as e:
        raise HTTPException(
            status_code=504, detail=f"Calendar fetch timed out: {str(e)}"
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502, detail=f"Calendar returned {e.response.status_code}"
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502, detail=f"Failed to fetch calendar: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing calendar: {str(e)}")
