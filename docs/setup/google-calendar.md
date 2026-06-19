# Google Calendar Integration Setup

## Overview
TaskListWidget has been developed to fetch actual data from Google Calendar via Backend API instead of using mock data.

## Architecture
```
Frontend (TaskListWidget)
    ↓ HTTP Request
Backend API (/api/v1/calendar/events)
    ↓ Fetch iCal Feed
Google Calendar Public Feed
    ↓ Parse & Filter
Return Events to Frontend
```

## Setup Instructions

### 1. Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

Added dependencies:
- `icalendar==5.0.11` - Parse iCal format
- `pytz==2024.1` - Timezone handling

### 2. Check Environment Variables
The `frontend/.env.local` file should contain:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CALENDAR_ID=935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com
```

**Note:** API Key is no longer needed because we use the Public iCal Feed.

### 3. Start Backend Server
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 4. Start Frontend Server
```bash
cd frontend
npm run dev
```

## How It Works

### Backend API Endpoint
**URL:** `GET /api/v1/calendar/events`

**Query Parameters:**
- `calendar_id` (required): Google Calendar ID
- `time_min` (optional): Start time filter (ISO 8601)
- `time_max` (optional): End time filter (ISO 8601)
- `filter_text` (optional): Filter by text in title

**Response:** Array of CalendarEvent objects
```json
[
  {
    "id": "event-uid",
    "title": "IMACD Meeting",
    "start": "2026-06-15T09:00:00+00:00",
    "end": "2026-06-15T11:00:00+00:00",
    "description": "Event details",
    "location": "Meeting Room A"
  }
]
```

### Frontend Widget
- Fetches data from Backend API endpoint
- Displays all events in the current month
- Filter buttons: All / IMACD / Thanyapong
- Auto-refresh when changing months
- Loading state and Error handling

## Google Calendar Public Feed

### Format
```
https://calendar.google.com/calendar/ical/{CALENDAR_ID}/public/basic.ics
```

### Requirements
- Calendar must be **Public** or **Shared with specific people**
- No API Key required
- No OAuth authentication required
- No Rate limit (but caching should be used in production)

### Making Calendar Public
1. Open Google Calendar
2. Settings → Calendar settings
3. Select the desired Calendar
4. "Access permissions" → Enable "Make available to public"
5. Copy Calendar ID from the "Integrate calendar" section

## Testing

### 1. Test Backend API
```bash
curl "http://localhost:8000/api/v1/calendar/events?calendar_id=935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com&time_min=2026-06-01T00:00:00Z&time_max=2026-06-30T23:59:59Z"
```

### 2. Test Frontend Widget
1. Open http://localhost:3000/dashboard
2. Check TaskListWidget
3. Test filter buttons
4. Test refresh button
5. Check Network tab in DevTools

## Troubleshooting

### Error: "Failed to fetch calendar data"
**Cause:**
- Backend server is not running
- Calendar is not Public
- Incorrect Calendar ID
- Network/Firewall blocking

**Solution:**
1. Check if Backend server is running at http://localhost:8000
2. Test API endpoint with curl/Postman
3. Check Calendar settings to ensure it is Public
4. Check NEXT_PUBLIC_GOOGLE_CALENDAR_ID in .env.local

### Error: "HTTP 404"
**Cause:** Incorrect Calendar ID or Calendar has no public feed

**Solution:**
- Check Calendar ID
- Check if Calendar is Public

### Error: "Error parsing calendar data"
**Cause:** Invalid iCal format or missing dependencies

**Solution:**
```bash
cd backend
pip install icalendar pytz --upgrade
```

### Empty Events List
**Cause:**
- No events in the specified time range
- Filter text does not match event title

**Solution:**
- Check events in Google Calendar
- Try changing the month in the calendar
- Turn off filter (select "All")

## Production Considerations

### 1. Add Caching
Add Redis caching to reduce API calls:
```python
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache

@router.get("/events")
@cache(expire=300)  # Cache 5 minutes
async def get_calendar_events(...):
    ...
```

### 2. Add Rate Limiting
Prevent API abuse:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.get("/events")
@limiter.limit("30/minute")
async def get_calendar_events(...):
    ...
```

### 3. Environment Variables
Use environment variables instead of hardcoded values:
```env
# backend/.env
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
```

### 4. Error Monitoring
Add logging and monitoring:
```python
import logging
logger = logging.getLogger(__name__)

try:
    # ... fetch calendar
except Exception as e:
    logger.error(f"Calendar fetch failed: {e}")
    raise
```

## Next Steps

1. ✅ Create backend calendar API endpoint
2. ✅ Update frontend to call backend API
3. ⬜ Test with real Google Calendar data
4. ⬜ Add caching (optional for production)
5. ⬜ Add error monitoring (optional for production)

## Files Changed

### Backend
- ✅ `backend/requirements.txt` - Added icalendar, pytz
- ✅ `backend/app/api/v1/endpoints/calendar.py` - New calendar endpoint
- ✅ `backend/app/api/v1/router.py` - Register calendar router

### Frontend
- ✅ `frontend/src/components/Widgets/TaskListWidget.tsx` - Call backend API instead of mock data
- ✅ `frontend/.env.local` - Already has GOOGLE_CALENDAR_ID

## Support

If you have issues or questions:
1. Check Backend logs
2. Check Browser Console
3. Test API endpoint directly with curl
4. Check Google Calendar settings
