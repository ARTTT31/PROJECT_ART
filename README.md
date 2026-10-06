# ART Workspace

ART Workspace is a Thai-language personal productivity dashboard built with a serverless-friendly full-stack architecture.

Production URL: configure this in your deployment environment; do not commit a personal deployment URL.

## CI Status

The GitHub Actions pipeline (`ci.yml`) runs on every push and pull request to `main`:

- **Backend:** Python 3.11 — flake8 lint (`--max-line-length=120`) + mypy type check + pytest (coverage gate 40%)
- **Frontend:** Node 20 — ESLint + TypeScript type-check + Next.js production build + Playwright smoke tests

## Documentation

### Setup

- [Quick Reference](docs/setup/quick-reference.md)
- [Login System Setup](docs/setup/login-system.md)
- [Migration and Deployment](docs/setup/migration-deployment.md)

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
- **Framework:** Next.js 16 App Router, React 18, TypeScript 5
- **Styling:** Tailwind CSS, custom design tokens
- **UI Components:** Radix UI, Lucide React icons, Framer Motion
- **Drag and Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`
- **PWA Support:** `@serwist/next`
- **Error Tracking:** `@sentry/nextjs`
- **E2E Testing:** Playwright smoke tests run in CI
- **Data Fetching:** TanStack Query v5
- **Auth Client:** `AuthProvider` (centralized context) + `useAuth` hook
- **Alerts:** SweetAlert2 + custom `useToast` hook

### Backend

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.111, Uvicorn |
| Real-time | WebSocket notifications (authenticated handshake, connection caps) |
| ORM / DB | SQLAlchemy 2 async, Alembic migrations |
| Database | PostgreSQL (Neon in production, SQLite for CI tests) |
| Auth | JWT access + refresh tokens in HTTP-only cookies + double-submit-cookie CSRF (`X-CSRF-Token`) |
| Rate Limiting | SlowAPI |
| Upstream data | httpx (Bangchak oil prices, Open-Meteo weather, BigDataCloud geocode) |
| Linting | flake8 6.1, mypy 1.9 |

### Infrastructure

| Layer | Technology |
|---|---|
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Database | Neon (serverless PostgreSQL) |

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
| `ENABLE_API_DOCS` | `False` | Serves `/docs`, `/redoc` and `/openapi.json`. Always on when `DEBUG=True`. |
| `CSRF_PROTECTION_ENABLED` | `True` | Double-submit-cookie CSRF check for authenticated browser writes. Only disable for non-browser clients. |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | derived | `True`/`none` on Render; `False`/`lax` for plain local HTTP. |

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
│       ├── app/                 # Pages (dashboard, login, profile, camera)
│       ├── components/
│       │   ├── Auth/            # AuthProvider — centralized session context
│       │   ├── Layout/          # DashboardLayout (header + sidebar)
│       │   ├── Toast/           # useToast hook + ToastProvider
│       │   ├── ui/              # Dialog.tsx — Radix UI primitives
│       │   └── Widgets/         # Dashboard widgets (dnd-kit sortable)
│       ├── hooks/               # useAuth.ts
│       └── utils/               # quickLinks, sweetalert, userAgent
├── backend/                     # FastAPI
│   └── app/
│       ├── api/v1/endpoints/    # auth, profile, oil_prices, users, audit, system
│       └── core/                # config.py, database.py, security.py
├── design-system/art-workspace/ # MASTER.md + page overrides
└── .github/workflows/ci.yml     # CI: flake8 + pytest + ESLint + build
```

## Production Deployment Notes

### Render Backend

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set `DATABASE_URL`, a long random `SECRET_KEY`, OAuth values, `FRONTEND_URL`, and the exact `CORS_ORIGINS` frontend URL in Render environment variables.
- Keep `DEBUG=False` and `AUTO_CREATE_TABLES=False` in production. Alembic is the only owner of the schema: run `alembic upgrade head` for every release.

### Vercel Frontend

- Framework preset: Next.js
- Root directory: `frontend`
- Set `NEXT_PUBLIC_SITE_URL` to the canonical frontend URL.
- Set `NEXT_PUBLIC_API_URL` to the public API URL, or leave it unset to route browser requests through `/api`.
- When using the `/api` rewrite, set `API_INTERNAL_URL` to the backend URL. This server-only variable keeps the backend address out of browser bundles.
- Google Sign-In is handled entirely by the backend authorization-code flow; no `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is needed in the frontend.
- Sentry source-map upload only runs when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are all set.

### Release Checklist

1. Run `alembic upgrade head` against the production database before deploying the backend.
2. Confirm `DEBUG=False`, automatic schema flags are disabled, and `CORS_ORIGINS` contains only the deployed frontend origin.
3. Set the frontend URLs above in the deployment environment; do not rely on a URL embedded in source code.
4. Run the validation commands in this document and verify login, profile editing, dashboard widgets, and the production `/api` rewrite after deployment.

### Google OAuth

Sign-in uses the server-side authorization-code flow — no OAuth token ever reaches the browser URL:

1. The login page sends the browser to `GET /api/v1/auth/google`.
2. The backend builds the Google consent URL; Google redirects back to `GET /api/v1/auth/google/callback` with a `code`.
3. The backend exchanges the code, verifies the `id_token` audience/signature, finds or creates the user, sets the session cookies and redirects to `${FRONTEND_URL}/login-success`.

Configure these in Google Cloud Console:

- Authorized JavaScript origins: the Vercel frontend URL
- Authorized redirect URIs: the Render callback URL, ending with `/api/v1/auth/google/callback`

Backend OAuth variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` and `FRONTEND_URL` (the post-login redirect target).

