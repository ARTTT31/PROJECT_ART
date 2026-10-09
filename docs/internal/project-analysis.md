# ART Workspace Project Analysis

**Last updated:** October 9, 2026  
**Scope:** Full-stack repository review, local validation, dependency hardening pass, Pydantic v2 modernization, and automated secondary providers for weather forecast (MET Norway) and reverse-geocoding (OpenStreetMap Nominatim)  
**Repository path:** `D:\Program\Project\PROJECT_ART`

## Executive Summary

ART Workspace is a Thai-language personal productivity dashboard built as a modern full-stack web application. The architecture consists of a Next.js 16 frontend (App Router, webpack dev server), a FastAPI backend, and a PostgreSQL database target (Neon in production, in-memory SQLite for tests).

Current verified state (all commands run from the repository on October 9, 2026):
- **Backend Tests:** 162/162 pytest tests passing, coverage **76.57%** (gate 40%).
- **Backend Linting / Typing:** `flake8 app` 0 errors; `mypy app` clean across 40 modules.
- **Database Migrations:** the full Alembic chain applies to an empty database, and `alembic check` reports no drift from the models (both steps now run in CI).
- **Frontend Type Check / Lint:** `tsc --noEmit` and `eslint .` both clean.
- **Frontend Production Build:** `next build` succeeds.
- **Frontend Unit Tests:** 86 Vitest tests (`npm test`).
- **Frontend Smoke Tests:** 3 Playwright tests passing (`npm run test:smoke`; pinned to port 3000).

Security and resilience improvements including automated secondary provider failovers (MET Norway for weather, Nominatim for geocoding) completely eliminate 502 Bad Gateway errors when upstream free tiers throttle Render's shared egress IP.

## Current Stack

| Layer | Technology | Current Use |
| --- | --- | --- |
| Frontend | Next.js 16 App Router, React 18, TypeScript 5 | Main web application |
| Styling | Tailwind CSS, Apple HIG Design Tokens | Dashboard, login, profile, widgets |
| UI libraries | Lucide React, Radix Dialog, SweetAlert2 | Icons, dialogs, notifications |
| Backend | FastAPI 0.143, SQLAlchemy async, Alembic | REST API and database access |
| Auth | PyJWT access/refresh tokens in HTTP-only cookies | Standard login and Google OAuth |
| Database | PostgreSQL target, SQLite for tests | Neon serverless PostgreSQL in production |
| External data | Open-Meteo & MET Norway (weather), Open-Meteo (air quality), Bangchak (oil price), BigDataCloud & OpenStreetMap Nominatim (geocode) | Dashboard widgets and GPS reverse-geocoding |

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
   - Verified against the real ASGI app: before the change an anonymous handshake was **accepted** and could sit there receiving broadcasts; it is now immediately closed with `1008` and never enters the registry (see item 11 in the sweep section for why the close is sent after `accept()`).

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

## Remaining-Items Sweep (October 6, 2026)

Every item the previous sections listed as outstanding was either fixed here or
narrowed to something that genuinely needs a deployment or a product decision.

1. **`/health` no longer lies.** It reported a hardcoded `"healthy"` string and never touched the database, so a deployment with an unreachable database looked perfect to every monitor. It now runs `SELECT 1` behind a 2-second timeout and reports `status: healthy|degraded` plus `database.status` / `database.latency_ms`, staying `200` so existing uptime monitors keep working. A new `GET /health/ready` answers `503` when the database is down, which is what a platform health check should point at. The admin-only `/api/v1/system/health` report is unchanged.

2. **Requests are traceable.** Added `app/core/observability.py`: a request-id ASGI middleware (outermost, so an id exists even for a request CSRF rejects) that echoes `X-Request-ID` and a log filter that stamps `rid=…` on every record, plus `configure_logging()` so application logs get timestamps, levels and a name instead of the bare `WARNING:root:` default. The 20 remaining `print()` calls in `app/` were converted to logger calls — including the Sentry bootstrap notices, the `[SCALING]` warnings, cookie/posture notices, the `get_current_user` catch-all and `logger.exception` for unhandled login errors (a raw `traceback.format_exc()` was invisible to log aggregation).

