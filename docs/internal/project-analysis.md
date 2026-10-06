# ART Workspace Project Analysis

**Last updated:** October 6, 2026  
**Scope:** Full-stack repository review, local validation, hardening of the WebSocket subscribe path, and the maintainability/resilience pass  
**Repository path:** `D:\Program\Project\PROJECT_ART`

## Executive Summary

ART Workspace is a Thai-language personal productivity dashboard built as a modern full-stack web application. The architecture consists of a Next.js 16 frontend (App Router, webpack dev server), a FastAPI backend, and a PostgreSQL database target (Neon in production, in-memory SQLite for tests).

Current verified state (all commands run from the repository on October 6, 2026):
- **Backend Tests:** 115/115 pytest tests passing, coverage **69.49%** (gate 40%).
- **Backend Linting / Typing:** `flake8 app` 0 errors; `mypy app` clean across 38 modules.
- **Database Migrations:** the full Alembic chain applies to an empty database (verified, including the `weather_cache` revision).
- **Frontend Type Check / Lint:** `tsc --noEmit` and `eslint .` both clean.
- **Frontend Production Build:** `next build` succeeds.
- **Frontend Unit Tests:** 70 Vitest tests (`npm test`), previously 19.
- **Frontend Smoke Tests:** 3 Playwright tests passing (`npm run test:smoke`; needs `PORT=3000` if `PORT` is set to `0` in the shell).

Two security gaps found in the previous pass were closed here; the newest section (see *WebSocket Subscriptions Are Authenticated*) documents them.

## Current Stack

| Layer | Technology | Current Use |
| --- | --- | --- |
| Frontend | Next.js 16 App Router, React 18, TypeScript 5 | Main web application |
| Styling | Tailwind CSS, Liquid Glass Design Tokens | Dashboard, login, profile, widgets |
| UI libraries | Lucide React, Radix Dialog, SweetAlert2 | Icons, dialogs, notifications |
| Backend | FastAPI, SQLAlchemy async, Alembic | REST API and database access |
| Auth | JWT access/refresh tokens in HTTP-only cookies | Standard login and Google OAuth |
| Database | PostgreSQL target, SQLite for tests | Neon serverless PostgreSQL in production |
| External data | Open-Meteo weather API, Bangchak oil price JSON API | Weather widget and oil price widget |

## System Improvements Applied (October 1, 2026)

1. **Idempotent Alembic Migrations on PostgreSQL:**
   - Updated all Alembic migrations (`004`, `ed73...`, etc.) to use `sa.inspect` to check for column/table existence before executing DDL commands. This prevents `InFailedSqlTransaction` errors on the hosted PostgreSQL environment.

2. **Async SQLAlchemy MissingGreenlet Fix:**
   - Configured `expire_on_commit=False` in `async_sessionmaker` to prevent 500 errors when accessing relationship attributes after transaction commits.

3. **Frontend Page Access & Defaults:**
   - Modified `Sidebar.tsx` and `profile/page.tsx` default permission logic. When a normal user has `NULL` `accessible_pages` (never edited by admin), it now correctly defaults to `['dashboard', 'profile']` instead of allowing everything, ensuring restricted pages like `camera` remain hidden.

4. **Frontend Animation & Performance Optimizations:**
   - Removed `template.tsx` to stop redundant DOM unmounting of the Sidebar layout on every route change.
   - Refactored `DashboardLayout` `framer-motion` to use simple `opacity` fades with `mode="wait"`. This prevents Next.js from rendering two concurrent pages which caused heavy CPU spikes and UI lag on low-end devices.

5. **Toast Notification Styling:**
   - Removed aggressive `[role="alert"]` selectors from global CSS that were overriding Tailwind glassmorphism styles with an ugly red background.

6. **Admin Panel UI Overhaul:**
   - Replaced native select dropdowns and checkboxes with Liquid Glass style selectable cards and Lucide icons in `UserManagement.tsx`.

7. **Repository Cleanup & Documentation Alignment:**
   - Removed one-off patch helper scripts from the repository root, deleted the unused login CSS module, and refreshed setup docs to match the current local workflow and active feature set.

## Security and Test Improvements (October 5, 2026)

