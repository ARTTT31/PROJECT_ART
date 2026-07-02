"""
SharePoint List Calendar Integration API
Fetches booking/schedule events from Microsoft SharePoint List using Microsoft Graph API
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import httpx
import urllib.parse
import pytz

from app.core.config import settings

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


async def get_graph_token() -> str:
    """Get a Microsoft Graph API access token using client credentials grant"""
    tenant_id = settings.require_microsoft_tenant_id()
    client_id = settings.require_microsoft_client_id()
    client_secret = settings.require_microsoft_client_secret()

    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://graph.microsoft.com/.default"
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, data=data)
        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch Graph API token: {response.text}"
            )
        return response.json()["access_token"]


async def get_sharepoint_ids(token: str) -> tuple[str, str]:
    """Resolve SharePoint Site ID and List ID from the target list URL"""
    if settings.SHAREPOINT_SITE_ID and settings.SHAREPOINT_LIST_ID:
        return settings.SHAREPOINT_SITE_ID, settings.SHAREPOINT_LIST_ID

    url = settings.SHAREPOINT_LIST_URL
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc

    # Extract site path
    path_parts = [p for p in parsed.path.split("/") if p]
    if len(path_parts) >= 2 and path_parts[0] == "personal":
        site_path = f"/personal/{path_parts[1]}"
    else:
        site_path = ""

    list_name = "Technical Support and IMACD Booking Schedule"
    if "Lists" in path_parts:
        idx = path_parts.index("Lists")
        if idx + 1 < len(path_parts):
            list_name = urllib.parse.unquote(path_parts[idx + 1])

    site_id = settings.SHAREPOINT_SITE_ID
    if not site_id:
        site_url = f"https://graph.microsoft.com/v1.0/sites/{host}:{site_path}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(site_url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to resolve site ID: {resp.text}"
                )
            site_id = resp.json()["id"]

    list_id = settings.SHAREPOINT_LIST_ID
    if not list_id:
        list_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/lists/{urllib.parse.quote(list_name)}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(list_url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to resolve list ID for '{list_name}': {resp.text}"
                )
            list_id = resp.json()["id"]

    return site_id, list_id


@router.get("/health", response_model=CalendarHealthCheck)
async def check_calendar_health(
    calendar_id: str = Query("sharepoint", description="Identifier to test")
):
    """
    Test if SharePoint List is accessible via Graph API
    """
    try:
        token = await get_graph_token()
        site_id, list_id = await get_sharepoint_ids(token)

        return CalendarHealthCheck(
            calendar_id=calendar_id,
            is_accessible=True,
            message=f"✅ SharePoint List is accessible. Site ID: {site_id}, List ID: {list_id}",
            ical_url=settings.SHAREPOINT_LIST_URL
        )
    except Exception as e:
        return CalendarHealthCheck(
            calendar_id=calendar_id,
            is_accessible=False,
            message=f"❌ Error accessing SharePoint List: {str(e)}",
            ical_url=settings.SHAREPOINT_LIST_URL
        )


@router.get("/events", response_model=List[CalendarEvent])
async def get_calendar_events(
    calendar_id: str = Query("sharepoint", description="SharePoint identifier"),
    time_min: Optional[str] = Query(None, description="Start time (ISO format)"),
    time_max: Optional[str] = Query(None, description="End time (ISO format)"),
    filter_text: Optional[str] = Query(
        None, description="Filter events by text in title or description"
    ),
):
    """
    Fetch events from Microsoft SharePoint List using Microsoft Graph API
    """
    try:
        token = await get_graph_token()
        site_id, list_id = await get_sharepoint_ids(token)

        # Query list items expanding fields
        # Expand=fields gives access to Custom List fields
        graph_url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/lists/{list_id}/items?expand=fields"

        # Apply basic client side or backend Graph API query limit if needed
        # Graph API expansion doesn't support $filter on nested properties directly without complex syntax,
        # so client-side filtering fits the architecture perfectly.
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.get(graph_url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"SharePoint Graph API Error: {resp.text}"
                )
            items = resp.json().get("value", [])

        # Parse filters
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

        events = []
        for item in items:
            fields = item.get("fields", {})
            uid = item.get("id", "")

            # Robust field extraction matching various SharePoint schema patterns
            title = fields.get("Title") or fields.get("title") or fields.get("LinkTitle") or "Untitled Booking"
            start_str = fields.get("EventDate") or fields.get("Event_x0020_Date") or fields.get("StartDateTime") or fields.get("start") or fields.get("Created")
            end_str = fields.get("EndDate") or fields.get("End_x0020_Date") or fields.get("EndDateTime") or fields.get("end") or start_str
            description = fields.get("Description") or fields.get("description") or fields.get("Notes") or ""
            location = fields.get("Location") or fields.get("location") or ""

            if not start_str:
                continue

            try:
                # Handle standard ISO timestamp formats
                start_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                if start_dt.tzinfo is None:
                    start_dt = tz_thai.localize(start_dt)
                else:
                    start_dt = start_dt.astimezone(tz_thai)

                end_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
                if end_dt.tzinfo is None:
                    end_dt = tz_thai.localize(end_dt)
                else:
                    end_dt = end_dt.astimezone(tz_thai)
            except Exception:
                continue

            # Time range filter
            if time_min_dt and start_dt < time_min_dt:
                continue
            if time_max_dt and start_dt > time_max_dt:
                continue

            # Text filter (Title or Description)
            if filter_text:
                q = filter_text.lower()
                if q not in title.lower() and q not in description.lower():
                    continue

            events.append(
                CalendarEvent(
                    id=uid,
                    title=title,
                    start=start_dt.isoformat(),
                    end=end_dt.isoformat(),
                    description=description,
                    location=location,
                )
            )

        # Sort events by start date
        events.sort(key=lambda x: x.start)
        return events

    except httpx.TimeoutException as e:
        raise HTTPException(
            status_code=504,
            detail=f"SharePoint fetch timed out: {str(e)}"
        )
    except Exception as e:
        import traceback
        print(f"❌ SharePoint Calendar API Error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error processing SharePoint calendar: {str(e)}"
        )