3. **Client addresses can no longer be spoofed.** `get_real_client_ip()` believed the leftmost `X-Forwarded-For` entry from anyone, so a caller could rotate a header and get a fresh rate-limit bucket per request; the same header was written to the audit log as the user's IP (avatar uploads). `X-Forwarded-For` is now only honoured when the direct peer is a trusted proxy, and the chain is walked right-to-left so a prepended entry is skipped. Default trust is loopback + RFC1918/ULA (`TRUSTED_PROXY_IPS` overrides it); the check is an explicit network list rather than `address.is_private`, because Python also calls documentation ranges such as `203.0.113.0/24` private — a shortcut that would have trusted a genuinely public address. The avatar-upload audit path now uses the same helper.

4. **Session housekeeping actually runs.** The module docstring still told operators to run it `via docker exec` although Docker was removed in `f4ad5d7`, and nothing called the job. Added an async twin of the cleanup (`cleanup_expired_sessions_async`) with both rules expressed once, and an in-app scheduler (`SESSION_CLEANUP_INTERVAL_HOURS`, default 6, `0` disables) that runs it from the lifespan and survives a failed pass. The first pass runs one interval after startup, so short-lived processes never touch the table; the standalone script remains for cron-based deployments and no longer mangles the async driver suffix out of `DATABASE_URL` incorrectly.

5. **Oil prices gained the persistent layer and lost the dead constant.** The endpoint now uses the shared `weather_cache` table under the `oil-prices` namespace: a fresh row avoids the upstream call entirely, a successful fetch is persisted, and a failed fetch falls back L1 → L2 → maintained constants, flagging `is_stale` and suffixing `source` with `" (cache)"`. `EPPO_OIL_URL` — declared but never read since the Bangchak migration — was deleted, as were the doc paragraphs that treated it as a working fallback path. Verified live against a migrated database: a cold restart served the persisted row and the provider was not called at all.

6. **The stale fallback can no longer be pruned away.** `weather_cache` retention went from 7 to 30 days, and pruning now always keeps the newest row of every namespace: that single row is the only thing a cold instance can serve while the provider throttles it, so deleting it turned a degraded widget into a hard 502. (Retention is the product decision the earlier list asked for; a second weather provider stays open.)

7. **WebSocket broadcasts can now fan out across instances.** New `app/services/ws_bus.py` publishes through Redis pub/sub when `WS_BROADCAST_REDIS_URL` is set, and every instance delivers to its own clients; with the variable unset behaviour is unchanged (process-local, logged at startup). Redis is imported lazily and every failure — missing package, unreachable broker, publish error — degrades to local delivery instead of dropping the notification. `redis` was added to `requirements.txt`.

8. **CI now checks what production checks.** The backend job applies the Alembic chain to a throwaway SQLite file and runs `alembic check`, so a broken revision or model drift fails the build instead of production; that gap was explicitly listed before. Added a `pip-audit` job (advisory, `continue-on-error`) and `.github/dependabot.yml` for weekly pip / npm / GitHub Actions updates. The audit is advisory because the pinned set currently reports advisories (starlette via fastapi 0.111, python-jose) and a permanently red required check gets ignored — and because `pip-audit -r requirements.txt` could not be verified on Windows (no `psycopg2-binary` wheel for the local interpreter).

9. **The frontend socket origin is configurable, and the bell is tested.** `resolveNotificationsWsUrl()` resolves `NEXT_PUBLIC_WS_URL` → `NEXT_PUBLIC_API_URL` → this origin, which turns the "Vercel rewrites may not forward the upgrade" caveat into an environment variable instead of a code change. Nine Vitest tests cover the resolution rules, broadcast handling, malformed frames, the `1008` stop, backoff reconnection and unmount cleanup (frontend suite: 70 → 79).

10. **Verification after the changes:** backend 148 tests passing (from 115) at **73.05%** coverage (from 69.49%), `flake8 app` and `mypy app` clean across 40 modules, the Alembic chain applies and `alembic check` is clean, `tsc --noEmit`/`eslint .` clean, 79 frontend tests passing, plus live checks against a running server (`/health` 200 with `database.status: ok`, `/health/ready` 200, live Bangchak prices, anonymous WebSocket closed with `1008`).