1. **CRITICAL — Unauthenticated Notification Broadcast:**
   - `POST /api/v1/ws/broadcast` declared no auth dependency despite its "Admin endpoint" docstring. Verified against the running ASGI app: an anonymous POST returned `200` while the sibling `/api/v1/users/` route correctly returned `401`. Any caller could push arbitrary notifications to every connected WebSocket client (phishing / announcement injection).
   - Fixed by adding `Depends(get_current_admin_user)` in `app/api/v1/endpoints/websockets.py`. The cookie-based CSRF middleware could not cover this: a request with no cookies bypasses the check entirely.
   - Added four regression tests (`TestWebsocketBroadcast`) covering anonymous → rejected, authenticated non-admin → `403`, admin → `200`, and admin malformed payload → `422`. Both auth tests were confirmed to fail against the pre-fix code (`assert 200 == 403`) before being accepted as passing.

2. **Session Cleanup Test Coverage (0% → 97%):**
   - `app/services/session_cleanup.py` had no tests despite being security-relevant — it is what revokes stale sessions. Added `TestSessionCleanup` using a sync SQLite session (that module is intentionally sync so it can run standalone via `python -m app.services.session_cleanup`). The one remaining uncovered line is `engine.dispose()` in the success path's `finally`.

3. **UserService Branch Coverage (58% → 88%):**
   - Added `TestUserServiceAdminPaths` (15 tests) for previously untested paths: duplicate-email guards on both `update_user` and `admin_update_user` (including an assertion that a rejected change is not persisted), duplicate username/email on `admin_create_user`, admin role/page assignment, lockout reset (`locked_until` cleared, `failed_login_attempts` back to 0), admin password reset, `change_password` success/failure, `delete_user`, and `update_last_login`.


4. **Legacy Schema Repair Disabled in Production:**
   - `sync_db_columns()` issues raw `ALTER TABLE` at startup, duplicating Alembic's authority and able to mask a genuinely missing migration. Added `Settings.AUTO_MIGRATE_COLUMNS_EFFECTIVE`, which forces the repair off whenever `DEBUG=False` even if the raw flag was explicitly set in the environment, and logged a notice when it overrides someone. `main.py` now reads the effective value. Development keeps the convenience. Covered by `TestAutoMigrateColumnsGuard` (4 tests, all four DEBUG/flag combinations).
   - Note: the pre-existing `default_migrate_from_debug` field validator never fires in practice, because Pydantic does not run `mode="before"` validators on field defaults. `AUTO_MIGRATE_COLUMNS` was therefore always `False` in practice; the new property is what actually enforces the intent.

5. **Frontend Unit Test Harness Added:**
   - The project had no unit test runner — only 3 Playwright smoke tests with no live backend. Added Vitest 4 + jsdom + Testing Library (`vitest.config.mts`, `vitest.setup.ts`, `npm test` / `npm test:watch`). Vitest 2.x was deliberately not used: it carries two active advisories (arbitrary file read via the UI server, and path traversal via mocker).
   - `@vitejs/plugin-react` was removed again after being added: Vitest transforms TSX natively, so the plugin was redundant and pulled in a second, older `vite@5.4.21` alongside Vitest's `vite@8.3.2`, which npm flagged as an invalid `esbuild` resolution. The config now uses `esbuild: { jsx: 'automatic' }` instead, leaving a single deduped `vite@8.3.2`.
   - `@testing-library/user-event` and `@testing-library/dom` were also removed: the hook tests use `renderHook`/`act` only and never imported either.
   - Net effect: `npm audit` reports exactly the same 7 pre-existing high-severity advisories as the baseline tree (`@next/eslint-plugin-next`, `braces`, `chokidar`, `eslint-config-next`, `fast-glob`, `micromatch`, `tailwindcss`) — zero introduced.
   - Added 15 tests for `useDashboardLayout`, the most logic-dense untested frontend module: init precedence (cloud profile over localStorage, both payload shapes), malformed-JSON tolerance, filtering of retired widget ids, re-adding missing defaults, resize, visibility toggling including the "never hide the last widget" guard, and debounced persistence. All three key behaviours were mutation-checked — breaking the last-widget guard, the unsupported-widget filter, or the 400 ms debounce each makes the suite fail.

