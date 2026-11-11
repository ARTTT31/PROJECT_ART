# ART Workspace — Architecture

**Last updated:** November 11, 2026 · describes `main` at `623fd3a`

> **What this file is.** How the system is built and wired *today*. It contains no history and no
> test counts: the verified state and open findings live in [`status.md`](status.md), the dated
> record of changes lives in [`changelog.md`](changelog.md). If a claim here goes stale, fix it
> here rather than adding another dated section.

---

## 1. Shape of the system

| Layer | Runs on | Technology |
|---|---|---|
| Web app | Vercel | Next.js 16 App Router (webpack), React 19, TypeScript 6, Tailwind CSS 4 |
| API | Render (single uvicorn process) | FastAPI 0.162, Starlette 1.10, SQLAlchemy 2.1 async, Alembic |
| Database | Aiven for PostgreSQL | PostgreSQL in production, SQLite in tests and CI |
| Object storage | — | none: avatars are re-encoded to WebP and stored as base64 text on the user row |

There is no Docker, no worker queue, no cache server and no cron. Background work is an in-process
loop plus opportunistic cleanups (§9). Rate limiting and the WebSocket registry default to process
memory; Redis is the supported upgrade path for both.

### Request path

```
browser ──▶ Next.js (Vercel) ──▶ FastAPI /api/v1/* (Render) ──▶ PostgreSQL (Aiven)
                 │                        │
                 └── /api rewrite ─────────┘  (server-side API_INTERNAL_URL)
```

- The browser either calls the API origin directly (`NEXT_PUBLIC_API_URL`) or goes through the
  Next.js `/api` rewrite, which keeps the backend address server-only (`API_INTERNAL_URL`).
- Auth cookies (`access_token`, `refresh_token`) are `HttpOnly`, and `SameSite=None; Secure` in
  production — so every browser call is cross-origin with credentials.
- `NEXT_PUBLIC_WS_URL` overrides the notification socket origin when the rewrite drops WebSocket
  upgrades; otherwise it falls back to `NEXT_PUBLIC_API_URL`, then the page origin.

---

## 2. Frontend

```
frontend/src/
├── app/
│   ├── (main)/            dashboard · profile · admin · audit · camera · notifications · share-target
│   ├── login · register · verify-email · forgot-password · reset-password · login-success
│   └── branding-icon/     generated PWA icon route
├── components/            AICopilot · Admin · Auth · Branding · Dashboard · Layout · Onboarding
│                          PWA · Profile · Toast · Widgets · ui
├── hooks/                 useAuth · useDashboardLayout · useEnabledPages · usePreferences
│                          usePwaInstall · useWebPush · useQuickLinkEnvironment
├── lib/                   api/ · finance/ · i18n/ · notifications/ · offline/ + CSV, quickNotes
└── utils/                 pure helpers (dates, holidays, quick links, user agent, camera URL, …)
```

**Data fetching.** `lib/api/fetchWithAuth.ts` is the single HTTP wrapper: credentials, `X-CSRF-TOKEN`
from the readable `csrf_token` cookie, and a single-flight refresh that renews the access token on
`401` and before it expires. There is deliberately no query-cache layer — each widget owns its own
request, cache and error state.

**Session context.** `components/Auth/AuthProvider.tsx` owns the session (`/auth/session` +
`/profile/me`), the signed `user` cookie used for fast hydration, and the 15-minute keep-alive
refresh. `hooks/useAuth.ts` is the only way components read it.

**Dashboard.** `app/(main)/dashboard/page.tsx` renders a dnd-kit sortable grid of widgets sized S/M/L.
The widget list, sizes and order are a per-account `dashboard_layout` blob persisted through
`useDashboardLayout` (debounced, cloud value wins over localStorage). `WidgetManagerDialog` is the
dialog for showing/hiding and grouping widgets.

**Widgets** (`components/Widgets/`) each resolve their own data through the backend proxy and degrade
independently: notes, price calc, market (FX/gold/SET), finance, watchlist, currency converter,
holidays, weather + PM 2.5, oil price, QR code, Pomodoro, calendar/planner, daily digest.

