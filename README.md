# ART Workspace

ART Workspace is a Thai-language personal productivity dashboard built with a serverless-friendly full-stack architecture.

Production: [https://project-art-sigma.vercel.app](https://project-art-sigma.vercel.app)

## CI Status

The GitHub Actions pipeline (`ci.yml`) runs on every push and pull request to `main`:

- **Backend:** Python 3.11 — flake8 lint (`--max-line-length=120`) + pytest
- **Frontend:** Node 20 — ESLint + TypeScript type-check + Next.js production build

## Documentation

### Setup

- [Quick Reference](docs/setup/quick-reference.md)
- [Login System Setup](docs/setup/login-system.md)
- [Google Calendar Setup](docs/setup/google-calendar.md)
- [Migration and Deployment](docs/setup/migration-deployment.md)

### Architecture and Design

- [Design Principles](docs/design/design-principles.md)
- [Liquid Glass UI Guidelines](docs/design/liquid-glass-ui.md)
- [Frontend Architecture Review](docs/design/frontend-arch-review.md)
- [Accessibility Guide](docs/design/accessibility.md)

### Product

- [Roadmap and Requirements](docs/product/roadmap-features.md)
- [Widget Updates](docs/product/widget-updates.md)
- [Current Project Analysis](docs/internal/project-analysis.md)

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router, React 18, TypeScript 5 |
| Styling | Tailwind CSS, custom design tokens |
| UI Components | Radix UI (Dialog primitives), Lucide React icons |
| Drag and Drop | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Data Fetching | TanStack Query v5 |
| Auth Client | `AuthProvider` (centralized context) + `useAuth` hook |
| Alerts | SweetAlert2 + custom `useToast` hook |
| Mobile | `@capawesome/capacitor-google-sign-in` (Capacitor) |

### Backend

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.109, Uvicorn |
| ORM / DB | SQLAlchemy 2 async, Alembic migrations |
| Database | PostgreSQL (Neon in production, SQLite for CI tests) |
| Auth | JWT access + refresh tokens in HTTP-only cookies |
| Rate Limiting | SlowAPI |
| Scraping | httpx (EPPO oil prices) |
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

### Backend `.env`

```env
APP_NAME="ART Workspace API"
APP_VERSION="1.0.0"
DEBUG=True

DATABASE_URL=postgresql+asyncpg://<username>:<password>@<neon-host>/art_workspace?sslmode=require

SECRET_KEY="replace_with_a_long_random_secret"
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
COOKIE_SECURE=True
COOKIE_SAMESITE=none
AUTO_CREATE_TABLES=False

CORS_ORIGINS=http://localhost:3000,http://localhost:8080

BACKEND_GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
BACKEND_GOOGLE_CLIENT_SECRET="GOCSPX-xxxx"
BACKEND_GOOGLE_REDIRECT="http://localhost:8080/api/v1/auth/google/callback"
FRONTEND_URL="http://localhost:3000"
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

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
npm run build
```

Backend checks:

```bash
cd backend
flake8 app --max-line-length=120 --exclude=__pycache__
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
│       ├── api/v1/endpoints/    # auth, profile, oil_prices, calendar, users
│       └── core/                # config.py, database.py, security.py
├── design-system/art-workspace/ # MASTER.md + page overrides
└── .github/workflows/ci.yml     # CI: flake8 + pytest + ESLint + build
```

## Production Deployment Notes

### Render Backend

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set `DATABASE_URL`, `SECRET_KEY`, Google OAuth values, and `FRONTEND_URL` in Render environment variables.

### Vercel Frontend

- Framework preset: Next.js
- Root directory: `frontend`
- Set `NEXT_PUBLIC_API_URL` to the Render backend URL.
- Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for Google Sign-In support.

### Google OAuth

Configure these in Google Cloud Console:

- Authorized JavaScript origins: the Vercel frontend URL
- Authorized redirect URIs: the Render callback URL, ending with `/api/v1/auth/google/callback`

## Local Auth Cookie Note

Production auth uses cross-site HTTP-only cookies with `SameSite=None` and `Secure`. This is correct for Vercel and Render, but browser behavior can differ on plain local HTTP. If local login cookies do not persist, test with HTTPS locally or add an explicit development cookie configuration.

For plain local HTTP development, use `COOKIE_SECURE=False` and `COOKIE_SAMESITE=lax`. Keep production deployments on `COOKIE_SECURE=True` and `COOKIE_SAMESITE=none`. Use Alembic migrations in production; `AUTO_CREATE_TABLES=True` is only for local development convenience.
