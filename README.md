# ART Workspace

ART Workspace is a Thai-language personal productivity dashboard built with a serverless-friendly full-stack architecture.

Production URL: configure this in your deployment environment; do not commit a personal deployment URL.

## CI Status

The GitHub Actions pipeline (`ci.yml`) runs on every push and pull request to `main`:

- **Backend:** Python 3.11 — flake8 7.4 lint (`--max-line-length=120`) + mypy 2.4 type check + `alembic upgrade head` and `alembic check` against a throwaway SQLite database + pytest (448 tests, coverage 86.55%, gate 40%)
- **Frontend:** Node 26 — ESLint + TypeScript type-check + 181 Vitest unit tests + Next.js production build + Playwright smoke tests
- **Dependency audit (blocking):** `pip-audit` gates every push and pull request and re-runs weekly (`cron: 0 2 * * 1`, Mondays 02:00 UTC). The pinned backend set currently reports no known advisories; Dependabot opens the upgrade pull requests (see `.github/dependabot.yml`).

The migration step matters: the test suite builds its schema from the models, so a broken or forgotten Alembic revision used to pass CI and only fail against production. `alembic check` additionally fails when the models drift from the migration head.

## Documentation

### Setup

- [Quick Reference](docs/setup/quick-reference.md)
- [Login System Setup](docs/setup/login-system.md)
- [Migration and Deployment](docs/setup/migration-deployment.md)
- [Production Readiness — opening the app to many users](docs/setup/production-readiness.md)

### Architecture and Design

- [Design System Summary](DESIGN.md) — the short version
- [Design System Master](design-system/art-workspace/MASTER.md) — single source of truth (Apple HIG)
- [Frontend Architecture Review](docs/design/frontend-arch-review.md)
- [Accessibility Guide](docs/design/accessibility.md)

> `docs/design/design-principles.md` and `docs/design/enterprise-admin-ui.md` are deprecated stubs that point at the master document.

### Product

- [Roadmap and Requirements](docs/product/roadmap-features.md)
- [Widget Updates](docs/product/widget-updates.md)
- [Current Project Analysis](docs/internal/project-analysis.md)

## Tech Stack

### Frontend
- **Framework:** Next.js 16 App Router, React 19, TypeScript 6
- **Styling:** Tailwind CSS 4, custom design tokens

  > TypeScript is held at 6.x on purpose: `typescript-eslint` (via `eslint-config-next`) declares `typescript >=4.8.4 <6.1.0`, so 7.x would break `npm run lint`. Move it once that range widens.
