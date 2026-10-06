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
| สภาพอากาศ & PM 2.5 (weather) | S/M/L | Open-Meteo + BigDataCloud, via the backend proxy |
| ราคาน้ำมัน (oil price) | S/M/L | Bangchak Open Web API, via the backend proxy |
| QR Code | S/M/L | Client-side |

### Platform

- **Auth:** JWT access/refresh in HTTP-only cookies, CSRF double-submit token, account lockout
  (5 attempts -> 30 min), session tracking (IP / user agent / device), Google OAuth.
- **Authorisation:** `role` plus per-user `accessible_pages`; the sidebar and profile page hide
  what a user cannot reach.
- **Admin:** user management, page-permission editing, password reset/lockout reset, audit log.
- **Notifications:** notification bell with derived alerts (holidays, weather, oil prices) plus
  a live WebSocket feed. The socket authenticates during the handshake and the connection
  registry is capped per user; broadcasts are admin-only.
- **Resilience:** the weather/geocode proxies retry throttled upstreams, fall back to stale data
  and persist the last known good payload in `weather_cache`. Oil prices fall back to a
  process cache and then to maintained constants.
- **Security:** CSP with a production/development split, HSTS, `nosniff`/`DENY` headers,
  rate limiting, API docs off unless opted in, startup refusal on a weak `SECRET_KEY`.
- **Operations:** Sentry (opt-in via `SENTRY_DSN`), health endpoints plus an admin-only system
  health report, Alembic migrations as the only schema authority, GitHub Actions CI.

---

## Constraints (accepted, documented)

| Constraint | Detail |
|---|---|
| Single instance | Rate limiting and the WebSocket registry are process-local; startup logs a `[SCALING]` notice. See README -> *Horizontal scaling*. |
| One weather provider | No secondary source; degradation comes from cache + retry, not failover. |
| Thai-only UI | All copy is hardcoded Thai; there is no i18n layer. |
| Process cache for oil prices | Unlike weather, oil prices have no database-backed L2. |

---

## Next (candidates, not committed)

Ordered by evidence, not by preference:

1. **A second weather provider or a longer retention window** — Open-Meteo throttles the shared
   deployment egress, and no cache can serve data that was never fetched.
2. **CI checks the migration chain** — the test suite creates tables from the models, so a
   broken Alembic revision currently passes CI and fails in production.
3. **Shared state before scaling out** — Redis for the rate limiter and a pub/sub fan-out for
   WebSocket broadcasts.
4. **Frontend coverage and one live-backend E2E** — the unit suites cover pure logic; nothing
   currently catches a broken login against the real API.
5. **Oil prices: persistent cache + delete the dead `EPPO_OIL_URL`** — brings it in line with
   the weather path.
