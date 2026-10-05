# ART Workspace Project Analysis

**Last updated:** October 5, 2026  
**Scope:** Full-stack repository review, local validation, system-wide refresh, and the broadcast-auth security fix  
**Repository path:** `D:\Program\Project\PROJECT_ART`

## Executive Summary

ART Workspace is a Thai-language personal productivity dashboard built as a modern full-stack web application. The architecture consists of a Next.js 16 frontend (App Router + Turbopack), a FastAPI backend, and a PostgreSQL database target (Neon in production, in-memory SQLite for tests).

The full stack has been verified locally and is in a clean, passing state:
- **Backend Tests:** 85/85 pytest tests passing (coverage 54.98% → 65.22%).
- **Backend Linting:** Flake8 passes with 0 errors across all app modules.
- **Frontend Type Check:** TypeScript type check passes with 0 errors.
- **Frontend Linting:** ESLint passes with 0 errors.
- **Frontend Production Build:** Next.js production build succeeds cleanly.
- **Frontend Unit Tests:** 15 Vitest tests for `useDashboardLayout` (`npm test`).
- **Frontend Smoke Tests:** 3 Playwright tests passing (`npm run test:smoke`).

## Current Stack

| Layer | Technology | Current Use |
| --- | --- | --- |
| Frontend | Next.js 16 App Router, React 18, TypeScript 5 | Main web application |
| Styling | Tailwind CSS, Liquid Glass Design Tokens | Dashboard, login, profile, widgets |
| UI libraries | Lucide React, Radix Dialog, SweetAlert2 | Icons, dialogs, notifications |
| Backend | FastAPI, SQLAlchemy async, Alembic | REST API and database access |
| Auth | JWT access/refresh tokens in HTTP-only cookies | Standard login and Google OAuth |
| Database | PostgreSQL target, SQLite for tests | Neon serverless PostgreSQL in production |
| External data | Open-Meteo weather API, EPPO oil price page | Weather widget and oil price widget |

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
   - `weather/forecast`, `weather/air-quality`, `weather/reverse-geocode`, `oil-prices/oil-prices`, and `oil-prices/health` are unauthenticated by design (the login screen renders these widgets), but none of them carried a rate limit — verified anonymously returning `200`, which made the deployment a free relay to Open-Meteo / BigDataCloud / Bangchak / EPPO. Added `@limiter.limit(_GENERAL_LIMIT)` to all five, reusing the existing `RATE_LIMIT_GENERAL_PER_MINUTE` setting. Confirmed end-to-end that the limiter engages (`[200, 200, 200, 200, 200, 429, 429, ...]`) and that all five still return `200` for normal anonymous use.
   - The three weather caches are keyed by user-supplied coordinates and had no eviction, so a long-lived Render instance could grow them without bound. Added `MAX_CACHE_ENTRIES = 200`; `_cache_set` now purges already-expired entries first and only then evicts oldest-first.
   - Replaced the two remaining deprecated `datetime.datetime.utcnow()` calls in `weather.py` with the project's `utcnow()` helper (which exists precisely for this), and dropped the now-unused `datetime` import.
   - Note: annotating the endpoints with `request: Request` (required by SlowAPI) made mypy start checking those function bodies, which surfaced a **pre-existing** latent error — `_cache = {"timestamp": None, "data": None}` inferred as `dict[str, None]`, so every later assignment into it was ill-typed. Fixed at the root by annotating `_cache: dict[str, Any]` and the health-check `status` dict, rather than suppressing the check.

8. **Weather Proxy Degrades Gracefully Under Upstream Throttling:**
   - Open-Meteo rate-limits by IP and Render egress is shared, so `weather/forecast` began returning `502 {"detail":"Upstream provider returned HTTP 429"}` in production. The proxy surfaced the upstream failure verbatim with no recovery path.
   - Added a bounded retry with exponential backoff (0.6s, then 1.8s) that retries **only** 429 and 5xx and re-raises 4xx immediately, plus a last-known-good fallback: `_cache_get_stale` serves the most recent expired entry and flags the payload `_stale: true` instead of failing. All three weather endpoints use it.
   - Verified on the live deployment that the retry path actually executes: `forecast` takes ~5.1s before returning 502, versus `air-quality` answering in 0.18s from a warm cache — the 2.4s of backoff accounts for the difference.
   - `WeatherWidget` rendered a tall empty card whenever the request failed. It now has a compact error state with a retry button.

### Known Remaining Items

- `weather/forecast` still returns 502 on production while Open-Meteo throttles Render's shared egress IP. The retry and stale-cache fallback make the failure graceful but cannot manufacture data that the upstream refuses to serve. The real fix is a cache that survives instance restarts (Redis/Upstash or a hosted Postgres) or a second weather provider, which needs a decision from the project owner.

- Frontend coverage is still thin beyond `useDashboardLayout`: the ~10k lines of components and widgets have no unit or component tests. The 3 Playwright smoke tests now pass locally (verified against a running dev server) but they assert only on structure and redirects — they still run without a live backend, so they would not catch a broken login against the real API.
- `backend/scripts/tests/` holds three **manual** scripts, not unit tests: `test_oil_prices.py` documents itself as a pre-deploy connectivity check, and the other two drive a live server with `requests`. They are intentionally not part of the suite. Worth renaming the folder to `scripts/checks/` so nobody mistakes them for pytest tests — pytest collects `test_*.py` by name, so a bare `pytest` at the repo root would try to run them.
