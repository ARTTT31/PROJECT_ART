# Login System Guide

## Setup

### Backend (Port 8080)

The project scripts start the API on port 8080 (`backend/scripts/ops/restart_server.bat`). Use any port you like — just keep the frontend API URL in sync.

**Start Backend Server:**

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

### Frontend (Port 3000)

Point the frontend at the backend in `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8080
# or, to proxy through the same-origin /api rewrite:
API_INTERNAL_URL=http://localhost:8080
```

**Start Frontend Server:**

```bash
cd frontend
npm run dev
# or
yarn dev
```

**Note:** After modifying `.env.local`, you must restart the frontend server to load the new values.

## Test Login Information

- **Email:** admin@art.com
- **Password:** admin@123
- **Role:** admin

## Ports Used

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8080
- **API Docs:** http://localhost:8080/docs (only when `DEBUG=True` or `ENABLE_API_DOCS=True`)
- **Docker:** port 8000 (used by Docker Desktop, which is why the project defaults to 8080)

## Create Additional Test User

```bash
cd backend
py scripts/admin/create_test_user.py
```

Other admin helpers live in `backend/scripts/admin/` (see `backend/scripts/README.md`).

## Google Sign-In (Authorization-Code Flow)

Google login is handled by the backend — the browser never receives an OAuth token:

1. The login page navigates to `GET /api/v1/auth/google`.
2. The backend redirects to Google's consent screen (`response_type=code`).
3. Google redirects back to `GET /api/v1/auth/google/callback?code=...`.
4. The backend exchanges the code, verifies the `id_token` (signature + audience), finds or creates the user, sets the session cookies and redirects to `${FRONTEND_URL}/login-success`.

Required backend variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`.

## CSRF Protection

Authenticated browser writes (`POST`/`PUT`/`PATCH`/`DELETE` under `/api/`) must echo the readable `csrf_token` cookie in the `X-CSRF-Token` header:

- The backend issues the cookie on any response when it is missing; `GET /api/v1/auth/csrf` returns the same value in the body for cross-site deployments where the cookie is not readable from the frontend origin.
- Missing/invalid values return `403 {"code":"csrf_failed"}`.
- `/login`, `/register`, `/refresh`, `/google*` and `/csrf` are exempt, so a session can always be established or renewed.
- The frontend helper `frontend/src/lib/api/fetchWithAuth.ts` attaches the header automatically and retries once on failure.
- Disable only for non-browser clients via `CSRF_PROTECTION_ENABLED=False`.

## Test API Directly

### PowerShell

```powershell
$body = @{
    email = "admin@art.com"
    password = "admin@123"
    session_id = "test_session"
    user_agent = "PowerShell"
    device_label = "Desktop"
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/auth/login' `
    -Method POST `
    -Body $body `
    -ContentType 'application/json'
```

### cURL

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@art.com",
    "password": "admin@123",
    "session_id": "test_session",
    "user_agent": "curl",
    "device_label": "Desktop"
  }'
```

## Troubleshooting

### Problem: ERR_EMPTY_RESPONSE
**Cause:** Port 8000 is used by Docker or another process

**Solution:**
1. Use port 8080 for the backend instead
2. Update `NEXT_PUBLIC_API_URL` / `API_INTERNAL_URL` in `frontend/.env.local`
3. Restart the frontend server

### Problem: No User in Database
**Solution:**
```bash
cd backend
py scripts/admin/create_test_user.py
```

### Problem: CORS Error
**Solution:** Check that `CORS_ORIGINS` in `backend/.env` includes the exact frontend origin:
```
CORS_ORIGINS=http://localhost:3000
```

### Problem: `403 csrf_failed`
**Cause:** A mutating request was sent without the `X-CSRF-Token` header while a session cookie was present.

**Solution:** Send the `csrf_token` cookie value in the header (or disable CSRF for non-browser clients with `CSRF_PROTECTION_ENABLED=False`).

## Architecture

```
Frontend (Next.js)          Backend (FastAPI)           Database (SQLite)
Port 3000                   Port 8080                   art_workspace.db
    |                           |                             |
    |-- POST /login ----------->|                             |
    |                           |-- Query User -------------->|
    |                           |<-- User Data ---------------|
    |                           |-- Create Session ---------->|
    |                           |-- Generate JWT Tokens       |
    |<-- Cookies + User Data ---|                             |
    |                           |                             |
```

## Security Features

1. **Password Hashing:** Argon2 (via `argon2-cffi`)
2. **JWT Tokens:** Access token (30 min) + Refresh token (7 days) in HTTP-only cookies
3. **CSRF:** Double-submit cookie + `X-CSRF-Token` header on mutating requests
4. **Account Lockout:** 5 failed attempts = 30 min lock
5. **Session Tracking:** IP, User Agent, Device Label
6. **Rate Limiting:** SlowAPI (`RATE_LIMIT_AUTH_PER_MINUTE`, default 10/min)
7. **API Docs:** disabled unless `DEBUG=True` or `ENABLE_API_DOCS=True`

## API Endpoints

- `GET  /api/v1/auth/csrf` - Issue/echo the CSRF token
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout (invalidate session)
- `GET  /api/v1/auth/session` - Current session/user
- `GET  /api/v1/auth/google` - Start Google OAuth (redirect)
- `GET  /api/v1/auth/google/callback` - Google OAuth callback
- `GET  /health` - Health check
- `GET  /` - API info