- **UI Components:** Radix UI, Lucide React icons, Framer Motion
- **Drag and Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`
- **PWA Support:** `@serwist/next`
- **Error Tracking:** `@sentry/nextjs`
- **E2E Testing:** Playwright smoke tests run in CI
- **Data Fetching:** `fetchWithAuth` wrapper (credentials + CSRF + single-flight refresh); no query-cache layer
- **Auth Client:** `AuthProvider` (centralized context) + `useAuth` hook
- **Alerts:** SweetAlert2 + custom `useToast` hook

### Backend

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.162, Starlette 1.10, Uvicorn 0.54 |
| Real-time | WebSocket notifications (authenticated handshake, connection caps, optional Redis fan-out) |
| ORM / DB | SQLAlchemy 2 async, Alembic migrations |
| Database | PostgreSQL on Aiven (production), SQLite for CI tests |
| Auth | PyJWT access + refresh tokens in HTTP-only cookies + double-submit-cookie CSRF (`X-CSRF-Token`) |
| Rate Limiting | SlowAPI |
| Upstream data | httpx (Bangchak oil prices, Open-Meteo & MET Norway weather forecast, Open-Meteo air quality, BigDataCloud & OpenStreetMap Nominatim reverse geocode) |
| Linting | flake8 7.4, mypy 2.4 |

### Infrastructure

| Layer | Technology |
|---|---|
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Database | Aiven for PostgreSQL (managed; TLS with the project CA) |

## Local Development

### Backend

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the API:

```bash
uvicorn app.main:app --reload --port 8080
```

The API will be available at:

- API root: [http://localhost:8080](http://localhost:8080)
- Swagger docs: [http://localhost:8080/docs](http://localhost:8080/docs)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

## Environment Variables

For security and proper environment isolation, environment variables are not stored directly in this document. Use the example files:

- [`.env.example`](.env.example) — combined reference for backend + frontend variables
- [`backend/.env.example`](backend/.env.example) — backend `.env` template
- [`frontend/.env.example`](frontend/.env.example) — frontend `.env.local` template

1. Copy the relevant example file (`.env` for the backend, `.env.local` for the frontend).
2. Replace the placeholders with your actual settings (secret keys, credentials, local API ports, and database urls).
3. Do NOT commit the actual `.env` files to git repositories.

Notable variables:

| Variable | Default | Purpose |
|---|---|---|
| `DEBUG` | `False` | Opt-in to development behaviour. Required `True` for local dev tooling such as `/docs`. |
| `SECRET_KEY` | — | JWT signing key. When `DEBUG=False` it must be at least 32 characters and not a placeholder. |
| `SSL_CA_CERT_PATH` | empty | Path to the Aiven project CA file. Aiven's CA is not in certifi, so setting this lets the async engine verify TLS against it explicitly. |
| `ENABLE_API_DOCS` | `False` | Serves `/docs`, `/redoc` and `/openapi.json`. Always on when `DEBUG=True`. |
| `CSRF_PROTECTION_ENABLED` | `True` | Double-submit-cookie CSRF check for authenticated browser writes. Only disable for non-browser clients. |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | derived | `True`/`none` on Render; `False`/`lax` for plain local HTTP. |
| `TRUSTED_PROXY_IPS` | empty | Comma-separated IPs/CIDRs allowed to set `X-Forwarded-For`. Empty trusts only loopback/RFC1918 peers, so a public caller cannot choose its own rate-limit bucket. |
| `SESSION_CLEANUP_INTERVAL_HOURS` | `6` | Interval for the in-app expired-session cleanup. `0` disables it (run `python -m app.services.session_cleanup` from cron instead). |
| `WS_BROADCAST_REDIS_URL` | empty | Redis URI for the WebSocket broadcast fan-out. Empty keeps broadcasts process-local. |
| `WS_MAX_CONNECTIONS` / `WS_MAX_CONNECTIONS_PER_USER` | `200` / `3` | Per-process WebSocket caps. |
| `NEXT_PUBLIC_WS_URL` | empty | Frontend only. Overrides the notification socket origin when a hosting rewrite does not forward WebSocket upgrades. |

## Database Migrations

Run migrations from the backend directory:

```bash
cd backend
alembic upgrade head
```

Create a new migration:

```bash
alembic revision --autogenerate -m "describe change"
```

## Validation

Frontend checks:

```bash
cd frontend
npm run type-check
npm run lint
npm test
npm run build
npm run test:smoke
```

Backend checks:

```bash
cd backend
flake8 app --max-line-length=120 --exclude=__pycache__
python -m mypy app
python -m pytest -q --tb=short
alembic upgrade head && alembic check        # schema matches the migration chain
python -m pip_audit -r requirements.txt      # dependency advisories (pip install pip-audit)
```

If Windows has the Python launcher but not `python` on PATH, use:

```powershell
py -m pytest -q --tb=short
```

## Project Structure

```
PROJECT_ART/
├── frontend/                    # Next.js 16 App Router
│   └── src/
│       ├── app/                 # Pages (dashboard, admin, audit, profile, camera, auth)
│       ├── components/
│       │   ├── Auth/            # AuthProvider — centralized session context
│       │   ├── Layout/          # DashboardLayout (header + sidebar)
│       │   ├── Toast/           # useToast hook + ToastProvider
│       │   ├── ui/              # Dialog.tsx — Radix UI primitives
│       │   └── Widgets/         # Dashboard widgets (dnd-kit sortable)
│       ├── hooks/               # useAuth.ts, useDashboardLayout.ts
│       └── utils/               # quickLinks, mainMenu, sweetalert, userAgent
├── backend/                     # FastAPI
│   └── app/
│       ├── api/v1/endpoints/    # auth, profile, users, audit, system, market, weather,
│       │                        # oil_prices, websockets
│       └── core/                # config.py, database.py, security.py, personal_lists.py
├── design-system/art-workspace/ # MASTER.md + page overrides
└── .github/workflows/ci.yml     # CI: flake8 + pytest + ESLint + build
```

## Production Deployment Notes

### Render Backend

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set `DATABASE_URL` (the Aiven service URI), `SSL_CA_CERT_PATH` (the downloaded Aiven CA), a long random `SECRET_KEY`, `FRONTEND_URL`, and the exact `CORS_ORIGINS` frontend URL in Render environment variables.
- Keep `DEBUG=False` and `AUTO_CREATE_TABLES=False` in production. Alembic is the only owner of the schema: run `alembic upgrade head` for every release.

### Vercel Frontend

- Framework preset: Next.js
- Root directory: `frontend`
- Set `NEXT_PUBLIC_SITE_URL` to the canonical frontend URL.
- Set `NEXT_PUBLIC_API_URL` to the public API URL, or leave it unset to route browser requests through `/api`.
- When using the `/api` rewrite, set `API_INTERNAL_URL` to the backend URL. This server-only variable keeps the backend address out of browser bundles.
- The notification WebSocket follows `NEXT_PUBLIC_WS_URL` → `NEXT_PUBLIC_API_URL` → this origin. If the deployment's rewrite forwards plain HTTP requests but drops the WebSocket upgrade, set `NEXT_PUBLIC_WS_URL` to the backend origin (`wss://…`); the session cookie is already `SameSite=None; Secure`, so it is sent cross-site.
- Sentry source-map upload only runs when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are all set.

