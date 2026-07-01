# 🚀 Calendar API Fix - Quick Start Guide

## 📋 What Was Fixed

Your calendar API was returning **HTTP 502 errors** because:
1. Backend wasn't properly handling 404/403 responses from Google Calendar
2. Error messages weren't clear about what was wrong
3. No tools existed to test calendar configuration

## ✅ What's New

### 1. Enhanced Error Handling
- ✅ Specific error codes (404, 403, 502, 504)
- ✅ Clear Thai error messages in the UI
- ✅ Detailed logging for debugging

### 2. New Health Check Endpoint
Test your calendar configuration:
```
GET /api/v1/calendar/health?calendar_id=YOUR_CALENDAR_ID
```

### 3. Calendar Test Script
Pre-deployment testing tool:
```bash
python backend/scripts/test_calendar.py YOUR_CALENDAR_ID
```

### 4. Complete Documentation
- `docs/CALENDAR_FIX_SUMMARY.md` - Complete technical summary
- `docs/CALENDAR_TROUBLESHOOTING.md` - Step-by-step troubleshooting
- `docs/DEPLOYMENT_CHECKLIST.md` - Deployment procedures

## 🔥 Quick Fix Steps

### Step 1: Make Your Calendar Public (Most Common Fix!)

1. Go to https://calendar.google.com
2. Find your calendar in the left sidebar
3. Click the **⋮** (three dots) next to calendar name
4. Select **"Settings and sharing"**
5. Scroll to **"Access permissions for events"**
6. ✅ Check: **"Make available to public"**
7. Set visibility to: **"See all event details"**

### Step 2: Verify Calendar ID

In Calendar Settings:
1. Scroll to **"Integrate calendar"** section
2. Copy the **"Calendar ID"**
3. Update `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_GOOGLE_CALENDAR_ID=your-correct-id@group.calendar.google.com
   ```

### Step 3: Test It

**Option A - Browser Test:**
```
https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=YOUR_CALENDAR_ID
```

**Option B - Direct iCal Test:**
```
https://calendar.google.com/calendar/ical/YOUR_CALENDAR_ID/public/basic.ics
```
Should return calendar data starting with `BEGIN:VCALENDAR`

### Step 4: Deploy

```bash
git add .
git commit -m "fix: improve calendar error handling and add diagnostic tools"
git push origin main
```

Render and Vercel will auto-deploy.

## 🧪 Verify the Fix

After deployment:

1. **Backend Health Check:**
   ```
   https://project-art-c7eh.onrender.com/health
   ```
   Should return: `{"status": "healthy"}`

2. **Calendar Health Check:**
   ```
   https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=YOUR_ID
   ```
   Should return: `{"is_accessible": true}`

3. **Frontend Test:**
   - Visit: https://project-art-sigma.vercel.app
   - Check calendar widget
   - Open DevTools (F12) → Console
   - Should show no errors (or clear Thai messages if calendar isn't public)

## 🎯 Expected Results

### If Calendar IS Public:
- ✅ Calendar events load successfully
- ✅ No errors in console
- ✅ Widget displays events

### If Calendar is NOT Public:
- ✅ Clear Thai error message: "ไม่พบปฏิทิน - กรุณาตรวจสอบการตั้งค่า..."
- ✅ Console shows helpful debug info
- ✅ No confusing 502 errors

## 📊 Error Messages (Thai)

| Situation | Thai Message |
|-----------|-------------|
| Calendar not found (404) | "ไม่พบปฏิทิน - กรุณาตรวจสอบการตั้งค่าปฏิทินใน Google Calendar ให้เป็น สาธารณะ" |
| Access denied (403) | "ไม่สามารถเข้าถึงปฏิทินได้ - กรุณาตั้งค่าให้ปฏิทินเป็น สาธารณะ" |
| Connection failed (502/504) | "เชื่อมต่อ Google Calendar ไม่สำเร็จ - กรุณาลองใหม่อีกครั้ง" |

## 🆘 Still Having Issues?

### Issue: Health check returns `is_accessible: false`
**Fix:** Your calendar is not public. See Step 1 above.

### Issue: Backend returns 502 after deploying fix
**Fix:** Backend might be using old code or sleeping (free tier)
```bash
# Wake up backend
curl https://project-art-c7eh.onrender.com/health

# Wait 30 seconds, then retry
```

### Issue: Calendar ID looks weird/long
Your current ID: `935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com`

This is a **Group Calendar** with an encrypted ID. Make sure:
- The calendar exists
- You have owner/admin access
- It's set to PUBLIC (not just shared with specific people)

### Issue: Frontend still shows permission error
**Check:**
1. Is calendar public? (Step 1)
2. Is Calendar ID correct in `.env.local`?
3. Did Vercel deployment complete?
4. Is there a cached error in browser? (Clear cache / hard refresh: Ctrl+Shift+R)

## 📁 Files Changed

```
Backend Changes:
├── backend/app/api/v1/endpoints/calendar.py   (Enhanced error handling)
├── backend/scripts/test_calendar.py            (New test tool)

Frontend Changes:
├── frontend/src/components/Widgets/TaskListWidget.tsx  (Better error messages)

Documentation:
├── docs/CALENDAR_FIX_SUMMARY.md               (Technical summary)
├── docs/CALENDAR_TROUBLESHOOTING.md           (Troubleshooting guide)
├── docs/DEPLOYMENT_CHECKLIST.md               (Deployment guide)
└── README_CALENDAR_FIX.md                     (This file)
```

## 🔗 Quick Links

- **Backend API Docs:** https://project-art-c7eh.onrender.com/docs
- **Health Check:** https://project-art-c7eh.onrender.com/health
- **Frontend:** https://project-art-sigma.vercel.app
- **Render Dashboard:** https://dashboard.render.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Google Calendar:** https://calendar.google.com

## 💡 Pro Tips

1. **Test locally first** (if Python available):
   ```bash
   python backend/scripts/test_calendar.py YOUR_CALENDAR_ID
   ```

2. **Use health check in CI/CD:**
   ```bash
   curl "https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=$CALENDAR_ID" | jq '.is_accessible'
   ```

3. **Monitor Render logs** for 24 hours after deployment

4. **Consider Render paid tier** ($7/month) to avoid free-tier sleep issues

## ✨ Success Criteria

✅ Deployment successful when:
- Backend health endpoint returns 200
- Calendar health check works correctly
- Frontend shows Thai error messages (not generic 502)
- Calendar events load if calendar is public
- Console logs are clear and helpful

---

## 📞 Need More Help?

See detailed guides:
- **Full technical details:** `docs/CALENDAR_FIX_SUMMARY.md`
- **Troubleshooting steps:** `docs/CALENDAR_TROUBLESHOOTING.md`
- **Deployment guide:** `docs/DEPLOYMENT_CHECKLIST.md`

---

**Built with ❤️ to make calendar debugging easier!**