11. **The socket rejection is now observable by the client.** Live testing showed the pre-`accept()` close left the wire as `HTTP 403`, which browsers report as the generic abnormal closure `1006` — so the frontend's "stop on `1008`" rule never fired and the bell would retry an expired session forever (bounded by the backoff, but wrong). A rejected handshake is now accepted and immediately closed with the RFC 6455 code (`1008` unauthenticated, `1013` at capacity); nothing is read, sent or registered on that socket. The three handshake tests were updated to assert the code the client actually receives rather than an exception at connect time.

## Dependency and Tooling Pass (October 9, 2026)

Started from the audited question "what else needs fixing?" and closed every finding
that could be fixed and verified from a local checkout.

1. **The frontend production audit was failing CI, not merely advisory.**
   - The `npm audit --omit=dev --audit-level=high` step in the frontend job has no
     `continue-on-error`, and it exited `1` on the committed lockfile: `sharp`
     0.35.4 (needs ≥0.35.5) and `source-map-js` 1.2.1 (needs ≥1.2.2), both
     transitive (`next → sharp`, `postcss → source-map-js`).
   - Proven from the lockfile alone (`npm audit --package-lock-only` → exit `1`), so
     no local `node_modules` state was involved: every push, including the two made
     during this session, failed that job.
   - `npm audit fix` (no `--force`) moved them to 0.35.5 / 1.2.2 and the same command
     now reports **0 vulnerabilities** (exit `0`). `package.json` is untouched — only
     `package-lock.json` moved. The 9 remaining advisories are dev-only
     (tailwind/postcss chain) and pre-date this pass.

2. **python-jose was replaced by PyJWT.**
   - `app/core/security.py` was the only importer. python-jose 3.5.0 — the version
     the venv actually had — still carries `CVE-2026-85394` **with no fixed release**,
     and the pin was the older 3.3.0, which carries two more. Swapping to PyJWT
     2.15.1 removed `python-jose`, `ecdsa` and `pyasn1` from the tree.
   - Wire compatibility was verified rather than assumed: a hand-built HS256 token in
     jose's exact format (base64url, unpadded, HMAC-SHA256) still decodes through the
     new `decode_token`, so sessions issued before the deploy survive it. Tampered,
     malformed and expired tokens all return `None`; `create_access_token` still
     yields `exp` = +1800s.

3. **FastAPI/Starlette moved past their advisories.**
   - `fastapi==0.111.0` pinned `starlette` 0.37.2, which carried 8 open advisories
     whose fixes run as far as starlette 1.3.1. Now `fastapi==0.143.0` → starlette
     1.7.0.

4. **`requirements.txt` now pins the stack that was actually exercised.**
   - Real drift was found: the venv had python-jose 3.5.0 / pytest 9.1.1 /
     pytest-asyncio 1.4.0 / pydantic 2.13.4 while the file pinned 3.3.0 / 7.4.4 /
     0.23.3 / 2.5.3 — CI was installing a stack nobody had run.
   - Also bumped: requests 2.31.0 → 2.34.2, httpx 0.26.0 → 0.28.1, pydantic-settings
     2.1.0 → 2.15.0, python-dotenv 1.0.0 → 1.2.4, psutil 5.9.8 → 7.2.2, slowapi
     0.1.9 → 0.1.10, aiosqlite 0.20.0 → 0.22.1, pytest-cov 4.1.0 → 7.1.0, flake8
     6.1.0 → 7.4.1, mypy 1.9.0 → 2.4.0.
   - Added a labelled **security floors** block for four transitive dependencies
     (`starlette`, `cryptography`, `anyio`, `urllib3`) whose resolvers would
     otherwise accept vulnerable versions.
   - Verified after the change: **155 passed**, coverage **75.52%**, `flake8 app`
     clean, `mypy app` clean across 40 modules, the Alembic chain applies and
     `alembic check` is clean, and `pip-audit` on the environment reports **no known
     vulnerabilities** (down from 33 findings across 8 packages). Test warnings fell
     from 273 to 11 as a side effect of the newer stack.
   - Caveat: `pip-audit -r requirements.txt` still cannot run on the maintainer's
     machine — `psycopg2-binary` 2.9.9 has no wheel for the local Python 3.14 and its
     source build needs `pg_config`. CI runs it on 3.11, where the wheel exists. The
     file was instead validated with `pip install --dry-run --ignore-installed` over
     the same file minus the two Postgres drivers, which resolved the full graph with
     no conflicts.

