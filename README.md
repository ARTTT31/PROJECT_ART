# ART Workspace

ART Workspace is a Thai-language personal productivity dashboard built with a serverless-friendly full-stack architecture.

Production: [https://project-art-sigma.vercel.app](https://project-art-sigma.vercel.app)

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

- Frontend: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy async, Alembic, SlowAPI
- Database: PostgreSQL, with Neon documented as the production target
- Auth: JWT access and refresh tokens stored in HTTP-only cookies
- Hosting target: Vercel frontend, Render backend, Neon database

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
- API docs: [http://localhost:8080/docs](http://localhost:8080/docs)

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
```

Backend tests:

```bash
cd backend
python -m pytest
```

If Windows has the Python launcher but not `python` on PATH, use:

```powershell
py -m pytest
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

### Google OAuth

Configure these in Google Cloud Console:

- Authorized JavaScript origins: the Vercel frontend URL
- Authorized redirect URIs: the Render callback URL, ending with `/api/v1/auth/google/callback`

## Local Auth Cookie Note

Production auth uses cross-site HTTP-only cookies with `SameSite=None` and `Secure`. This is correct for Vercel and Render, but browser behavior can differ on plain local HTTP. If local login cookies do not persist, test with HTTPS locally or add an explicit development cookie configuration.

For plain local HTTP development, use `COOKIE_SECURE=False` and `COOKIE_SAMESITE=lax`. Keep production deployments on `COOKIE_SECURE=True` and `COOKIE_SAMESITE=none`. Use Alembic migrations in production; `AUTO_CREATE_TABLES=True` is only for local development convenience.
