# Dashboard Widgets

Current state only. Removed widgets (Calendar, SharePoint TaskList) and the
per-widget style tweaks they left behind are not documented here — git history
has them.

## Active widgets (2026-10-30)

| Widget | Size | Data | Notes |
|---|---|---|---|
| หน้าหลัก greeting / widget manager | — | Local | Drag to reorder (dnd-kit), show/hide per account |
| 📝 `QuickNotesWidget` | S/M/L | `/profile/quick-notes` | Autosave, flushed on unmount, cache keyed per account |
| 🧮 `PriceCalcWidget` | S/M/L | Client-side | Selling price, discount, profit, margin |
| 📈 `MarketWidget` | S/M/L | `/market/*` | Currency, Thai/COMEX gold, SET, in-app candles |
| 💰 `FinanceWidget` | S/M/L | `/profile/finance` | Income/expense tracker — see below |
| ⭐ `WatchlistWidget` | S/M/L | `/market/quotes` | Followed symbols, queued saves |
| 🔄 `CurrencyConverterWidget` | S/M/L | `/market/summary` | Daily reference rates |
| 🌤️ `WeatherWidget` | S/M/L | Open-Meteo + MET Norway, Open-Meteo AQI | GPS + district-level Thai names |
| 🇹🇭 `HolidayWidget` | S/M/L | Bundled Thai calendars (2026, 2027) | No network needed |
| ⛽ `OilPriceWidget` | S/M/L | Bangchak API via backend | Cached fallback when upstream throttles |
| ⚽ `PremierLeagueWidget` | S/M/L | ESPN scoreboard via `/football/premier-league?date=YYYY-MM-DD` | Team badges, day-by-day browsing, live scores (1-min refresh), results/fixtures, stale fallback |
| 📱 `QRCodeWidget` | S/M/L | Client-side | QR and barcode generation |

## 💰 Finance widget (October 2026)

Quick capture lives on the dashboard; analysis lives in the summary dialog
opened from the widget header ("ภาพรวม").

**Dashboard card**

- Add income/expense with a label, amount, **date** (backdating is allowed), and
  an optional **category** (free text with suggestions).
- Today's totals stay in sync after midnight without a reload.
- Edit any entry (including its date) with the pencil button; delete with an
  inline **undo** bar (8 seconds) instead of a blocking confirm dialog.
- Monthly budget bar with an over-budget warning, when a budget is set.
- Saves are whole-list PUTs, so each save first merges entries another tab or
  device added instead of overwriting them. Failed saves retry when the
  connection returns.

**Summary dialog**

- Period picker: any month that has entries (current month first), plus
  **ทุกเดือน (สะสม)**.
- Totals for the period (income, expense, balance, count), a six-month
  income/expense bar chart, and a per-category breakdown.
- Search by label/category and filter by type (ทั้งหมด / รายรับ / รายจ่าย).
- Entries grouped by day ("วันนี้", "เมื่อวาน", then dated).
- **CSV export** of the selected period (UTF-8 with BOM so Excel reads Thai).
- Set or clear the monthly budget and see the current usage against it.

**Storage and limits**

- One row per entry in `finance_entries` (amount as `Numeric(14,2)`, the list
  order kept in `position`), the monthly budget in `finance_settings`, and
  cross-device deletions in `finance_deleted_entries` — all served by
  `GET/PUT /profile/finance` with the same request and response body as before.
- Cap: **2,000 entries** per account (client and server agree). Amounts must be
  above 0 and at most 1,000,000,000.
- A deletion made on one device is recorded as a tombstone (90-day TTL, at most
  500 ids) and returned as `deleted_ids`, so a second device holding an older
  copy drops the row instead of writing it back. Re-adding the same id is an
  undo and clears its tombstone.

## 🌤️ Weather resilience (October 2026)

- Automatic failover to MET Norway (`api.met.no` Locationforecast 2.0) when
  Open-Meteo returns `429` (Render's shared egress IP is throttled) or `5xx`.
- Automatic failover to OpenStreetMap Nominatim when BigDataCloud geocoding
  fails, so Thai districts and cities keep resolving.
- Coordinates are returned even when every geocoder is down — the endpoint never
  answers `502` for this widget.
- Two cache tiers: in-process L1 and the `weather_cache` table, so the last known
  good payload survives restarts and cold starts.