## Security

- **CSRF (double-submit cookie).** Authenticated browser writes (`POST`/`PUT`/`PATCH`/`DELETE` under `/api/`) must echo the readable `csrf_token` cookie in the `X-CSRF-Token` header. Requests without any session cookie keep their normal 401, and `/login`, `/register`, `/refresh`, `/google*` and `/csrf` are exempt so a session can always be established or renewed. Failed checks return `403 {"code":"csrf_failed"}`.
- **Frontend handling.** [`frontend/src/lib/api/fetchWithAuth.ts`](frontend/src/lib/api/fetchWithAuth.ts) reads the cookie (or bootstraps one from `GET /api/v1/auth/csrf`), attaches the header on mutating calls, and retries once on `csrf_failed`. Set `CSRF_PROTECTION_ENABLED=False` only for non-browser clients.
- **API documentation.** `/docs`, `/redoc` and `/openapi.json` are served only when `DEBUG=True` or `ENABLE_API_DOCS=True`.
- **Security headers.** The backend sends a strict CSP (`connect-src` is built from `CORS_ORIGINS`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and HSTS (two years, `includeSubDomains; preload`) outside `DEBUG`.
- **WebSocket notifications require a session.** The subscribe endpoint (`/api/v1/ws/notifications`) authenticates during the handshake and closes with `1008` before accepting when the token is missing, expired, belongs to a deleted/inactive/locked account, or does not exist. The token is read from the HTTP-only `access_token` cookie (sent automatically with the upgrade request) or an `Authorization: Bearer` header — never from the query string, which would write credentials into access logs. A rejected handshake is a failed connection, so an anonymous visitor cannot hold a socket or receive admin broadcasts.
- **Connection caps.** `WS_MAX_CONNECTIONS` (default 200) and `WS_MAX_CONNECTIONS_PER_USER` (default 3) bound the in-process registry. Over-capacity handshakes are closed with `1013`. Without them, one account — or a client stuck in a reconnect loop — could grow the registry without bound. The frontend treats `1008` as terminal (no retry) and backs off progressively for any other close.
- **Signing keys.** With `DEBUG=False` the app refuses to start unless `SECRET_KEY` is at least 32 characters and not a known placeholder.

## Horizontal Scaling

The current deployment is a **single instance**, and two pieces of state assume that:

| Component | State | Consequence of running >1 instance |
|---|---|---|
| Rate limiting (`SLOWAPI_STORAGE_URI`) | In-process counters | Each instance enforces its own limit, so the effective limit multiplies |
| WebSocket notifications | In-process connection registry | `POST /api/v1/ws/broadcast` only reaches clients on the instance that served it |

The WebSocket registry is also *capped per process* (`WS_MAX_CONNECTIONS`, `WS_MAX_CONNECTIONS_PER_USER`), so scaling out raises the total socket ceiling rather than the per-user one.

Both surface a `[SCALING]` notice in the startup log so the assumption is never silent. Before adding a second instance, point `SLOWAPI_STORAGE_URI` at a shared Redis (`redis://…`) and give the WebSocket manager a pub/sub fan-out through the same broker.

The weather/geocode proxies are the exception: they keep an L1 in-process cache **and** persist the last known good payload in the `weather_cache` table, so the stale fallback (and therefore a degraded-but-working widget) survives restarts, redeploys and cold starts.

## Local Auth Cookie Note

Production auth uses cross-site HTTP-only cookies with `SameSite=None` and `Secure`. That combination is required for Vercel ↔ Render, but `SameSite=None` is only accepted by browsers together with `Secure` — over plain local HTTP the cookie is silently dropped, which presents as "login succeeds but the session never persists".

The backend therefore exposes `COOKIE_SAMESITE_EFFECTIVE`: when `COOKIE_SAMESITE=none` is configured without `COOKIE_SECURE`, the value is downgraded to `lax` and a `[CONFIG]` notice is logged, so copying production values into a local environment cannot lock you out. Use `COOKIE_SECURE=False` + `COOKIE_SAMESITE=lax` locally and keep `True`/`none` in production.
