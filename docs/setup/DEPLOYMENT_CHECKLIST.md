# 🚀 Deployment Checklist - Backend Calendar Fix

## Changes Made

### Backend Changes (`backend/app/api/v1/endpoints/calendar.py`)

✅ **Improved Error Handling:**
- Added specific 404 and 403 error handling for Google Calendar
- Better error messages explaining how to fix calendar permissions
- Added calendar ID validation
- Added `follow_redirects=True` to httpx client
- Improved exception handling with detailed traceback logging

✅ **New Health Check Endpoint:**
- Added `/api/v1/calendar/health` endpoint
- Tests calendar accessibility without fetching all events
- Returns clear status and instructions

### Frontend Changes (`frontend/src/components/Widgets/TaskListWidget.tsx`)

✅ **Better User Feedback:**
- Status-code-specific Thai error messages
- 404: "ไม่พบปฏิทิน - กรุณาตรวจสอบการตั้งค่าปฏิทินใน Google Calendar ให้เป็น สาธารณะ"
- 403: "ไม่สามารถเข้าถึงปฏิทินได้ - กรุณาตั้งค่าให้ปฏิทินเป็น สาธารณะ"
- 502/504: "เชื่อมต่อ Google Calendar ไม่สำเร็จ - กรุณาลองใหม่อีกครั้ง"
- Improved console logging with emoji indicators

### Documentation

✅ **Created Troubleshooting Guide:**
- `docs/CALENDAR_TROUBLESHOOTING.md` - Complete guide for fixing calendar issues
- `docs/DEPLOYMENT_CHECKLIST.md` - This file

---

## 🔍 Pre-Deployment Testing

### Local Testing (Backend)

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies (if not done)
pip install -r requirements.txt

# 3. Run backend locally
python -m app.main

# 4. Test health endpoint
curl http://localhost:8080/health

# 5. Test calendar health check
curl "http://localhost:8080/api/v1/calendar/health?calendar_id=YOUR_CALENDAR_ID"
```

### Local Testing (Frontend)

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Verify environment variables in .env.local
cat .env.local | grep CALENDAR

# 3. Run frontend
npm run dev

# 4. Open browser: http://localhost:3000
# 5. Check calendar widget loads without errors
```

---

## 📦 Deployment Steps

### Step 1: Deploy Backend to Render

```bash
# From project root
git add backend/app/api/v1/endpoints/calendar.py
git commit -m "fix: improve calendar error handling and add health check endpoint"
git push origin main
```

**Render will auto-deploy. Monitor the deployment:**
1. Go to https://dashboard.render.com
2. Select your backend service
3. Watch the "Events" tab for deployment progress
4. Check "Logs" tab for any errors

**Verify Backend Deployment:**
```bash
# Test health endpoint
curl https://project-art-c7eh.onrender.com/health

# Test calendar health check with your calendar ID
curl "https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=935e8829bdbff55e909d6f3e533ded8a03acfbc24ac08b5d8ac781ed5e07f626@group.calendar.google.com"
```

### Step 2: Deploy Frontend to Vercel

```bash
# From project root
git add frontend/src/components/Widgets/TaskListWidget.tsx
git add docs/
git commit -m "fix: add user-friendly Thai error messages for calendar issues"
git push origin main
```

**Vercel will auto-deploy. Monitor the deployment:**
1. Go to https://vercel.com/dashboard
2. Select `project-art` project
3. Watch deployment progress
4. Check deployment logs

**Verify Frontend Deployment:**
1. Visit https://project-art-sigma.vercel.app
2. Open browser DevTools (F12)
3. Check Console tab for errors
4. Verify calendar widget behavior

---

## ✅ Post-Deployment Verification

### 1. Backend Health Check
```bash
curl https://project-art-c7eh.onrender.com/health
```
Expected: `{"status": "healthy", ...}`

### 2. Calendar Health Check
```bash
curl "https://project-art-c7eh.onrender.com/api/v1/calendar/health?calendar_id=YOUR_CALENDAR_ID"
```
Expected: `{"is_accessible": true, ...}` (if calendar is public)

### 3. Frontend Calendar Widget
- [ ] Load https://project-art-sigma.vercel.app
- [ ] Calendar widget displays without permission error
- [ ] Events load (if calendar is public and has events)
- [ ] No console errors (except expected ones)

