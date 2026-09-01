# 📅 Google Calendar Integration Troubleshooting Guide

## 🔍 Common Issues and Solutions

### Issue: HTTP 502 (Bad Gateway) / HTTP 404 Errors

#### Root Causes:
1. **Calendar is not set to Public**
2. **Incorrect Calendar ID**
3. **Calendar doesn't exist or was deleted**
4. **Backend deployment issues**

---

## ✅ Step-by-Step Fix Guide

### Step 1: Verify Google Calendar is Public

1. Go to [Google Calendar](https://calendar.google.com)
2. Find your calendar in the left sidebar (under "My calendars")
3. Click the **three dots** (⋮) next to the calendar name
4. Select **"Settings and sharing"**
5. Scroll down to **"Access permissions for events"**
6. ✅ **Check the box**: "Make available to public"
7. Set visibility to **"See all event details"** (not just "See only free/busy")

### Step 2: Get the Correct Calendar ID

While in Calendar Settings:
1. Scroll down to **"Integrate calendar"**
2. Copy the **"Calendar ID"** (looks like: `your-email@group.calendar.google.com` or `abc123...@group.calendar.google.com`)
3. Update your `.env.local` file:

```env
NEXT_PUBLIC_GOOGLE_CALENDAR_ID=YOUR_ACTUAL_CALENDAR_ID_HERE
```

### Step 3: Test Calendar Accessibility

Use the new health check endpoint to verify your calendar:

**Method 1: Using Browser**
```
https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=YOUR_CALENDAR_ID
```

**Method 2: Using curl**
```bash
curl "https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=YOUR_CALENDAR_ID"
```

**Expected Success Response:**
```json
{
  "calendar_id": "your-id@group.calendar.google.com",
  "is_accessible": true,
  "message": "✅ Calendar is publicly accessible and valid",
  "ical_url": "https://calendar.google.com/calendar/ical/your-id@group.calendar.google.com/public/basic.ics"
}
```

**Common Error Responses:**

❌ **404 - Calendar Not Found**
```json
{
  "is_accessible": false,
  "message": "❌ Calendar not found. Check: 1) Calendar ID is correct, 2) Calendar exists, 3) Calendar is set to 'Public'"
}
```
**Fix:** Make calendar public (Step 1) or verify Calendar ID (Step 2)

❌ **403 - Access Denied**
```json
{
  "is_accessible": false,
  "message": "❌ Access denied. Calendar must be set to 'Make available to public'"
}
```
**Fix:** Enable public access in Google Calendar settings

### Step 4: Verify Backend Environment Variables

Check if your backend (Render) has all required environment variables:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Navigate to your backend service: `project-art-c7eh`
3. Go to **Environment** tab
4. Verify these variables exist:
   - `DATABASE_URL`
   - `SECRET_KEY`
   - `CORS_ORIGINS` (should include your Vercel frontend URL)

### Step 5: Test Backend Deployment

Check if backend is running:
```bash
curl https://project-art-c7eh.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "ART Workspace API",
  "version": "1.0.0"
}
```

If this fails, your backend might be:
- ❌ Asleep (free tier) - wait 30-60 seconds and retry
- ❌ Failed to deploy - check Render logs
- ❌ Not deployed yet - trigger a new deployment

---

## 🧪 Testing Checklist

After making changes, test in this order:

- [ ] **Step 1:** Calendar health check returns `is_accessible: true`
- [ ] **Step 2:** Backend `/health` endpoint responds with `status: healthy`
- [ ] **Step 3:** Frontend loads without errors
- [ ] **Step 4:** Calendar events display in the TaskList widget
- [ ] **Step 5:** Check browser console for any remaining errors

---

## 🔧 Quick Fixes Reference

### Error: "ไม่พบปฏิทิน" (Calendar not found)
```bash
# 1. Verify calendar is public in Google Calendar
# 2. Test with health check endpoint
# 3. Update NEXT_PUBLIC_GOOGLE_CALENDAR_ID in frontend/.env.local
```

### Error: "เชื่อมต่อ Google Calendar ไม่สำเร็จ" (Connection failed)
```bash
# Backend might be asleep (free tier)
# Wake it up:
curl https://project-art-c7eh.onrender.com/health

# Wait 30 seconds, then retry
```

### Error: CORS issues
```bash
# Verify frontend URL is in backend CORS_ORIGINS
# For Vercel: https://project-art-sigma.vercel.app
# For local dev: http://localhost:3000
```

---

## 📚 API Endpoints Reference

### Calendar Health Check
```
GET /api/v1/calendar/health?calendar_id={CALENDAR_ID}
```

### Get Calendar Events
```
GET /api/v1/calendar/events?calendar_id={CALENDAR_ID}&time_min={ISO_DATE}&time_max={ISO_DATE}
```

Parameters:
- `calendar_id` (required): Google Calendar ID
- `time_min` (optional): Start date in ISO 8601 format
- `time_max` (optional): End date in ISO 8601 format
- `filter_text` (optional): Filter events by text

---

## 🆘 Still Having Issues?

1. **Check Backend Logs** (Render Dashboard → Logs tab)
2. **Check Browser Console** (F12 → Console tab)
3. **Verify Network Requests** (F12 → Network tab)
4. **Test with a Different Calendar** (create a test public calendar)

### Debug Commands:

```bash
# Test direct iCal URL (replace CALENDAR_ID)
curl "https://calendar.google.com/calendar/ical/CALENDAR_ID/public/basic.ics"

# Should return iCalendar data starting with:
# BEGIN:VCALENDAR
# VERSION:2.0
# ...
```

If this curl command returns 404, your calendar is definitely not public or the ID is wrong.

---

## 💡 Best Practices

1. ✅ Use a dedicated public calendar for the app (not your personal calendar)
2. ✅ Test calendar accessibility before deploying
3. ✅ Use the health check endpoint in CI/CD pipelines
4. ✅ Monitor Render free tier sleep status (auto-sleeps after 15 min inactivity)
5. ✅ Consider upgrading Render to paid tier for production (no sleep)

---

## 📞 Support

If issues persist after following this guide:
1. Document the exact error message (Thai + English)
2. Share the health check response
3. Check backend logs for stack traces
4. Verify all environment variables are set correctly