**Offline.** `lib/offline/localStore.ts` keeps a per-account (`offlineScope()`) copy of the blob-shaped
resources plus a pending-snapshot outbox; widgets write locally first and replay on `online`/mount.
Service-worker `BackgroundSync` is intentionally unused: the CSRF double-submit token and the rotating
auth cookie cannot be replayed from a worker.

**PWA.** `@serwist/next` with explicit runtime caching rules in `utils/swCacheRules.ts`; install
prompt via `usePwaInstall`, badges via `utils/appBadge`, push subscription via `useWebPush`.

**Presentation.** Tailwind 4 with three-layer tokens in `app/globals.css` (`--surface`, `--ink`,
`--accent`, `--hairline`), radii 18/11/full, Apple HIG states, `lucide-react` icons only. The master
document is [`design-system/art-workspace/MASTER.md`](../../design-system/art-workspace/MASTER.md).

**i18n.** `lib/i18n/messages.ts` holds a `th`/`en` catalogue used by part of the component tree; the
rest hardcodes Thai copy. See `status.md` for the current split.

---

## 3. Backend

```
backend/app/
├── main.py                 app assembly, middleware order, startup/shutdown, scheduler bootstrap
├── api/v1/router.py        mounts every endpoint module under /api/v1
├── api/v1/endpoints/       auth · users · profile · audit · oil_prices · market · weather
│                           system · planner · notifications · websockets · ai
├── core/                   config · database · security · rate_limit · observability · totp
│                           secret_box · url_safety · turnstile · disposable_email · utils
│                           page_settings · brand_logo · company_holidays
│                           quick_links · quick_notes · personal_lists · personal_reminders
├── models/                 SQLAlchemy 2.0 declarative tables (app/models/base.py)
├── schemas/                Pydantic v2 request/response models
├── services/               auth · user · session_cleanup · scheduler_state · email
│                           notification_dispatcher · web_push · fuel_warning · weather_cache · ws_bus
│                           registration_policy
└── alembic/versions/       the only schema authority
```

There is no AI service module: provider resolution, prompt building and the model calls live in
`api/v1/endpoints/ai.py`.

| Prefix | Owns |
|---|---|
| `/auth` | login, register, verify-email, refresh, csrf, session, logout, Google OAuth, 2FA, forgot/reset password |
| `/users` | admin user CRUD, trash/restore/purge, pending approvals, live sessions, 2FA reset |
| `/profile` | `/me`, quick notes, finance, watchlist, layout, main menu, camera config, external channels, avatar, sessions |
| `/audit` | admin activity log with search/pagination |
| `/market`, `/oil-prices`, `/weather` | authenticated-or-anonymous upstream proxies (see §7) |
| `/planner` | personal reminders |
| `/notifications` | notification log / history |
| `/ws` | `/notifications` WebSocket + admin `broadcast` |
| `/ai` | `/settings` (get/put/delete), `/settings/test`, `/chat` |
| `/system` | admin-only health report |

Middleware order is reversed by Starlette — the last added is the outermost — so the effective order
is **request-id → CORS → CSP → CSRF → rate limiting → routers**: a CSRF rejection still travels back
out through CSP and CORS (a browser-readable 403) and already carries a correlation id.
`X-Request-ID` is echoed on every response and stamped `rid=…` on every log line
(`core/observability.py`).

---

## 4. Data model and persistence

Two persistence styles coexist:

1. **Relational tables** — `users`, `sessions`, `audit_logs`, `email_tokens`, `system_settings`,
   `notification_logs`, `weather_cache`, plus the AI settings columns on `users`.
2. **Whole-document JSON columns on `users`** — quick notes, finance entries (+ `finance_deleted`
   tombstones), watchlist, dashboard layout, main menu order, quick links, personal reminders,
   camera config, accessible pages, notification/channel settings, web-push subscriptions.

The JSON columns are replaced wholesale on write. Finance is the only one with tombstones; the rest
are last-write-wins, which is why stale-write detection (`profile_version` compare-and-set) is a
tracked finding, not an implemented feature — see `status.md`.

