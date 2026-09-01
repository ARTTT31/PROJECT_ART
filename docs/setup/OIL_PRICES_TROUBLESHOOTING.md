# ⛽ Oil Prices API Troubleshooting Guide

## 🔍 Overview

Oil Prices API scrapes retail fuel prices from the **EPPO (Energy Policy and Planning Office)** website and displays them in the frontend widget.

**Data Source:** https://www.eppo.go.th/templates/eppo_v15_mixed/eppo_oil/eppo_oil_gen_new.php

---

## ✅ How It Works

1. **Backend** scrapes EPPO website HTML
2. **Parses** PTT column prices for each fuel type
3. **Caches** data for 1 hour to reduce load
4. **Falls back** to stale cache or hardcoded prices if EPPO is down
5. **Frontend** displays prices with automatic refresh every 5 minutes

---

## 🧪 Testing

### Test 1: EPPO Health Check

```bash
curl "https://project-art-c7eh.onrender.com/api/v1/oil-prices/health"
```

**Expected Success Response:**
```json
{
  "service": "Oil Prices API",
  "eppo_url": "https://www.eppo.go.th/...",
  "cache_age_seconds": 300,
  "cache_available": true,
  "cache_is_fresh": true,
  "is_accessible": true,
  "message": "✅ EPPO is accessible and returning 6 prices",
  "last_fetch_success": true
}
```

### Test 2: Get Oil Prices

```bash
curl "https://project-art-c7eh.onrender.com/api/v1/oil-prices/oil-prices"
```

**Expected Success Response:**
```json
{
  "success": true,
  "prices": [
    {
      "key": "gasohol_95",
      "name": "แก๊สโซฮอล์ 95",
      "price": 43.10,
      "unit": "บาท/ลิตร"
    },
    ...
  ],
  "update_date": "01/07/2026",
  "fetched_at": "2026-07-01T10:00:00Z",
  "is_stale": false,
  "source": "EPPO"
}
```

### Test 3: Python Test Script

```bash
python backend/scripts/test_oil_prices.py
```

**Expected Output:**
```
🧪 EPPO Oil Prices Connection Test
🔗 URL: https://www.eppo.go.th/...
📡 HTTP Status: 200
✅ EPPO website is accessible!
✅ Oil prices parsed successfully!
📊 Found 6 fuel types

📋 Current Oil Prices:
  • แก๊สโซฮอล์ 95       43.10 บาท/ลิตร
  • แก๊สโซฮอล์ 91       42.73 บาท/ลิตร
  ...
🎉 SUCCESS! EPPO oil prices are accessible and valid.
```

---

## 🐛 Common Issues

### Issue 1: "เชื่อมต่อ EPPO ไม่สำเร็จ"

**Symptoms:**
- Frontend shows error message
- Widget displays hardcoded fallback prices
- `is_stale: true` in API response

**Causes:**
1. EPPO website is down or slow
2. EPPO is blocking the request
3. Network connectivity issues
4. Backend is sleeping (free tier Render)

**Solutions:**

**A. Check if EPPO is accessible:**
```bash
curl -I "https://www.eppo.go.th/templates/eppo_v15_mixed/eppo_oil/eppo_oil_gen_new.php"
```
Should return `HTTP/2 200`

**B. Test health check:**
```bash
curl "https://project-art-c7eh.onrender.com/api/v1/oil-prices/health"
```

**C. Check backend logs (Render):**
- Look for "EPPO scrape failed" or "EPPO fetch timeout"
- May show specific HTTP error codes

**D. Wake up backend if sleeping:**
```bash
curl https://project-art-c7eh.onrender.com/health
# Wait 30 seconds, then retry
```

---

### Issue 2: Stale Cache Warning

**Symptoms:**
- Widget shows: "ข้อมูลอาจไม่เป็นปัจจุบัน"
- `is_stale: true` in response
- Source shows "(cache)" suffix

**Causes:**
- EPPO fetch failed, serving old cached data
- Cache is older than 1 hour but better than nothing