6. **`quick-reference.md` Trim Verified Safe:**
   - The ~1000 deleted lines were entirely Docker Compose commands. Docker was removed from this project in commit `f4ad5d7` ("remove docker & fully migrate to serverless stack"), and no Dockerfile or compose file exists in the tree. No document links to a heading inside the trimmed file, so nothing is broken. The remaining "Docker" mentions in `migration-deployment.md` are deliberate roadmap prose about completing the Docker-less migration.

Backend test count grew from 50 to 90 and total coverage from 54.98% to 65.12%. Frontend gains a working unit-test harness with 19 passing tests (15 `useDashboardLayout` + 4 `WeatherWidget`). `flake8 app`, `mypy app`, `tsc --noEmit`, `eslint .`, and `next build` all still pass.

7. **Public Proxy Abuse Bounded, Cache Capped, Deprecated Time API Removed:**
   - `weather/forecast`, `weather/air-quality`, `weather/reverse-geocode`, `oil-prices/oil-prices`, and `oil-prices/health` are unauthenticated by design (the login screen renders these widgets), but none of them carried a rate limit — verified anonymously returning `200`, which made the deployment a free relay to Open-Meteo / BigDataCloud / Bangchak. Added `@limiter.limit(_GENERAL_LIMIT)` to all five, reusing the existing `RATE_LIMIT_GENERAL_PER_MINUTE` setting. Confirmed end-to-end that the limiter engages (`[200, 200, 200, 200, 200, 429, 429, ...]`) and that all five still return `200` for normal anonymous use.
   - The three weather caches are keyed by user-supplied coordinates and had no eviction, so a long-lived Render instance could grow them without bound. Added `MAX_CACHE_ENTRIES = 200`; `_cache_set` now purges already-expired entries first and only then evicts oldest-first.
   - Replaced the two remaining deprecated `datetime.datetime.utcnow()` calls in `weather.py` with the project's `utcnow()` helper (which exists precisely for this), and dropped the now-unused `datetime` import.
   - Note: annotating the endpoints with `request: Request` (required by SlowAPI) made mypy start checking those function bodies, which surfaced a **pre-existing** latent error — `_cache = {"timestamp": None, "data": None}` inferred as `dict[str, None]`, so every later assignment into it was ill-typed. Fixed at the root by annotating `_cache: dict[str, Any]` and the health-check `status` dict, rather than suppressing the check.

8. **Weather Proxy Degrades Gracefully Under Upstream Throttling:**
   - Open-Meteo rate-limits by IP and Render egress is shared, so `weather/forecast` began returning `502 {"detail":"Upstream provider returned HTTP 429"}` in production. The proxy surfaced the upstream failure verbatim with no recovery path.
   - Added a bounded retry with exponential backoff (0.6s, then 1.8s) that retries **only** 429 and 5xx and re-raises 4xx immediately, plus a last-known-good fallback: `_cache_get_stale` serves the most recent expired entry and flags the payload `_stale: true` instead of failing. All three weather endpoints use it.
   - Verified on the live deployment that the retry path actually executes: `forecast` takes ~5.1s before returning 502, versus `air-quality` answering in 0.18s from a warm cache — the 2.4s of backoff accounts for the difference.
   - `WeatherWidget` rendered a tall empty card whenever the request failed. It now has a compact error state with a retry button.

## Maintainability and Resilience Pass (October 6, 2026)

1. **Alembic Is Now the Only Schema Authority.**
   - Deleted `sync_db_columns()` (raw `ALTER TABLE` at startup) along with the `AUTO_MIGRATE_COLUMNS` setting, its never-firing `default_migrate_from_debug` validator, and the `AUTO_MIGRATE_COLUMNS_EFFECTIVE` property that existed only to disable it. Two owners of the schema is one too many: a startup repair could mask a genuinely missing migration. `AUTO_CREATE_TABLES` stays as the explicit local-development convenience. The four `TestAutoMigrateColumnsGuard` tests were removed with the code they covered.