Every schema change is an Alembic revision; the suite builds its schema from the models, so CI runs
`alembic upgrade head` **and** `alembic check` to catch drift. Startup never creates columns in
production (`AUTO_CREATE_TABLES` is a local convenience only).

`secret_box.py` seals stored secrets with a Fernet key derived from `SECRET_KEY`. Currently used for
the per-account AI API key; VAPID private keys are sealed the same way.

---

## 5. Authentication and sessions

| Concern | Implementation |
|---|---|
| Tokens | PyJWT, HS256. Access 30 min, refresh 7 days, both `HttpOnly` cookies. Cookie `Max-Age` values are still hardcoded, not derived from settings (open finding P7). |
| CSRF | Double-submit: readable `csrf_token` cookie must be echoed in `X-CSRF-TOKEN` for authenticated browser writes. `/login`, `/register`, `/refresh`, `/csrf`, `/forgot-password`, `/reset-password` are exempt so a session can be established or recovered. |
| Fast hydration | `user` cookie is HMAC-signed with `SECRET_KEY`; the frontend Zod-validates its shape and re-verifies against `/auth/session`. |
| 2FA | TOTP (RFC 6238 implemented in `core/totp.py`), QR + manual secret, 10 single-use recovery codes, `totp_required` login step that mints no session before the code checks out, admin `reset-2fa` escape hatch. |
| Lockout | 5 failed attempts → 30 minutes, keyed `(email, IP)`. Keyed on `request.client.host`, which behind Render is the proxy address — the open finding P1. |
| Sessions | `sessions` rows carry IP, user agent, device label, last activity and expiry. Users manage their own devices; admins see every live session and can force one out (`ADMIN_REVOKE_SESSION`). |
| Recovery | `forgot-password` mails a single-use link (SHA-256 hash stored, 30-minute TTL, 1-minute cooldown, identical answer for unknown addresses); redeeming it clears lockout and revokes every session. |
| Client IP | `core/rate_limit.get_real_client_ip()` trusts `X-Forwarded-For` only when the direct peer is a trusted proxy; that is the correct helper, but most auth/admin call sites do not use it yet. |

**Authorization** is `role` (`admin`/`user`) plus per-user `accessible_pages`. `NULL` means the default
set (`dashboard`, `profile`), never "everything". The sidebar and profile page hide what a user cannot
reach and page-scoped APIs enforce it server-side.

---

## 6. Notifications and realtime

- **Derived alerts.** `NotificationBell` builds alerts from widgets' data (holidays, PM 2.5, oil
  prices, welcome) and keeps read/dismissed ids in localStorage — per device, not per account
  (open finding U2).
- **WebSocket.** `/api/v1/ws/notifications` authenticates during the handshake (cookie or `Bearer`),
  rejects anonymous clients with `1008`, caps the registry at 200 connections / 3 per user and closes
  over-capacity handshakes with `1013`. Broadcasts are admin-only; `WS_BROADCAST_REDIS_URL` fans out
  across instances, otherwise it is process-local.
- **Web Push.** VAPID keys resolve at startup (env → DB → generated), the private key is sealed with
  `secret_box`, and a user keeps up to five device subscriptions. Endpoints are validated before they
  are stored; a missing VAPID key no longer produces a fake subscription.
- **External channels.** Webhook/LINE targets pass `core/url_safety.ensure_public_http_url` (http(s)
  only, DNS resolution, public addresses only) and outbound clients do not follow redirects.
  Dispatching is admin-only.

---

## 7. External data and caching

| Data | Primary | Fallback |
|---|---|---|
| Weather forecast | Open-Meteo | MET Norway (`api.met.no`), normalised into the Open-Meteo shape |
| Air quality (PM 2.5) | Open-Meteo | cached value |
| Reverse geocode | BigDataCloud | OpenStreetMap Nominatim, then raw coordinates |
| Oil prices | Bangchak open API | maintained constants |
| FX / gold / SET / quotes | Frankfurter, Thai Gold API, Yahoo Finance | last known value |