**Solution:**
This is **expected behavior** when EPPO is temporarily unavailable. The widget automatically:
1. Shows a warning indicator
2. Displays cached data (better than no data)
3. Continues trying to fetch fresh data every 5 minutes

**Manual refresh:**
1. Click refresh button in widget (if available)
2. Wait for next auto-refresh (5 minutes)
3. Hard refresh page (Ctrl+Shift+R)

---

### Issue 3: Hardcoded Fallback Prices

**Symptoms:**
- Source shows: "Hardcoded fallback"
- Prices look outdated
- `fetched_at: null` in response

**Causes:**
- EPPO is completely unreachable
- No cache available
- Both live fetch and cache failed

**Solution:**
1. **Check EPPO status:** Visit https://www.eppo.go.th directly
2. **Wait for EPPO to recover:** Fallback ensures widget still works
3. **Monitor backend logs:** Check if scraping errors persist
4. **Update fallback prices:** Edit `backend/app/api/v1/endpoints/oil_prices.py` → `_fallback_prices()`

---

### Issue 4: HTML Parsing Failed

**Symptoms:**
- Backend logs show: "EPPO HTML parsed but no prices found"
- Health check shows: `last_fetch_success: false`
- Widget shows error or fallback

**Causes:**
- **EPPO changed their HTML structure** (most common)
- Scraping regex patterns are outdated
- EPPO showing maintenance page

**Solution:**
**This requires code update!**

1. **Check EPPO page manually:**
   Visit the EPPO URL and inspect the HTML structure

2. **Update regex patterns:**
   Edit `backend/app/api/v1/endpoints/oil_prices.py` → `_parse_eppo_html()`

3. **Test locally:**
   ```bash
   python backend/scripts/test_oil_prices.py
   ```

4. **Deploy update:**
   ```bash
   git add backend/app/api/v1/endpoints/oil_prices.py
   git commit -m "fix: update EPPO scraping patterns"
   git push
   ```

---

### Issue 5: Wrong Fuel Prices Order

**Symptoms:**
- Fuel types display in wrong order
- Some fuels missing

**Solution:**
Check `IMAGE_MAP` order in `backend/app/api/v1/endpoints/oil_prices.py`:
```python
IMAGE_MAP: list[tuple[str, str, str]] = [
    ("oil_name2.png", "gasohol_95", "แก๊สโซฮอล์ 95"),
    ("oil_name3.png", "gasohol_91", "แก๊สโซฮอล์ 91"),
    # ... order determines display order
]
```

---

## 🔧 Backend Configuration

### Cache Settings

```python
CACHE_TTL = 3600  # 1 hour in seconds
```

**Modify this** in `backend/app/api/v1/endpoints/oil_prices.py` if needed.

### EPPO URL

```python
EPPO_OIL_URL = "https://www.eppo.go.th/templates/eppo_v15_mixed/eppo_oil/eppo_oil_gen_new.php"
```

**Update this** if EPPO changes the URL.

### User-Agent

```python
headers={"User-Agent": "Mozilla/5.0 (compatible; ART-Workspace/1.0)"}
```

Some websites require a realistic User-Agent to avoid blocking.

---

## 🎯 Frontend Configuration

### Auto-Refresh Interval

In `frontend/src/components/Widgets/OilPriceWidget.tsx`:
```typescript
const interval = setInterval(() => fetchPrices({ refresh: true }), 300000) // 5 minutes
```

**Change `300000`** (milliseconds) to adjust refresh frequency.

### Cache TTL

```typescript
const OIL_CACHE_TTL_MS = 30 * 60_000 // 30 minutes
```

Frontend caches prices in localStorage to reduce load.

---

## 📊 API Endpoints Reference

### Health Check
```
GET /api/v1/oil-prices/health
```
Returns EPPO connectivity status and cache state.

### Get Oil Prices
```
GET /api/v1/oil-prices/oil-prices
```
Returns current oil prices (from EPPO, cache, or fallback).

---

## 🔍 Monitoring & Debugging

