# ART Workspace Project Analysis

**Last updated:** August 25, 2026  
**Scope:** Full-stack repository review, local validation, and system-wide refresh  
**Repository path:** `D:\Program\Project\PROJECT_ART`

## Executive Summary

ART Workspace is a Thai-language personal productivity dashboard built as a modern full-stack web application. The architecture consists of a Next.js 16 frontend (App Router + Turbopack), a FastAPI backend, and a PostgreSQL database target (Neon in production, in-memory SQLite for tests).

The full stack has been verified locally and is in a clean, fully passing state:
- **Backend Tests:** 52/52 pytest tests passing 100%.
- **Backend Linting:** Flake8 passes with 0 errors across all app modules.
- **Frontend Type Check:** TypeScript type check passes with 0 errors.
- **Frontend Linting:** ESLint passes with 0 errors.
- **Frontend Production Build:** Next.js production build succeeds cleanly with 0 errors and 0 warnings.

## Current Stack

| Layer | Technology | Current Use |
| --- | --- | --- |
| Frontend | Next.js 16 App Router, React 18, TypeScript 5 | Main web application |
| Styling | Tailwind CSS, Enterprise Admin Design Tokens | Dashboard, login, profile, widgets |
| UI libraries | Lucide React, Radix Dialog, SweetAlert2 | Icons, dialogs, notifications |
| Backend | FastAPI, SQLAlchemy async, Alembic | REST API and database access |
| Auth | JWT access/refresh tokens in HTTP-only cookies | Standard login, Google OAuth, and Microsoft Entra |
| Database | PostgreSQL target, SQLite for tests | Neon in production, in-memory SQLite in tests |
| External data | Google Calendar iCal / Graph API, EPPO oil price page | Calendar/task widgets and oil price widget |

## Application Shape

### Frontend

Main pages:

- `/login` - username/email login, Google OAuth, and Microsoft Entra login
- `/login-success` - OAuth callback completion flow
- `/dashboard` - widget dashboard (Calendar, Task list, Oil price, QR Code)
- `/profile` - profile, password, and quick-link management
- `/apple-style` - isolated design showcase page
- `/` - redirect to `/login`

Key frontend files:

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/profile/page.tsx`
- `frontend/src/components/Auth/AuthProvider.tsx`
- `frontend/src/lib/api/fetchWithAuth.ts`

### Backend

API router groups:

- `/api/v1/auth` - Authentication, refresh tokens, Google/Microsoft OAuth
- `/api/v1/users` - User management
- `/api/v1/profile` - User profile, quick links, avatar
- `/api/v1/calendar` - Google & Microsoft/SharePoint calendar integration
- `/api/v1/audit` - Audit log retrieval
- `/api/v1/oil-prices` - EPPO oil price scraping and cached responses
- `/api/v1/system` - Admin system health and metrics

Key backend files:

- `backend/app/main.py`
- `backend/app/api/v1/router.py`
- `backend/app/api/dependencies.py`
- `backend/app/services/auth_service.py`
- `backend/app/core/security.py`
- `backend/app/core/database.py`

## Validation Results

```text
backend> flake8 app --max-line-length=120 --exclude=__pycache__
Result: passed (0 errors)

backend> pytest -q --tb=short
Result: passed (52 passed in 8.81s)

frontend> npm run type-check
Result: passed (0 errors)

frontend> npm run lint
Result: passed (0 errors)

frontend> npm run build
Result: passed (Compiled successfully, 9/9 static routes generated)
```

## System Improvements Applied

1. **Flake8 Compliance in Backend:**
   - Resolved line-length violations in `calendar.py` and `config.py` (all lines < 120 chars).

2. **Next.js 16 Configuration & Metadata:**
   - Configured `output: 'export'` conditionally only when `EXPORT_STATIC=true` is provided, ensuring standard deployments apply Security Headers (CSP, HSTS, X-Frame-Options) and API rewrites without warnings.
   - Configured `metadataBase` in `layout.tsx` for clean OpenGraph metadata generation.

3. **Enterprise Design Alignment:**
   - Dashboard layout unified with Enterprise Admin DNA (Ant Design inspired clean surfaces, structured layout, and standard tokens).