Every proxy uses the same degradation ladder: **L1** in-process dict (200 entries, eviction of expired
first) → **L2** `weather_cache` table (7-day prune-on-write, newest row per namespace always kept) →
stale payload flagged `_stale: true`. Upstream `429`/5xx get a bounded retry (0.6 s, 1.8 s); 4xx is
re-raised immediately. The weather, AQI, geocode and oil endpoints are unauthenticated by design (the
login screen renders them) and therefore rate-limited per client address.

---

## 8. AI Copilot

- `GET/PUT/DELETE /api/v1/ai/settings` and `POST /api/v1/ai/settings/test` manage a **per-account**
  provider (`gemini` or any OpenAI-compatible base URL), model and API key.
- The key is stored Fernet-encrypted in `users.ai_api_key_enc` and never returned to the browser; the
  settings payload exposes only whether a key exists and its last four characters.
- Provider resolution prefers the account's own key, then the deployment key (`GEMINI_API_KEY` /
  OpenAI-compatible env). `POST /ai/chat` passes real cached widget context (oil, weather, market,
  notes) into the prompt, so replies quote live values.
- Limits today: per-IP rate limiting (30/min) and `AI_MAX_OUTPUT_TOKENS`. A per-account daily quota is
  an open finding (P3), so a deployment key has no per-user budget.

---

## 9. Background work and lifecycle

- **Scheduler.** A single in-process loop claims each time window with a conditional `UPDATE` on
  `system_settings` (`services/scheduler_state.claim_slot`), so the claim survives a restart and does
  not duplicate. Windows include daily briefing, fuel warning (17:00–17:59 Asia/Bangkok) and session
  cleanup (`SESSION_CLEANUP_INTERVAL_HOURS`, `0` disables it for an external cron).
- **Opportunistic cleanups.** Expired trash users purge when an admin loads the user list; expired
  weather rows prune on write; expired finance tombstones clear on load.
- **Startup.** Refuses to boot on a weak `SECRET_KEY` in production, masks key-like values in
  `SystemSetting.__repr__`, resolves VAPID keys, and logs a `[SCALING]` notice for every process-local
  mechanism that a multi-instance deploy would silently break.

---

## 10. Operations

| Surface | Behaviour |
|---|---|
| `GET /health` | Liveness plus a real `SELECT 1` behind a 2 s timeout; always `200`, reports `healthy`/`degraded` and DB latency |
| `GET /health/ready` | `200` only when the database answers, `503` otherwise — point the platform health check here |
| `GET /api/v1/system/health` | Admin-only CPU/memory/disk/DB report |
| Security headers | Per-path CSP (`default-src 'none'` except `/docs`, `/redoc`, `/openapi.json`), HSTS, `nosniff`, `DENY`; the frontend CSP lives in `frontend/next.config.js` |
| Errors | 5xx never echo exception text; the traceback goes to the log via `logger.exception` and the client gets a generic Thai message |
| Sentry | Opt-in via `SENTRY_DSN`; source maps upload only when `SENTRY_AUTH_TOKEN`/`ORG`/`PROJECT` are all set |
| CI (`.github/workflows/ci.yml`) | backend: flake8, mypy, `alembic upgrade head` + `check` on throwaway SQLite, pytest with a 75% coverage gate, blocking `pip-audit` (+ weekly cron). frontend: ESLint, `tsc --noEmit`, Vitest, `next build`, Playwright smoke, axe on the auth pages, live register→login E2E |

---

## 11. Where to change what

| Task | Start here |
|---|---|
| New dashboard widget | `frontend/src/components/Widgets/` + the registry in `dashboard/page.tsx`, layout ids in `useDashboardLayout` |
| New API route | `backend/app/api/v1/endpoints/` + mount in `api/v1/router.py`; schema in `schemas/`, logic in `services/` |
| Schema change | model in `models/` → `alembic revision --autogenerate` → `alembic check` |
| New stored blob | column on `users` + `UserService.update_*` writer + the widget's cache-first read |
| Design token / radius | `frontend/src/app/globals.css` + `design-system/art-workspace/MASTER.md` |
| Auth / session behaviour | `backend/app/api/v1/endpoints/auth.py` + `services/auth_service.py`, then `AuthProvider`/`fetchWithAuth` |
