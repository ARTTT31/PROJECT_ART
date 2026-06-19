# Google Calendar Integration Setup

## Overview
TaskListWidget ได้รับการพัฒนาให้ดึงข้อมูลจาก Google Calendar จริงผ่าน Backend API แทนการใช้ข้อมูล mock

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

### 1. ติดตั้ง Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

Dependencies ที่เพิ่มเข้ามา:
- `icalendar==5.0.11` - Parse iCal format
- `pytz==2024.1` - Timezone handling

### 2. ตรวจสอบ Environment Variables
ไฟล์ `frontend/.env.local` ควรมี:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CALENDAR_ID=935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com
```

**หมายเหตุ:** API Key ไม่จำเป็นอีกต่อไป เพราะใช้ Public iCal Feed

### 3. เริ่มต้น Backend Server
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 4. เริ่มต้น Frontend Server
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
    "title": "ประชุม IMACD",
    "start": "2026-06-15T09:00:00+00:00",
    "end": "2026-06-15T11:00:00+00:00",
    "description": "รายละเอียดงาน",
    "location": "ห้องประชุม A"
  }
]
```

### Frontend Widget
- ดึงข้อมูลจาก Backend API endpoint
- แสดงงานทั้งหมดในเดือนปัจจุบัน
- Filter buttons: ทั้งหมด / IMACD / ธัญพงศ์
- Auto-refresh เมื่อเปลี่ยนเดือน
- Loading state และ Error handling

## Google Calendar Public Feed

### Format
```
https://calendar.google.com/calendar/ical/{CALENDAR_ID}/public/basic.ics
```

### Requirements
- Calendar ต้องเป็น **Public** หรือ **Shared with specific people**
- ไม่ต้องใช้ API Key
- ไม่ต้อง OAuth authentication
- ไม่มี Rate limit (แต่ควรใช้ caching ใน production)

### Making Calendar Public
1. เปิด Google Calendar
2. Settings → Calendar settings
3. เลือก Calendar ที่ต้องการ
4. "Access permissions" → เปิด "Make available to public"
5. คัดลอก Calendar ID จาก "Integrate calendar" section

## Testing

### 1. Test Backend API
```bash
curl "http://localhost:8000/api/v1/calendar/events?calendar_id=935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com&time_min=2026-06-01T00:00:00Z&time_max=2026-06-30T23:59:59Z"
```

### 2. Test Frontend Widget
1. เปิด http://localhost:3000/dashboard
2. ตรวจสอบ TaskListWidget
3. ทดสอบ filter buttons
4. ทดสอบ refresh button
5. ตรวจสอบ Network tab ใน DevTools

## Troubleshooting

### Error: "Failed to fetch calendar data"
**สาเหตุ:**
- Backend server ไม่ทำงาน
- Calendar ไม่เป็น Public
- Calendar ID ไม่ถูกต้อง
- Network/Firewall blocking

**แก้ไข:**
1. ตรวจสอบ Backend server running at http://localhost:8000
2. ทดสอบ API endpoint ด้วย curl/Postman
3. ตรวจสอบ Calendar settings ว่าเป็น Public
4. ตรวจสอบ NEXT_PUBLIC_GOOGLE_CALENDAR_ID ใน .env.local

### Error: "HTTP 404"
**สาเหตุ:** Calendar ID ผิด หรือ Calendar ไม่มี public feed

**แก้ไข:**
- ตรวจสอบ Calendar ID
- ตรวจสอบว่า Calendar เป็น Public

### Error: "Error parsing calendar data"
**สาเหตุ:** iCal format ผิดปกติ หรือ dependencies ไม่ครบ

**แก้ไข:**
```bash
cd backend
pip install icalendar pytz --upgrade
```

### Empty Events List
**สาเหตุ:**
- ไม่มี events ในช่วงเวลาที่กำหนด
- Filter text ไม่ตรงกับ event title

**แก้ไข:**
- ตรวจสอบ events ใน Google Calendar
- ลองเปลี่ยนเดือนในปฏิทิน
- ปิด filter (เลือก "ทั้งหมด")

## Production Considerations

### 1. Add Caching
เพิ่ม Redis caching เพื่อลด API calls:
```python
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache

@router.get("/events")
@cache(expire=300)  # Cache 5 minutes
async def get_calendar_events(...):
    ...
```

### 2. Add Rate Limiting
ป้องกัน API abuse:
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
ใช้ environment variables แทน hardcoded values:
```env
# backend/.env
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com
```

### 4. Error Monitoring
เพิ่ม logging และ monitoring:
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

หากมีปัญหาหรือคำถาม:
1. ตรวจสอบ Backend logs
2. ตรวจสอบ Browser Console
3. ทดสอบ API endpoint โดยตรงด้วย curl
4. ตรวจสอบ Google Calendar settings