2. **Weather Fallback Now Survives Restarts.**
   - The in-process cache dies with the process, which is precisely when a throttled provider hurts most — a cold instance returned a hard 502. Added `weather_cache` (model + Alembic revision `c4e8a91b7d20`) as an L2 behind the existing L1 dict, wired into `forecast`, `air-quality` and `reverse-geocode`.
   - Reads prefer L1, then a still-fresh L2 row (which also warms L1); an upstream failure falls back to L1-stale, then L2-stale, and flags `_stale: true`. Successful fetches are persisted. Rows older than 7 days are pruned opportunistically on write, which bounds the table without a scheduled job.
   - The layer is deliberately best-effort: every helper swallows and logs database errors, because these proxies are unauthenticated so the login page can render them — a database outage must not take the widget down too.
   - Verified by migrating a fresh SQLite database through the full chain (table + index created) and by six new tests, including a simulated restart (empty L1 + `429` upstream) that still answers `200` from the database, and an expired-row case that must re-fetch rather than serve.

3. **Single-Instance Assumptions Are Now Explicit, Not Silent.**
   - Rate limiting (`SLOWAPI_STORAGE_URI=memory://`) and the WebSocket connection registry are both process-local. On one instance that is correct; on two it silently multiplies the effective rate limit and halves broadcast reach. `app.main.log_shared_state_limitations()` now prints a `[SCALING]` notice at startup for each, and README documents the shared-Redis upgrade path. No new service was introduced.

4. **Cookie Configuration Can No Longer Lock Out Local Dev.**
   - `SameSite=None` is only honoured together with `Secure`; over plain HTTP the browser drops the cookie, which presents as "login succeeded but the session never persists". Added `Settings.COOKIE_SAMESITE_EFFECTIVE`, which downgrades `none` to `lax` when the cookie is not secure and logs a `[CONFIG]` notice. `auth.py` and the CSRF middleware now both use it, so copying production values into a local environment cannot break login silently. Covered by `TestCookieSameSiteGuard` (3 tests).

5. **Manual Scripts No Longer Run as Tests.**
   - `backend/scripts/tests/` → `backend/scripts/checks/`, and the files renamed to `check_*.py` / `check_*.ps1` / `check_db.js`. These five scripts *were* being collected by a bare `pytest` run (95 collected = 90 real + 5 scripts), and `check_login.py` attempted a real HTTP request to `localhost:8888` during the suite while quietly passing whether or not the server existed. `pytest.ini` now pins `testpaths = tests` with `norecursedirs = scripts venv .git __pycache__ htmlcov`, so collection is 96 real tests.

6. **Frontend Test Harness Grew From 19 to 70 Tests.**
   - New suites for `quickLinks` (15), `userAgent` (11), `mainMenu` (12), `holidays` (8) and `cn` (5) — all pure logic that user-editable JSON and the session list depend on, previously unverified.

7. **Two Real Bugs Found and Fixed by Those Tests.**
   - `parseUserAgent` matched its (lowercase) version regexes against the original, mixed-case agent string, so every version lookup silently failed: the profile session list showed "Chrome" instead of "Chrome 120", "macOS" instead of "macOS 10.15", and so on. All lookups now run against the lowercased string.
   - The OS branch tested `mac os x` before `iphone`/`ipad`, and iOS agents contain "like Mac OS X" — so every iPhone and iPad was reported as a Mac. The mobile branch is now checked first.

8. **`WeatherWidget` Tests Are Warning-Free.**
   - The suite emitted `An update to WeatherWidget inside a test was not wrapped in act(...)`. The mount effect resolves a rejected request after the last assertion, so its state updates landed outside `act`; the retry test also used a bare `.click()`. Tests now flush inside `act()`, use `fireEvent.click`, and the "still loading" case asserts both halves (no affordance before the request settles, affordance after). A React warning stream is not a passing signal — it hides real failures.

## WebSocket Subscriptions Are Authenticated (October 6, 2026)

1. **The subscribe path was open to anyone.**
   - `GET /api/v1/ws/notifications` declared no auth dependency, so any client that knew the URL could complete a handshake, hold a socket open, and receive every admin broadcast. The frontend connects from the notification bell without attaching any credential, so a visitor who never signed in still got a live feed of system announcements. The earlier pass locked down `POST /api/v1/ws/broadcast` but left the receiving end open — the same feature, one direction later.
   - Verified against the real ASGI app: before the change an anonymous handshake was **accepted**; it is now closed with `1008` *before* `accept()`, so a rejected client sees a failed connection rather than an open socket.