### Release Checklist

1. Run `alembic upgrade head` against the production database before deploying the backend.
2. Confirm `DEBUG=False`, automatic schema flags are disabled, and `CORS_ORIGINS` contains only the deployed frontend origin.
3. Set the frontend URLs above in the deployment environment; do not rely on a URL embedded in source code.
4. Run the validation commands in this document and verify login, profile editing, dashboard widgets, and the production `/api` rewrite after deployment.
5. Point the platform health check at `/health/ready` (it answers `503` when the database is unreachable) and keep an external uptime monitor on `/health`.

### Health Endpoints

| Endpoint | Meaning | Response |
|---|---|---|
| `GET /health` | Liveness + a real database ping. Always `200` so an existing uptime monitor keeps working. | `{"status": "healthy"\|"degraded", "database": {"status": "ok"\|"down", "latency_ms": …}}` |
| `GET /health/ready` | Readiness: `200` only when the database answers, `503` otherwise. | Same shape with `"ready"` / `"not_ready"` |
| `GET /api/v1/system/health` | Admin-only detailed report (CPU, memory, disk, database latency). | `SystemHealth` |

Both public probes use a 2-second timeout, so a hung database cannot make the probe itself hang. Before this, `/health` returned a hardcoded `"healthy"` string and never touched the database.

### Request Correlation

Every response carries an `X-Request-ID` header: a caller-supplied id is reused when it is short and safe, otherwise one is generated. Log lines include it as `rid=…`, so a report of "this request failed" can be tied to the exact request that produced it.

### Admin User Management

[`frontend/src/components/Admin/UserManagement.tsx`](frontend/src/components/Admin/UserManagement.tsx) drives `GET/POST/PUT/DELETE /api/v1/users` from the `/admin` console (จัดการระบบ). The same page hosts the registration policy and audit-log entry point; every endpoint it calls is admin-gated server-side.

| Capability | How |
|---|---|
| Search + filters | `GET /api/v1/users/?q=&role=&is_active=&skip=&limit=` — case-insensitive match on name/email/username; `%` and `_` are escaped, so a term like `a_b` is a literal rather than a wildcard. `limit` is capped at 200. |
| Paging | The match count comes back in the `X-Total-Count` header (`expose_headers=["*"]` is what lets the browser read it). If the header is missing the pager falls back to "a full page may have more". |
| Create | `POST /api/v1/users/admin-create` with `username`, `display_name`, `password`, optional `email` and `accessible_pages` (the JSON-as-text list the edit form uses; `NULL` means every page). |
| Edit | `PUT /api/v1/users/{id}` — role, status, page access, unlock, password reset. Refused for an account that is in the trash. |
| Delete | `DELETE /api/v1/users/{id}` **moves the account to the trash** (see below) rather than erasing it. |
| Trash | `GET /api/v1/users/deleted` lists trashed accounts with `days_remaining`, `POST /api/v1/users/{id}/restore` brings one back. |
| Permanent delete | `DELETE /api/v1/users/{id}?purge=true` — only accepted for an account that is already in the trash, so erasing is always a deliberate second step. |

**Deleting an account is recoverable for `USER_DELETE_RETENTION_DAYS` (default 30).** The row survives with `users.deleted_at` set, which is what keeps `audit_logs.user_id` resolvable while the decision can still be revisited. The account is locked out at the same moment (`is_active` cleared and every session row deleted), so a token issued a minute earlier stops working, and it is hidden from every listing. While it is in the trash its email/username stay reserved — that is what lets a restore return the same identity, and why creating a new account with those values gets a message pointing at the trash instead of a dead end.

There is no cron in this deployment: expired trash rows are purged opportunistically whenever an admin loads the user list or the trash (`UserService.purge_expired_users`), using an ORM delete so the sessions relationship cascades (the `sessions.user_id` foreign key has no `ON DELETE` rule).

## Security

