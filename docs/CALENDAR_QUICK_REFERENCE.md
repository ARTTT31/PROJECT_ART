# 📋 Calendar API - Quick Reference Card

## 🔗 API Endpoints

### Health Check
```
GET /api/v1/calendar/health?calendar_id={ID}
```
**Purpose:** Test if calendar is accessible
**Response:** `{is_accessible: boolean, message: string}`

### Get Events
```
GET /api/v1/calendar/events?calendar_id={ID}&time_min={ISO_DATE}&time_max={ISO_DATE}
```
**Purpose:** Fetch calendar events
**Response:** Array of calendar events

---

## 🎯 HTTP Status Codes

| Code | Meaning | Thai Message | Fix |
|------|---------|-------------|-----|
| 200 | Success | - | ✅ Working! |
| 404 | Calendar not found | "ไม่พบปฏิทิน..." | Make calendar public |
| 403 | Access denied | "ไม่สามารถเข้าถึงปฏิทิน..." | Set to "Public" |
| 502 | Google API error | "เชื่อมต่อไม่สำเร็จ..." | Retry or check Google Calendar |
| 504 | Timeout | "เชื่อมต่อไม่สำเร็จ..." | Retry or check network |

---

## 🧪 Quick Tests

### Test 1: Direct iCal URL
```bash
curl "https://calendar.google.com/calendar/ical/YOUR_ID/public/basic.ics"
```
**Expected:** iCalendar data (BEGIN:VCALENDAR...)
**If 404:** Calendar is private or ID is wrong

### Test 2: Health Check (Backend)
```bash
curl "https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=YOUR_ID"
```
**Expected:** `{"is_accessible": true}`

### Test 3: Python Test Script
```bash
python backend/scripts/test_calendar.py YOUR_ID
```
**Expected:** "🎉 SUCCESS! Your calendar is properly configured."

### Test 4: Browser Test
```
https://project-art-c7eh.onrender.com/docs
```
Try the `/calendar/health` endpoint with Swagger UI

---

## 🔧 Fix Checklist

### ✅ Make Calendar Public
- [ ] Open https://calendar.google.com
- [ ] Click ⋮ next to calendar → "Settings and sharing"
- [ ] Check "Make available to public"
- [ ] Set to "See all event details"

### ✅ Verify Calendar ID
- [ ] In Calendar Settings → "Integrate calendar"
- [ ] Copy "Calendar ID"
- [ ] Update `frontend/.env.local`
- [ ] Format: `something@group.calendar.google.com`

### ✅ Test Configuration
- [ ] Run health check endpoint
- [ ] Verify `is_accessible: true`
- [ ] Test direct iCal URL returns data

### ✅ Deploy & Verify
- [ ] Commit and push changes
- [ ] Wait for Render + Vercel deployment
- [ ] Test frontend calendar widget
- [ ] Check for errors in browser console

---

## 🐛 Common Issues

### Backend Returns 404
**Cause:** Calendar is private or doesn't exist
**Fix:** Make calendar public (see checklist above)

### Backend Returns 403
**Cause:** Calendar access denied
**Fix:** Set calendar to "Public" with "See all event details"

### Backend Returns 502
**Cause:** Google Calendar API error or network issue
**Fix:** 
1. Check if Google Calendar is working: https://calendar.google.com
2. Retry after a few seconds
3. Check Render backend logs

### Frontend Shows Generic Error
**Cause:** Old code deployed or caching issue
**Fix:**
1. Hard refresh: Ctrl+Shift+R (Chrome) or Cmd+Shift+R (Mac)
2. Check Vercel deployment status
3. Verify latest code is deployed

### Render Backend is Sleeping
**Symptom:** First request takes 30+ seconds
**Cause:** Free tier auto-sleeps after 15 min
**Fix:**
1. Wake up: `curl https://project-art-c7eh.onrender.com/health`
2. Wait 30-60 seconds
3. Retry calendar request
4. **Long-term:** Upgrade to paid tier ($7/month)

---

## 📊 Error Flow Diagram

```
Frontend Request
    ↓
Backend: /api/v1/calendar/events
    ↓
Fetch from Google: https://calendar.google.com/.../basic.ics
    ↓
┌───────────────────────────────────────┐
│ Google Response?                       │
├───────────────────────────────────────┤
│ 200 → Parse & Return Events (Success) │
│ 404 → Return 404 + Instructions       │
│ 403 → Return 403 + Instructions       │
│ Other → Return 502 + Error Details    │
│ Timeout → Return 504 + Timeout Msg    │
└───────────────────────────────────────┘
    ↓
Frontend: Display Events or Thai Error Message
```

---

## 🔍 Debug Commands

### Check Backend Health
```bash
curl https://project-art-c7eh.onrender.com/health
# Expected: {"status": "healthy"}
```

### Test Calendar Accessibility
```bash
CALENDAR_ID="your-id@group.calendar.google.com"
curl "https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=${CALENDAR_ID}"
```

### Direct iCal Test
```bash
CALENDAR_ID="your-id@group.calendar.google.com"
curl "https://calendar.google.com/calendar/ical/${CALENDAR_ID}/public/basic.ics"
```

### Check Frontend API Call
1. Open https://project-art-sigma.vercel.app
2. Press F12 → Network tab
3. Look for `/api/v1/calendar/events` request
4. Check status code and response

### View Render Logs
```bash
# In Render Dashboard:
# Select service → Logs tab
# Filter by "calendar" or "error"
```

---

## 📁 Environment Variables

### Backend (Render)
```bash
DATABASE_URL=sqlite:///./art_workspace.db
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=https://project-art-sigma.vercel.app,http://localhost:3000
DEBUG=false  # Production
```

### Frontend (Vercel)
```bash
NEXT_PUBLIC_API_URL=https://project-art-c7eh.onrender.com
NEXT_PUBLIC_GOOGLE_CALENDAR_ID=your-id@group.calendar.google.com
```

---

## 🎓 Key Learnings

1. **Always validate external APIs** before assuming backend errors
2. **Provide clear, localized error messages** (Thai in this case)
3. **Add health check endpoints** for critical integrations
4. **Test with actual data** before deploying
5. **Document troubleshooting steps** for future reference

---

## 🔗 URLs Reference

| Service | URL |
|---------|-----|
| Backend API | https://project-art-c7eh.onrender.com |
| Backend Docs | https://project-art-c7eh.onrender.com/docs |
| Backend Health | https://project-art-c7eh.onrender.com/health |
| Calendar Health | https://project-art-c7eh.onrender.com/api/v1/calendar/health |
| Frontend | https://project-art-sigma.vercel.app |
| Google Calendar | https://calendar.google.com |
| Render Dashboard | https://dashboard.render.com |
| Vercel Dashboard | https://vercel.com/dashboard |

---

## 💾 Backup Calendar ID

Your current Calendar ID (from `.env.local`):
```
935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com
```

This is a **Group Calendar**. Ensure:
- ✅ Calendar exists
- ✅ You have owner/admin rights
- ✅ Set to "Public" (not just shared)

---

## ⚡ One-Liner Tests

```bash
# Quick health check
curl -s https://project-art-c7eh.onrender.com/health | jq .status

# Quick calendar test (replace CALENDAR_ID)
curl -s "https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=CALENDAR_ID" | jq .is_accessible

# Wake up Render (if sleeping)
curl -s https://project-art-c7eh.onrender.com/health > /dev/null && echo "Backend is awake!"
```

---

**Print this card and keep it handy for quick reference! 📄**