### 4. Error Handling Test
If calendar is NOT public (to verify error messages work):
- [ ] Widget shows Thai error message
- [ ] Console shows detailed error
- [ ] No JavaScript crashes

---

## 🐛 Troubleshooting Deployment Issues

### Backend Deployment Failed
```bash
# Check Render logs
# Common issues:
# 1. Missing dependencies in requirements.txt
# 2. Syntax errors
# 3. Import errors

# Verify requirements.txt has:
# fastapi
# httpx
# icalendar
# pytz
```

### Frontend Deployment Failed
```bash
# Check Vercel logs
# Common issues:
# 1. TypeScript errors
# 2. Build errors
# 3. Environment variables missing

# Verify build locally:
cd frontend
npm run build
```

### Calendar Still Returns 404
```bash
# Verify calendar is public:
# 1. Go to Google Calendar
# 2. Calendar Settings → Access permissions
# 3. Check "Make available to public"
# 4. Set to "See all event details"

# Test direct iCal access:
curl "https://calendar.google.com/calendar/ical/YOUR_CALENDAR_ID/public/basic.ics"
# Should return: BEGIN:VCALENDAR...
```

### CORS Errors in Browser
```bash
# Verify frontend URL is in backend CORS_ORIGINS
# Check Render environment variables:
# CORS_ORIGINS should include:
# https://project-art-sigma.vercel.app

# Or update in Render dashboard:
# Dashboard → Service → Environment → CORS_ORIGINS
```

---

## 🔄 Rollback Plan (If Needed)

If new changes cause issues:

### Backend Rollback
```bash
# In Render Dashboard:
# 1. Go to "Events" tab
# 2. Find previous successful deployment
# 3. Click "Redeploy"
```

### Frontend Rollback
```bash
# In Vercel Dashboard:
# 1. Go to "Deployments" tab
# 2. Find previous successful deployment
# 3. Click "..." → "Promote to Production"
```

### Git Rollback
```bash
# Revert commits
git revert HEAD
git push origin main
```

---

## 📊 Monitoring

### Key Metrics to Watch
1. **Backend Response Time** (Render Dashboard → Metrics)
2. **Error Rate** (Check logs for 502/404/500 errors)
3. **Frontend Load Time** (Vercel Analytics)
4. **User Reports** (Calendar not loading)

### Log Monitoring Commands
```bash
# Backend logs (Render CLI if installed)
render logs --tail

# Or via dashboard:
# Render Dashboard → Logs → Filter by "calendar"
```

---

## 🎯 Success Criteria

Deployment is successful when:
- ✅ Backend health endpoint returns 200
- ✅ Calendar health check accurately reports calendar status
- ✅ Frontend displays appropriate error messages (Thai)
- ✅ No 502 errors when calendar is actually accessible
- ✅ Clear guidance shown when calendar is not public
- ✅ Console logs are informative but not cluttered

---

## 📝 Environment Variables Reference

### Backend (Render)
Required:
- `DATABASE_URL` - Database connection string
- `SECRET_KEY` - JWT secret key (min 32 chars)
- `CORS_ORIGINS` - Comma-separated list including frontend URL

Optional:
- `DEBUG` - Set to `false` for production
- `AUTO_CREATE_TABLES` - Set to `true` for first deploy

### Frontend (Vercel)
Required:
- `NEXT_PUBLIC_API_URL` - Backend URL (https://project-art-c7eh.onrender.com)
- `NEXT_PUBLIC_GOOGLE_CALENDAR_ID` - Your public calendar ID

Optional:
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - For Google Sign-In

---

## 🎓 Lessons Learned

1. **Always validate external API accessibility** before assuming backend errors
2. **Provide user-friendly localized error messages** (Thai in this case)
3. **Add health check endpoints** for critical integrations
4. **Log detailed errors on backend** but show simple messages to users
5. **Test with actual public calendars** before deploying

---

## 📞 Next Steps After Deployment

1. **Monitor Render logs** for first 24 hours
2. **Check Vercel analytics** for error spikes
3. **Test from different devices** (mobile, desktop)
4. **Update documentation** if issues arise
5. **Consider Render upgrade** if free tier sleep causes issues

---

## ✨ Optional Enhancements (Future)

- [ ] Add calendar caching on backend (Redis)
- [ ] Implement retry logic with exponential backoff
- [ ] Add Sentry/monitoring integration
- [ ] Create calendar admin UI for easy configuration
- [ ] Support multiple calendars
- [ ] Add webhook support for real-time updates
