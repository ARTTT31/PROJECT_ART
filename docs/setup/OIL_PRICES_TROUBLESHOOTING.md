# ⛽ Oil Prices API — Guide & Troubleshooting

## 🔍 Overview

The oil prices endpoint returns Thai retail fuel prices as JSON for the dashboard widget.

| Item | Value |
|---|---|
| **Provider** | Bangchak Open Web API — `https://oil-price.bangchak.co.th/ApiOilPrice2/en` |
| **Payload** | JSON (`OilList` array of `{OilName, PriceToday}`) |
| **Backend file** | `backend/app/api/v1/endpoints/oil_prices.py` |
| **Frontend widget** | `frontend/src/components/Widgets/OilPriceWidget.tsx` |
| **Auth** | None by design (the login screen renders the widget), bounded by the general rate limit |

> **Historical note.** An earlier version scraped the EPPO website (`eppo.go.th`) and parsed
> its HTML. The endpoint no longer calls EPPO, and the leftover `EPPO_OIL_URL` constant has
> since been deleted along with the HTML parser. Troubleshooting advice that mentions EPPO HTML
> structure, fuel-name image mapping, or `oil_name2.png` no longer applies — if you find such a
> section in an older copy of this document, it is obsolete.

---

## ⚙️ How It Works

Prices resolve in layers. Each response says which one answered via `source`.

```
GET /api/v1/oil-prices/oil-prices
        │
        ├─ 0. L1 in-process cache younger than CACHE_TTL (30 min) ──► return cached payload
        │
        ├─ 1. L2 `weather_cache` row (namespace "oil-prices") within the same TTL ──► return it
        │
        ├─ 2. Bangchak API
        │        HTTP 200 + at least one parsed price ──► cache in L1 *and* L2
        │        (source: "Bangchak / Retail Station", is_stale: false)
        │
        ├─ 3. Stale L1 entry (any age) ──► is_stale: true, source gets a " (cache)" suffix
        │
        ├─ 4. Stale L2 row (any age) ──► same flags
        │
        └─ 5. Hardcoded `_fallback_prices()` ──► is_stale: true,
                                                 fetched_at: null,
                                                 source: "Market Base Rate"
```

L1 is a module-level dict and dies with the process. L2 is the shared `weather_cache` table
(the same one the weather proxies use), so a restart, redeploy or scale event no longer comes
up empty while the provider is unreachable. A successful fetch writes both layers.

Fuel keys are normalised in this order: `benzene_95`, `gasohol_95`, `gasohol_91`,
`gasohol_e20`, `gasohol_e85`, `diesel`. Bangchak does not sell Benzene 95 directly, so its
price is derived as `gasohol_95 + 8.99` and falls back to a constant if gasohol is missing.

---

## 🧪 Testing

### Test 1: Provider health

```bash
curl "http://localhost:8080/api/v1/oil-prices/health"
```

Key fields: `is_accessible`, `message`, `cache_available`, `cache_age_seconds`,
`cache_is_fresh`, `last_fetch_success`.

### Test 2: Current prices

```bash
curl "http://localhost:8080/api/v1/oil-prices/oil-prices"
```

```json
{
  "success": true,
  "prices": [
    { "key": "gasohol_95", "name": "แก๊สโซฮอล์ 95", "price": 37.69, "unit": "บาท/ลิตร" }
  ],
  "update_date": "06/10/2026",
  "fetched_at": "2026-10-06T02:15:00Z",
  "is_stale": false,
  "source": "Bangchak / Retail Station"
}
```

### Test 3: Manual connectivity check

```bash
cd backend
python scripts/checks/check_oil_prices.py
```

This is a **manual** check, not part of the pytest suite (`pytest.ini` pins `testpaths = tests`).
It fetches the live provider and parses the response with the *same* parser the endpoint uses,
so a green run means the integration still works end to end.

---

## 🐛 Common Issues

### Issue 1: Widget shows an error / nothing at all

**Symptoms:** no prices rendered, or the card reports a failure.

**Checks:**
1. `curl ".../oil-prices/health"` — is `is_accessible` true?
2. Backend log for the real cause:
   - `⏱️ Bangchak fetch timeout: …` — provider is slow (10s timeout, 5s connect).
   - `❌ Bangchak API fetch failed: HTTP 403` — provider is blocking the egress IP or the
     User-Agent.
   - `❌ Bangchak fetch error: …` — DNS/TLS/connection problem.
3. Rate limit: the endpoint shares `RATE_LIMIT_GENERAL_PER_MINUTE`. A `429` means the caller
   (or a shared IP) exhausted it, not that the provider is down.

### Issue 2: "ข้อมูลอาจไม่เป็นปัจจุบัน" is displayed

**Symptoms:** the widget renders a warning badge; the response has `is_stale: true`.

**Meaning:** the provider fetch failed and the widget is showing older data on purpose — stale
data beats an empty card. This is **expected behaviour**, not a bug.

**What to do:**
1. Confirm with `source`: `"… (cache)"` means a stale cache layer answered, `"Market Base Rate"`
   means the maintained constants did.
2. If it persists, the provider is failing — work through Issue 1.
3. A restart clears L1 only; the L2 row keeps answering with the last known good prices, so the
   widget degrades to stale data rather than to constants.

### Issue 3: Prices come from the hardcoded fallback

**Symptoms:** `source` is `"Market Base Rate"`, `fetched_at` is `null`, prices look frozen.