### Check Backend Logs (Render)

Look for these log messages:

✅ **Success:**
```
✅ Serving oil prices from fresh cache
✅ Successfully fetched 6 oil prices from EPPO
```

⚠️ **Warnings:**
```
⚠️ EPPO HTML parsed but no prices found
⚠️ Returning stale cache due to fetch failure
⚠️ Returning hardcoded fallback prices
```

❌ **Errors:**
```
❌ EPPO scrape failed: HTTP 403
⏱️ EPPO fetch timeout: ...
🌐 EPPO HTTP error: ...
```

### Check Frontend Console

Open DevTools (F12) → Console:

✅ **Success:**
- No errors related to oil prices

⚠️ **Warnings:**
```
🌐 EPPO connection error, using fallback data: ...
```

❌ **Errors:**
```
❌ Oil price fetch error: ...
```

### Network Tab Analysis

1. Open DevTools (F12) → Network
2. Filter: `/oil-prices`
3. Check:
   - Status code (should be 200)
   - Response time
   - Response data structure

---

## 🆘 Emergency Procedures

### EPPO is Completely Down

1. **Verify downtime:**
   ```bash
   curl -I https://www.eppo.go.th
   ```

2. **Check status:**
   - Widget will show hardcoded fallback prices
   - Warning indicator appears
   - Source shows "Hardcoded fallback"

3. **No action needed:**
   - System automatically falls back
   - Users see outdated but reasonable prices
   - Auto-recovery when EPPO returns

### Update Fallback Prices

If fallback prices become too outdated:

1. **Edit `backend/app/api/v1/endpoints/oil_prices.py`**
2. **Update `_fallback_prices()` function:**
   ```python
   def _fallback_prices():
       return {
           "success": True,
           "prices": [
               {"key": "gasohol_95", "name": "แก๊สโซฮอล์ 95", "price": 43.10, ...},
               # Update prices here
           ],
           ...
       }
   ```
3. **Deploy:**
   ```bash
   git add backend/app/api/v1/endpoints/oil_prices.py
   git commit -m "chore: update fallback oil prices"
   git push
   ```

---

## 💡 Best Practices

1. ✅ **Monitor EPPO health** regularly using health check endpoint
2. ✅ **Test before deployment** using `test_oil_prices.py`
3. ✅ **Keep fallback prices updated** (manually every 3-6 months)
4. ✅ **Check backend logs** if users report wrong prices
5. ✅ **Accept stale cache gracefully** - better than no data
6. ✅ **Don't rely solely on EPPO** - always have fallback strategy

---

## 🎓 Understanding the Fallback Strategy

The API uses a **3-tier fallback** system:

```
1. Fresh EPPO data (best)
     ↓ (if fails)
2. Stale cache (good enough)
     ↓ (if no cache)
3. Hardcoded fallback (last resort)
```

This ensures:
- ✅ Widget never completely fails
- ✅ Users always see some price data
- ✅ Graceful degradation when EPPO is down
- ✅ Automatic recovery when EPPO returns

---

## 📞 Support

If issues persist:

1. **Run health check:** `/api/v1/oil-prices/health`
2. **Run test script:** `python backend/scripts/test_oil_prices.py`
3. **Check backend logs:** Render Dashboard → Logs
4. **Verify EPPO status:** Visit https://www.eppo.go.th
5. **Check frontend console:** Browser DevTools → Console

---

## 🔗 Quick Reference

| Item | Value |
|------|-------|
| EPPO URL | https://www.eppo.go.th/templates/eppo_v15_mixed/eppo_oil/eppo_oil_gen_new.php |
| Health Check | https://project-art-c7eh.onrender.com/api/v1/oil-prices/health |
| Get Prices | https://project-art-c7eh.onrender.com/api/v1/oil-prices/oil-prices |
| Cache TTL | 1 hour (backend), 30 minutes (frontend) |
| Auto-refresh | Every 5 minutes |
| Test Script | `backend/scripts/test_oil_prices.py` |

---

**Built with resilience in mind! ⛽**
