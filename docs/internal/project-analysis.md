# ART Workspace Project Analysis

**Last updated:** June 22, 2026  
**Scope:** Full-stack repository review, local validation, and documentation refresh  
**Repository path:** `D:\Program\Project\PROJECT_ART`

## Executive Summary

ART Workspace is a Thai-language personal productivity dashboard built as a modern full-stack web application. The current architecture is split into a Next.js frontend, a FastAPI backend, and a PostgreSQL database target, with production deployment documented for Vercel, Render, and Neon.

The project is in a workable state. The frontend passes TypeScript and ESLint validation. Backend tests could not be executed in this local environment because `python` is not available on PATH, so backend runtime status still needs verification from a Python-enabled shell or virtual environment.

Important note: Thai UI text in source files is valid UTF-8. Some PowerShell/Codex terminal output may render it as mojibake, but raw file inspection confirms the files themselves are not corrupted.

## Current Stack

| Layer | Technology | Current Use |
| --- | --- | --- |
| Frontend | Next.js 14 App Router, React 18, TypeScript | Main web application |
| Styling | Tailwind CSS, CSS modules, global design tokens | Dashboard, login, profile, widgets |
| UI libraries | Lucide React, Radix Dialog, SweetAlert2 | Icons, dialogs, notifications |
| Backend | FastAPI, SQLAlchemy async, Alembic | REST API and database access |
| Auth | JWT access/refresh tokens in HTTP-only cookies | Standard login and Google OAuth |
| Database | PostgreSQL target, SQLite for tests | Neon in production, in-memory SQLite in tests |
| External data | Google Calendar iCal, EPPO oil price page | Calendar/task widgets and oil price widget |

## Application Shape

### Frontend

Main pages:

- `/login` - username/email login and Google OAuth entry
- `/login-success` - OAuth callback completion flow
- `/dashboard` - widget dashboard
- `/profile` - profile, password, and quick-link management
- `/` - redirect to `/login`

Key frontend files:

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/profile/page.tsx`
- `frontend/src/components/Auth/AuthProvider.tsx`
- `frontend/src/lib/api/fetchWithAuth.ts`
- `frontend/src/lib/api/client.ts`

### Backend

API router groups:

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/profile`
- `/api/v1/calendar`
- `/api/v1/audit`
- `/api/v1/oil-prices`
- `/api/v1/system`

Key backend files:

- `backend/app/main.py`
- `backend/app/api/v1/router.py`
- `backend/app/api/dependencies.py`
- `backend/app/services/auth_service.py`
- `backend/app/core/security.py`
- `backend/app/core/database.py`

## Validation Results

Commands run from the local workspace:

```text
frontend> npm run type-check
Result: passed

frontend> npm run lint
Result: passed

backend> python -m pytest
Result: not run; python executable was not found on PATH
```

## Positive Findings

The frontend currently passes static validation with no TypeScript or ESLint errors.

Authentication has moved in the right direction: access and refresh tokens are set as HTTP-only cookies instead of being exposed in the JSON login response. The frontend sends requests with `credentials: 'include'` and has refresh handling in place.

The backend has a clean service-layer split for authentication, users, audit logging, and session management. Endpoint handlers are not carrying all business logic directly.

The dashboard uses widget-level error boundaries, which limits blast radius when one widget fails.

The Google OAuth callback verifies the Google ID token with `google-auth`, checks the audience, and rejects unverified email accounts.

The project has Alembic migrations, backend tests, and frontend lint/type-check scripts, giving it a good base for CI once backend Python execution is available.

## Active Risks and Recommendations

### P1: Backend Tests Are Not Locally Verified

`python -m pytest` could not run because Python is not available on PATH in this environment. The backend may still be healthy, but it was not verified during this pass.

Recommendation:

```powershell
cd backend
py -m pytest
```

or install/configure Python 3.11+ and run:

```powershell
python -m pytest
```

### P1: Local Cookie Behavior Needs a Clear Development Mode

The backend sets cookies with `secure=True` and `samesite="none"`, which is correct for cross-site production hosting between Vercel and Render. On plain local HTTP, secure cookies may not be persisted by the browser.

Recommendation: add an explicit local development cookie mode or document that local auth should run over HTTPS when testing cookie-based login end-to-end.

### P2: Duplicate Frontend API Helpers

The frontend has both `fetchWithAuth.ts` and `client.ts`, each with refresh-token behavior. This can drift over time.

Recommendation: choose one primary API path or extract shared refresh/logout behavior into one module.

### P2: Startup Table Creation Overlaps With Alembic

`backend/app/main.py` creates tables during application startup with `Base.metadata.create_all`. This is convenient for early development but can hide migration drift in production.

Recommendation: keep Alembic as the production source of truth and restrict automatic table creation to test/dev mode only.

### P2: Oil Price Scraping Is Fragile

The oil price endpoint parses EPPO HTML with regex and falls back to static prices. This keeps the widget alive but risks serving stale data as if it were current.

Recommendation: label fallback data clearly in the UI/API and consider caching successful upstream responses with a timestamp.

### P3: Frontend Has No Automated UI Tests

The frontend has static validation but no unit, integration, or end-to-end tests.

Recommendation: add a small Playwright smoke suite for login, dashboard load, and profile page rendering.

## Documentation Corrections Made in This Pass

Previous project notes contained stale findings that no longer match the codebase:

- CSP headers are now present in both FastAPI middleware and `frontend/next.config.js`.
- `dompurify` is installed and used by `TaskListWidget`.
- Token handling has been migrated toward HTTP-only cookies.
- The source files are UTF-8; Thai text corruption observed in terminal output is a display issue, not file corruption.

## Suggested Next Work

1. Run backend tests with a working Python interpreter.
2. Decide whether local auth should support insecure HTTP cookies or require local HTTPS.
3. Consolidate frontend API refresh handling.
4. Gate `create_all` behind a development/test setting.
5. Add a minimal Playwright smoke test suite.