2. **Handshake authentication reuses the HTTP account rules.**
   - Browsers cannot attach headers to a WebSocket handshake, so the HTTP-only `access_token` cookie is the primary source (it rides along with the upgrade request); an `Authorization: Bearer` header is accepted for non-browser clients.
   - The token is deliberately **not** read from the query string: query strings land in proxy and access logs, which would turn a 30-minute credential into a long-lived one sitting in plaintext. A test asserts the query-string path stays rejected.
   - The decode-and-validate core was extracted into `resolve_user_from_token()`, now shared by `get_current_user` and the socket handshake, so expired tokens, deleted users, inactive accounts and lockouts are enforced identically on both transports instead of being re-implemented.

3. **The connection registry is capped.**
   - `WS_MAX_CONNECTIONS` (200) and `WS_MAX_CONNECTIONS_PER_USER` (3) bound the process-local list. Over-capacity handshakes close with `1013`. Authentication alone was not enough: every signed-in account can open sockets and the frontend reconnects automatically, so one account or a reconnect loop could still grow the registry without bound.
   - `disconnect()` is idempotent (a double call used to be able to push the per-user counter negative, which would have permanently denied that user a connection) and a failed broadcast send now releases that socket's slot.

4. **The pooled database connection is released before the long-lived loop.**
   - A WebSocket handler stays alive for minutes or hours. Keeping the `get_db` session for its whole lifetime would have held one pooled connection per open dashboard tab, and the pool is only five connections wide — a handful of open tabs would have starved the REST API. The session is closed right after the handshake, before the receive loop.

5. **The client no longer fights the server.**
   - `NotificationBell` treated every close as "retry in 5 seconds", so a rejected handshake would have produced an infinite 5-second reconnect loop. It now treats `1008` as terminal (signing in again remounts the component and opens a fresh socket) and backs off progressively for every other close.
   - The fallback URL was `${window.location.hostname}:8080`, which cannot work in the `/api`-rewrite deployment (that host serves the frontend, not the API). It now stays on the current origin so the rewrite and the session cookie both apply.
   - The unmount path detaches `onclose` before closing, so tearing the component down cannot schedule a reconnect after it is gone.

6. **Coverage.**
   - 19 new backend tests: handshake authentication (anonymous, valid cookie, `Bearer`-prefixed cookie, header auth, invalid token, deleted/inactive/locked account, query-string rejection), registry caps and idempotent disconnect, and four end-to-end handshakes driven through Starlette's `TestClient` against a real SQLite file database.
   - The redundant module-level `pytestmark = pytest.mark.asyncio` was dropped: `pytest.ini` already runs `asyncio_mode = auto`, and the blanket mark stamped the synchronous `TestClient` tests with an asyncio mark they cannot use.
   - Suite grew from 96 to 115 tests and coverage from 67.34% to 69.49%.

7. **Caveat that still needs a deployed check.**
   - The same-origin WebSocket URL relies on the Next.js `/api` rewrite forwarding the upgrade. Vercel rewrites are HTTP-oriented, so if the production socket never connects, set `NEXT_PUBLIC_API_URL` so the browser opens the socket against the backend origin directly (cookies are already `SameSite=None; Secure` for that cross-site case). This could not be verified from a local checkout.

### Known Remaining Items

- `weather/forecast` can still 502 when Open-Meteo throttles Render's shared egress IP **and** the persisted entry has been pruned or never existed. The retry, the L1 cache and the L2 `weather_cache` table now cover restarts and cold starts, but no cache can manufacture data the upstream refuses to serve — the remaining fixes are a second weather provider or a longer retention window, both needing a product decision.

- Frontend coverage improved but is still partial: the ~10k lines of components and widgets remain mostly untested, and the 3 Playwright smoke tests still run without a live backend, so they would not catch a broken login against the real API.
- **Scaling remains unimplemented by design.** The `[SCALING]` notices and README describe the limitation; actually supporting more than one instance requires a shared Redis for rate limiting and a pub/sub fan-out for WebSocket broadcasts.
