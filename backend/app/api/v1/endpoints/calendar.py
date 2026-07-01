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


class CalendarHealthCheck(BaseModel):
    """Calendar health check response"""
    
    calendar_id: str
    is_accessible: bool
    message: str
    ical_url: str


@router.get("/health", response_model=CalendarHealthCheck)
async def check_calendar_health(
    calendar_id: str = Query(..., description="Google Calendar ID to test")
):
    """
    Test if a Google Calendar is publicly accessible
    
    Use this endpoint to verify your calendar configuration before fetching events.
    """
    ical_url = f"https://calendar.google.com/calendar/ical/{calendar_id}/public/basic.ics"
    
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            response = await client.get(ical_url)
            
            if response.status_code == 200:
                # Try to parse to ensure it's valid iCal
                try:
                    Calendar.from_ical(response.content)
                    return CalendarHealthCheck(
                        calendar_id=calendar_id,
                        is_accessible=True,
                        message="✅ Calendar is publicly accessible and valid",
                        ical_url=ical_url
                    )
                except Exception as e:
                    return CalendarHealthCheck(
                        calendar_id=calendar_id,
                        is_accessible=False,
                        message=f"⚠️ Calendar is accessible but data is invalid: {str(e)}",
                        ical_url=ical_url
                    )
            elif response.status_code == 404:
                return CalendarHealthCheck(
                    calendar_id=calendar_id,
                    is_accessible=False,
                    message="❌ Calendar not found. Check: 1) Calendar ID is correct, 2) Calendar exists, 3) Calendar is set to 'Public' in Google Calendar settings",
                    ical_url=ical_url
                )
            elif response.status_code == 403:
                return CalendarHealthCheck(
                    calendar_id=calendar_id,
                    is_accessible=False,
                    message="❌ Access denied. Calendar must be set to 'Make available to public' in Google Calendar settings",
                    ical_url=ical_url
                )
            else:
                return CalendarHealthCheck(
                    calendar_id=calendar_id,
                    is_accessible=False,
                    message=f"❌ Unexpected response: HTTP {response.status_code}",
                    ical_url=ical_url
                )
    except httpx.TimeoutException:
        return CalendarHealthCheck(
            calendar_id=calendar_id,
            is_accessible=False,
            message="⏱️ Connection timeout - Google Calendar may be unreachable",
            ical_url=ical_url
        )
    except Exception as e:
        return CalendarHealthCheck(
            calendar_id=calendar_id,
            is_accessible=False,
            message=f"❌ Error: {str(e)}",
            ical_url=ical_url
        )


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
        # Validate calendar_id format
        if not calendar_id or len(calendar_id.strip()) == 0:
            raise HTTPException(
                status_code=400, 
                detail="Calendar ID is required and cannot be empty"
            )

        # Construct iCal feed URL
        ical_url = (
            f"https://calendar.google.com/calendar/ical/{calendar_id}/public/basic.ics"
        )

        # Fetch iCal data with retry
        last_error = None
        response = None
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(45.0, connect=10.0),
            follow_redirects=True
        ) as client:
            for attempt in range(3):
                try:
                    response = await client.get(ical_url)
                    response.raise_for_status()
                    break
                except httpx.HTTPStatusError as e:
                    # Google Calendar returns 404 if calendar doesn't exist or isn't public
                    if e.response.status_code == 404:
                        raise HTTPException(
                            status_code=404,
                            detail=(
                                f"Calendar not found or not public. "
                                f"Please ensure the calendar '{calendar_id}' exists and is "
                                f"shared publicly. Visit Google Calendar settings to make it public."
                            )
                        )
                    elif e.response.status_code == 403:
                        raise HTTPException(
                            status_code=403,
                            detail=(
                                f"Access denied to calendar '{calendar_id}'. "
                                f"The calendar must be set to 'Public' in Google Calendar settings."
                            )
                        )
                    last_error = e
                    if attempt == 2:
                        raise
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
            status_code=504, 
            detail=f"Calendar fetch timed out after 45 seconds: {str(e)}"
        )
    except httpx.HTTPStatusError as e:
        # Handle HTTP errors from Google Calendar
        status_code = e.response.status_code
        if status_code == 404:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Calendar not found or not public. Please verify: "
                    "1) The calendar ID is correct, "
                    "2) The calendar exists in your Google account, "
                    "3) The calendar is set to 'Make available to public' in Google Calendar settings"
                )
            )
        elif status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="Access denied. The calendar must be publicly accessible."
            )
        else:
            raise HTTPException(
                status_code=502, 
                detail=f"Google Calendar API error (HTTP {status_code}): {str(e)}"
            )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502, 
            detail=f"Failed to connect to Google Calendar: {str(e)}"
        )
    except ValueError as e:
        # Handle iCalendar parsing errors
        raise HTTPException(
            status_code=500, 
            detail=f"Invalid calendar data format: {str(e)}"
        )
    except Exception as e:
        # Catch-all for unexpected errors
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Calendar API Error: {error_trace}")
        raise HTTPException(
            status_code=500, 
            detail=f"Unexpected error processing calendar: {str(e)}"
        )