- **CSRF (double-submit cookie).** Authenticated browser writes (`POST`/`PUT`/`PATCH`/`DELETE` under `/api/`) must echo the readable `csrf_token` cookie in the `X-CSRF-Token` header. Requests without any session cookie keep their normal 401, and `/login`, `/register`, `/refresh` and `/csrf` are exempt so a session can always be established or renewed. Failed checks return `403 {"code":"csrf_failed"}`.
- **Frontend handling.** [`frontend/src/lib/api/fetchWithAuth.ts`](frontend/src/lib/api/fetchWithAuth.ts) reads the cookie (or bootstraps one from `GET /api/v1/auth/csrf`), attaches the header on mutating calls, and retries once on `csrf_failed`. Set `CSRF_PROTECTION_ENABLED=False` only for non-browser clients.
- **API documentation.** `/docs`, `/redoc` and `/openapi.json` are served only when `DEBUG=True` or `ENABLE_API_DOCS=True`.
- **Security headers.** The backend sends a strict CSP (`connect-src` is built from `CORS_ORIGINS`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, and HSTS (two years, `includeSubDomains; preload`) outside `DEBUG`.
- **WebSocket notifications require a session.** The subscribe endpoint (`/api/v1/ws/notifications`) authenticates during the handshake and closes with `1008` when the token is missing, expired, belongs to a deleted/inactive/locked account, or does not exist. Nothing is read, sent or registered on that socket, so an anonymous visitor cannot hold a socket or receive admin broadcasts. The rejection is delivered as a WebSocket close frame (`accept()` then `close(1008)`) rather than a pre-accept rejection: an ASGI server answers the latter with HTTP `403`, which browsers surface as the generic abnormal closure `1006` — indistinguishable from a network blip, so the client would retry forever instead of stopping. The token is read from the HTTP-only `access_token` cookie (sent automatically with the upgrade request) or an `Authorization: Bearer` header — never from the query string, which would write credentials into access logs.
- **Connection caps.** `WS_MAX_CONNECTIONS` (default 200) and `WS_MAX_CONNECTIONS_PER_USER` (default 3) bound the in-process registry. Over-capacity handshakes are closed with `1013`. Without them, one account — or a client stuck in a reconnect loop — could grow the registry without bound. The frontend treats `1008` as terminal (no retry) and backs off progressively for any other close.
- **Signing keys.** With `DEBUG=False` the app refuses to start unless `SECRET_KEY` is at least 32 characters and not a known placeholder.
- **Client address trust.** `X-Forwarded-For` is only believed when the direct peer is a trusted proxy (`TRUSTED_PROXY_IPS`; by default loopback and RFC1918/ULA peers, which is what Render's load balancer looks like from inside the container). The chain is then walked right-to-left and the first untrusted address wins. Reading the leftmost entry — the previous behaviour — let any caller prepend an address and get an unlimited number of fresh rate-limit buckets; the same header was written into the audit log as the user's IP.

## Horizontal Scaling

The current deployment is a **single instance**, and one piece of state still assumes that:

| Component | State | Consequence of running >1 instance | Fix |
|---|---|---|---|
| Rate limiting (`SLOWAPI_STORAGE_URI`) | In-process counters | Each instance enforces its own limit, so the effective limit multiplies | Set `SLOWAPI_STORAGE_URI=redis://…` |
| WebSocket notifications | In-process connection registry | Delivery reaches clients on every instance because the payload is published to Redis pub/sub | Set `WS_BROADCAST_REDIS_URL=redis://…` (empty = process-local) |

The WebSocket registry is also *capped per process* (`WS_MAX_CONNECTIONS`, `WS_MAX_CONNECTIONS_PER_USER`), so scaling out raises the total socket ceiling rather than the per-user one.

Both surface a `[SCALING]` notice in the startup log so the assumption is never silent, and the log states which mode is active. The fan-out degrades safely: if Redis is unreachable — or the `redis` package is missing — the broadcast is still delivered to this instance's clients and the failure is logged.

The upstream-data endpoints (weather, geocode and oil prices) are the exception to the shared-state rule: they keep an L1 in-process cache **and** persist the last known good payload in the `weather_cache` table, so the stale fallback (and therefore a degraded-but-working widget) survives restarts, redeploys and cold starts. Each namespace keeps its newest row even after the 30-day retention window, because that row is the only thing a cold instance can serve while the provider is throttling it.

## Local Auth Cookie Note

Production auth uses cross-site HTTP-only cookies with `SameSite=None` and `Secure`. That combination is required for Vercel ↔ Render, but `SameSite=None` is only accepted by browsers together with `Secure` — over plain local HTTP the cookie is silently dropped, which presents as "login succeeds but the session never persists".

The backend therefore exposes `COOKIE_SAMESITE_EFFECTIVE`: when `COOKIE_SAMESITE=none` is configured without `COOKIE_SECURE`, the value is downgraded to `lax` and a `[CONFIG]` notice is logged, so copying production values into a local environment cannot lock you out. Use `COOKIE_SECURE=False` + `COOKIE_SAMESITE=lax` locally and keep `True`/`none` in production.