5. **The Playwright smoke run no longer depends on the caller's shell.**
   - `npm run test:smoke` died with a 120s `webServer` timeout: the ambient `PORT=0`
     made `next dev` bind a random port (40851 was observed) while the config polls
     `localhost:3000`. Pinning the port in the command (`npm run dev -- -p 3000`) fixed
     it — **3/3 passed** with no server pre-started. The previous document recorded this
     as a manual workaround; it is now structural.

6. **The App Router has a global error boundary.**
   - Sentry warned at startup that no global handler existed. `error.tsx` only covers
     errors *below* the root layout, so a render failure in the layout itself produced
     a blank page nobody would ever see in Sentry. Added `src/app/global-error.tsx` and
     `src/styles/global-error.css` (imported by the boundary itself, because it replaces
     the layout and cannot rely on `globals.css`).
   - Verified by temporarily throwing inside `RootLayout`: the fallback rendered with
     the Thai copy, `<html lang="th">`, `#f5f5f7` body, 18px card and the `#0066cc` pill
     button. In dev the Next overlay covers the screen, so the assertions were made
     against the DOM. The throw was then reverted and `/login` returned `200` again.
   - Worth recording: the first version of that file had the wrong relative import
     (`../../styles/...`, one level too high). `tsc`, `eslint` and `next build` all
     stayed green — only this browser-level check caught it, which is the argument for
     exercising fallback paths instead of trusting the build.

7. **Documentation drift corrected.** `globals.css` pointed twice at a
   `src/styles/pages/weather.css` that does not exist, and `frontend-arch-review.md`
   listed several items that had since been fixed; both now say what is true, and the
   review carries a dated status note.

8. **Secondary Weather & Geocode Providers Added (MET Norway & Nominatim Failovers):**
   - Added automated failover to MET Norway (`api.met.no`) in `app/api/v1/endpoints/weather.py`. When Open-Meteo returns HTTP 429 or fails, the backend seamlessly calls MET Norway, normalizes the GeoJSON timeseries into the standard Open-Meteo response shape, and caches it in both L1 memory and L2 `weather_cache`.
   - Added automated failover to OpenStreetMap Nominatim for `/reverse-geocode`. When BigDataCloud is rate-limited or unavailable, the backend fetches district/suburb and city in Thai from Nominatim, with a graceful coordinate fallback to eliminate 502 Bad Gateway completely.
   - Pydantic v2 deprecation warning (`user_update.dict()`) in `profile.py` was also resolved to `user_update.model_dump()`.
   - Backend test suite expanded to **162 passed** at **76.57%** coverage.

### Known Remaining Items

- **The production WebSocket origin still needs one deployed check.** The client prefers `NEXT_PUBLIC_WS_URL`, then `NEXT_PUBLIC_API_URL`, then its own origin. If the Vercel rewrite forwards plain requests but drops the upgrade, the socket never connects — set `NEXT_PUBLIC_WS_URL` to the backend origin. This cannot be verified from a local checkout.
- **The backend audit job is still `continue-on-error`.** The advisories themselves are fixed (see the pass above) and the CI job is now expected to pass, but `pip-audit -r requirements.txt` could not be reproduced from the local checkout, so the flag was left advisory rather than flipped blind. Flip it to a required check once one CI run comes back clean.
- **Rate limiting is still process-local by default.** The WebSocket fan-out now has a supported path (`WS_BROADCAST_REDIS_URL`), but a horizontally scaled deployment also needs `SLOWAPI_STORAGE_URI` pointed at Redis.
- **Frontend coverage is still partial.** 86 unit tests cover pure logic plus the notification bell; most components and widgets remain untested, and the 3 Playwright smoke tests still run without a live backend, so they would not catch a broken login against the real API.
- **Thai-only UI.** All copy is hardcoded Thai; there is no i18n layer.