**Meaning:** the provider failed **and** neither cache layer had anything — which now means the
endpoint has never completed a successful fetch (a brand-new deployment, or a database that was
unreachable when it did). Since every successful fetch is written to the shared table, a plain
restart is no longer enough to reach this layer.

**If the fallback figures themselves are wrong:** update `_fallback_prices()` in
`backend/app/api/v1/endpoints/oil_prices.py`. They are intentionally explicit constants
(Bangkok & perimeter) rather than a formula, so they must be maintained by hand.

### Issue 4: The provider replies but no prices are parsed

**Symptoms:** `⚠️ Bangchak API payload parsed but no prices extracted` in the log.

**Cause:** `_parse_bangchak_data()` matches on `OilName` substrings
(`"Gasohol 95"`, `"Gasohol 91"`, `"E20"`, `"E85"`, `"Hi Diesel S"`, …). If Bangchak renames a
product, that entry silently disappears and the response simply contains fewer fuel types.

**Fix:** add the new name to the matching branch. Be careful with two traps:
- `Gasohol 95` must exclude `Super`/`Premium` variants, otherwise the premium grade overwrites
  the standard price.
- Diesel must exclude `B20`, which is a different product.

### Issue 5: Fuel prices appear in the wrong cells

**Cause:** the order of the returned list is fixed by `ORDERED_KEYS`, **not** by the provider
payload. Reordering that constant reorders the widget.

### Issue 6: A hard refresh does not change anything

The backend caches for 30 minutes, so the browser and the API can both be serving the same
stale payload. Wait out `CACHE_TTL`, or restart the backend to drop the in-process cache.

---

## 🔧 Backend Configuration

| Setting | Location | Current value |
|---|---|---|
| `BANGCHAK_OIL_URL` | `oil_prices.py` | `https://oil-price.bangchak.co.th/ApiOilPrice2/en` |
| `CACHE_TTL` | `oil_prices.py` | `1800` seconds (30 minutes) — applies to L1 and L2 |
| `NS_OIL_PRICES` / `_L2_KEY` | `oil_prices.py` | `"oil-prices"` / `("latest",)` in the shared `weather_cache` table |
| `ORDERED_KEYS` | `oil_prices.py` | display order of the six fuel types |
| Request timeout | `oil_prices.py` | 10s total / 5s connect (health check: 5s / 3s) |
| `User-Agent` | `oil_prices.py` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64)` |

> ✅ TLS certificate validation is enabled on both `httpx.AsyncClient` calls. It used to be
> disabled with `verify=False`; `scripts/checks/check_oil_prices.py` fetches the same URL with
> verification on and succeeds, so the unvalidated path was removed rather than kept.

---

## 🎯 Frontend Configuration

In `frontend/src/components/Widgets/OilPriceWidget.tsx`:

```typescript
const OIL_CACHE_TTL_MS = 30 * 60_000                       // localStorage cache: 30 min
const interval = setInterval(() => fetchPrices({ refresh: true }), 300_000) // 5 min
```

The widget reads `is_stale` (to show the warning badge) and `update_date`. `source` and
`fetched_at` are part of the payload type but are **not** rendered anywhere in the widget.

---

## 📊 API Reference

### `GET /api/v1/oil-prices/health`

Returns provider reachability plus cache state. Never fails hard: provider errors are reported
in `message` and `is_accessible: false`.

### `GET /api/v1/oil-prices/oil-prices`

| Field | Meaning |
|---|---|
| `success` | Always `true`; failures are reported through `is_stale` / `source` |
| `prices[]` | `key`, `name` (Thai), `price`, `unit` = `บาท/ลิตร` |
| `update_date` | `DD/MM/YYYY` (provider day, or today for the fallback layer) |
| `fetched_at` | ISO-8601 UTC of the successful fetch, or `null` for the fallback layer |
| `is_stale` | `true` when layer 2 or 3 answered |
| `source` | `"Bangchak / Retail Station"`, `"… (cache)"`, or `"Market Base Rate"` |

---

## 🔍 Monitoring

Log lines worth alerting on (`logger.warning` / `logger.error` in `oil_prices.py`):

```
Returning stale process cache due to fetch failure
Returning stale persistent cache due to fetch failure
Returning hardcoded fallback prices
Bangchak API fetch failed: HTTP <code>
Bangchak fetch timeout: <error>
Bangchak API payload parsed but no prices extracted
Serving oil prices from the persistent cache
```

`"Returning hardcoded fallback prices"` is the strongest signal: it means the dashboard is
showing numbers that are no longer live. `"Returning stale persistent cache…"` is the milder
one — the numbers are the last real ones, served from the database.

---

## ⚠️ Known Limitations

1. **One provider.** There is no secondary source: when Bangchak is unavailable the endpoint
   degrades to cache, then to hand-maintained constants.
2. **Cache rows are pruned.** `weather_cache` deletes rows older than 30 days, keeping the
   newest row of each namespace. If the provider has been failing for longer than that, the
   stale layer is the maintained constants.
3. **The health endpoint reads L1 only.** `GET /api/v1/oil-prices/health` reports
   `cache_available` / `cache_age_seconds` from the process cache, so it can say “no cache”
   immediately after a restart even when a fresh L2 row exists. The main endpoint is what
   decides what users see.
4. **Key-name coupling.** Parsing depends on Bangchak's product names
   (`Gasohol 95`, `Hi Diesel S`, …). A rename silently drops a fuel type; the health endpoint
   and the manual check script are the fastest way to notice.
