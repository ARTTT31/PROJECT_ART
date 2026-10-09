# Roadmap & Feature Inventory

**Last updated:** October 6, 2026

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
| `/login`, `/login-success` | Email/password and Google sign-in (authorization-code flow) |
| `/dashboard` | Widget grid — rearrange, resize (S/M/L), show/hide |
| `/profile` | Name/email/password, Quick Links, main-menu config, camera config, admin panel |
| `/camera` | CCTV monitor — permission-gated per user |

### Dashboard widgets

| Widget | Sizes | Data source |
|---|---|---|
| วันหยุดนักขัตฤกษ์ (holidays) | S/M/L | Confirmed Thai calendars bundled in the repo (2026, 2027) |
| สภาพอากาศ & PM 2.5 (weather) | S/M/L | Open-Meteo + MET Norway (weather), Open-Meteo (AQI), BigDataCloud + OSM Nominatim (geocode), via backend proxy |
| ราคาน้ำมัน (oil price) | S/M/L | Bangchak Open Web API, via the backend proxy |
| QR Code | S/M/L | Client-side |

### Platform

- **Auth:** PyJWT access/refresh in HTTP-only cookies, CSRF double-submit token, account lockout
  (5 attempts -> 30 min), session tracking (IP / user agent / device), Google OAuth.
- **Authorisation:** `role` plus per-user `accessible_pages`; the sidebar and profile page hide
  what a user cannot reach.
- **Admin:** user management, page-permission editing, password reset/lockout reset, audit log.
- **Notifications:** notification bell with derived alerts (holidays, weather, oil prices) plus
  a live WebSocket feed. The socket authenticates during the handshake and the connection
  registry is capped per user; broadcasts are admin-only and fan out through Redis pub/sub
  when `WS_BROADCAST_REDIS_URL` is set.
- **Resilience:** the weather/geocode proxies retry throttled upstreams and automatically fail over
  to secondary providers (MET Norway for weather forecast, OpenStreetMap Nominatim for GPS address lookup);
  fall back to stale data and persist the last known good payload in `weather_cache`; oil prices use the
  same table before dropping to maintained constants. Each namespace keeps its newest row past the
  30-day retention window, so the fallback survives a cold start.
- **Security:** CSP with a production/development split, HSTS, `nosniff`/`DENY` headers,
  rate limiting keyed on a client address that only a trusted proxy may assert, API docs off
  unless opted in, startup refusal on a weak `SECRET_KEY`.
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
| One weather provider | No secondary source; degradation comes from cache + retry, not failover. A location that was never fetched successfully still ends in `502`. |
| Thai-only UI | All copy is hardcoded Thai; there is no i18n layer. |
| Advisory dependency audit | `pip-audit` reports `starlette` (via fastapi 0.111) and `python-jose` advisories; the CI job reports them without blocking until the pins move. |

---

## Next (candidates, not committed)

Ordered by evidence, not by preference:

1. **Redis for the rate limiter before scaling out** — the WebSocket fan-out already has a
   supported path (`WS_BROADCAST_REDIS_URL`); the limiter still needs
   `SLOWAPI_STORAGE_URI=redis://…` for a second instance to be safe.
2. **Frontend coverage and one live-backend E2E** — 86 unit tests cover pure logic and the
   notification bell; most components are still untested, and nothing currently catches a
   broken login against the real API.
4. **Move the dependency pins** — `starlette` (via fastapi 0.111) and `python-jose` carry open
   advisories; turning the advisory `pip-audit` job into a required check needs the upgrades
   first.
5. **i18n** — the UI is Thai-only by design today; a second language needs a real message
   layer, not string replacement.
