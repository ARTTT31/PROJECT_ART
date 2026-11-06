# Roadmap & Feature Inventory

**Last updated:** November 6, 2026

> **Sources of truth.** This file inventories what exists and what is planned. It must not
> restate or contradict the documents that own those decisions:
>
> - Product brief, users, brand personality: [`PRODUCT.md`](../../PRODUCT.md)
> - Design language, colour, typography, motion: [`DESIGN.md`](../../DESIGN.md) and
>   [`design-system/art-workspace/MASTER.md`](../../design-system/art-workspace/MASTER.md)
> - Architecture, verified test state, known gaps:
>   [`docs/internal/project-analysis.md`](../internal/project-analysis.md)
>
> An earlier revision of this file declared gradients and glassmorphism part of the brand and
> targeted WCAG AAA. Both contradicted the Apple-HIG design system ("no decorative gradients;
> elevation comes from surface colour and hairline borders") and the AA target in `PRODUCT.md`.
> Those claims were removed rather than left competing with the authority above.

---

## Shipped

### Pages

| Route | Purpose |
|---|---|
| `/login` | Email/password sign-in |
| `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Registration policy, password self-service, email verification |
| `/dashboard` | Widget grid — rearrange, resize (S/M/L), show/hide |
| `/profile` | Name/email/password, Quick Links, main-menu config, camera config, per-account branding |
| `/admin` | Admin console — registration policy, pending approvals, user management |
| `/audit` | Searchable/filterable activity log (admin only) |
| `/camera` | CCTV monitor — permission-gated per user |

### Dashboard widgets

| Widget | Sizes | Data source |
|---|---|---|
| โน้ตด่วน / To-do วันนี้ (notes) | S/M/L | Per-account JSON via `/profile/quick-notes` |
| คิดราคา / กำไร (calc) | S/M/L | Client-side |
| ค่าเงิน · ทอง · SET (market) | S/M/L | Frankfurter, Thai Gold API, Yahoo Finance, via the backend proxy; candle chart drawn in-app |
| รายรับ – รายจ่ายวันนี้ (finance) | S/M/L | Per-account JSON via `/profile/finance`; summary dialog with monthly/all-time totals, categories, 6-month trend, CSV export, undo and a monthly budget |
| รายการติดตาม (watchlist) | S/M/L | Yahoo Finance quotes via `/market/quotes` |
| แปลงสกุลเงิน (converter) | S/M/L | Frankfurter rates via `/market/summary` |
| วันหยุดนักขัตฤกษ์ (holidays) | S/M/L | Confirmed Thai calendars bundled in the repo (2026, 2027) |
| สภาพอากาศ & PM 2.5 (weather) | S/M/L | Open-Meteo + MET Norway (weather), Open-Meteo (AQI), BigDataCloud + OSM Nominatim (geocode), via backend proxy |
| ราคาน้ำมัน (oil price) | S/M/L | Bangchak Open Web API, via the backend proxy |
| QR Code | S/M/L | Client-side |

### Platform

- **Auth:** PyJWT access/refresh in HTTP-only cookies, CSRF double-submit token, account lockout
  (5 attempts -> 30 min), session tracking (IP / user agent / device).
- **Authorisation:** `role` plus per-user `accessible_pages`; the sidebar and profile page hide
  what a user cannot reach, and the backend enforces page access for page-scoped APIs.
- **Admin:** a dedicated `/admin` console for user management, page-permission editing,
  password reset/lockout reset, registration policy and pending approvals; `/audit` adds a
  searchable, paginated activity log.
- **Personalisation:** per-account workspace name/tagline/logo, sidebar menu order stored on the
  account (not localStorage), dashboard layout, quick notes, finance entries and watchlist.
- **Market data:** authenticated proxy for exchange rates, Thai gold, COMEX gold, the SET index,
  watchlist quotes and OHLC candles; every provider degrades independently.
- **Notifications:** notification bell with derived alerts (holidays, weather, oil prices) plus
  a live WebSocket feed. The socket authenticates during the handshake and the connection
  registry is capped per user; broadcasts are admin-only and fan out through Redis pub/sub
  when `WS_BROADCAST_REDIS_URL` is set.
- **Resilience:** the weather/geocode proxies retry throttled upstreams and automatically fail over
  to secondary providers (MET Norway for weather forecast, OpenStreetMap Nominatim for GPS address lookup);
  fall back to stale data and persist the last known good payload in `weather_cache`; oil prices use the
  same table before dropping to maintained constants. Each namespace keeps its newest row past the
  30-day retention window, so the fallback survives a cold start.
- **Security:** per-path CSP (`default-src 'none'` everywhere except `/docs`, `/redoc` and
  `/openapi.json`), HSTS, `nosniff`/`DENY` headers, rate limiting keyed on a client address
  that only a trusted proxy may assert, API docs off unless opted in, startup refusal on a
  weak `SECRET_KEY`.
- **Operations:** Sentry (opt-in via `SENTRY_DSN`), `/health` (liveness + database status) and
  `/health/ready` (503 when the database is down) plus an admin-only system health report,
  `X-Request-ID` on every response and on every log line, scheduled session cleanup, Alembic
  migrations as the only schema authority (`alembic check` runs in CI), GitHub Actions CI,
  Dependabot updates.

---

## Constraints (accepted, documented)

| Constraint | Detail |
|---|---|
| Single instance by default | The WebSocket registry can fan out through Redis (`WS_BROADCAST_REDIS_URL`) and the rate limiter can use Redis (`SLOWAPI_STORAGE_URI`), but both default to process-local and startup logs a `[SCALING]` notice. See README -> *Horizontal scaling*. |
| Third-party market data | Yahoo Finance / Frankfurter / Thai Gold API have no SLA; the widget shows the last known value (or an empty block) rather than failing the whole page. |
| Thai-only UI | All copy is hardcoded Thai; there is no i18n layer. |
| Partial frontend coverage | 275 Vitest tests cover logic and most widgets, but 58 of 87 components/pages still have no test file; `npm run test:coverage` reports the real number. Playwright now also runs axe checks on the auth pages and a live register → login E2E against the backend in CI. |

---

## Next Roadmap (Active & Planned)

### Phase 1: Productivity, Usability & Maintenance (In Progress)

1. **Dependabot Optimization (Maintenance)**
   - Group updates and switch schedule to monthly with lower open PR limit to prevent remote branch clutter while keeping dependencies updated.
2. **Focus Timer / Pomodoro Widget (Dashboard)**
   - Apple HIG styled circular progress timer (25m Focus / 5m Short Break / 15m Long Break).
   - Springy controls (`active:scale-[0.95]`), session counters, gentle audio notification chime, full S/M/L responsive sizing.
3. **Workspace Data Backup & Restore (Profile / Data Portability)**
   - One-click full workspace JSON export & import in Profile (Quick Notes, Finance entries, Watchlist symbols, Quick links, Dashboard layout).
   - JSON validation and preview before applying.
4. **Mini Calendar & Planner Widget (Dashboard)**
   - Interactive monthly grid view combining Thai official holidays with personal errands and reminders.
5. **Command Palette Quick Actions (`Ctrl+K` / `⌘K`)**
   - Quick jump to Quick Links, page navigation, and quick entry actions directly from keyboard search.

### Phase 2: Security & Platform Hardening (Planned)

1. **Two-Factor Authentication (2FA / TOTP)**
   - Authenticator app support (QR code setup + TOTP code validation) for admin and high-security accounts.
2. **Redis for Rate Limiting & Multi-Instance Scaling**
   - Integrate `SLOWAPI_STORAGE_URI` with Redis to mirror `WS_BROADCAST_REDIS_URL`.
3. **Signed / Opaque User Cookie**
   - Cryptographically sign the client-side user cookie to enforce defense-in-depth before server re-verification.
4. **Offline-first PWA Enhancements**
   - Background sync for notes and finance transactions when network drops.
