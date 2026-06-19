# Login System Guide

## Setup

### Backend (Port 8888)
Backend runs on port 8888 to avoid conflicts with Docker which uses port 8000.

**Start Backend Server:**
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8888 --reload
```

### Frontend (Port 3000)
Frontend must be configured to point to backend port 8888 in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8888
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
- **Backend API:** http://localhost:8888
- **API Docs:** http://localhost:8888/docs
- **Docker:** port 8000 (used by Docker Desktop)

## Create Additional Test User

```bash
cd backend
python create_test_user.py
```

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

Invoke-RestMethod -Uri 'http://localhost:8888/api/v1/auth/login' `
    -Method POST `
    -Body $body `
    -ContentType 'application/json'
```

### cURL
```bash
curl -X POST http://localhost:8888/api/v1/auth/login \
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
1. Use port 8888 for backend instead
2. Update `NEXT_PUBLIC_API_URL` in frontend/.env.local
3. Restart frontend server

### Problem: No User in Database
**Solution:**
```bash
cd backend
python create_test_user.py
```

### Problem: CORS Error
**Solution:** Check that CORS_ORIGINS in backend/.env includes frontend URL:
```
CORS_ORIGINS=http://localhost:3000,http://localhost:80
```

## Architecture

```
Frontend (Next.js)          Backend (FastAPI)           Database (SQLite)
Port 3000                   Port 8888                   art_workspace.db
    |                           |                             |
    |-- POST /login ----------->|                             |
    |                           |-- Query User -------------->|
    |                           |<-- User Data ---------------|
    |                           |-- Create Session ---------->|
    |                           |-- Generate JWT Tokens       |
    |<-- Tokens + User Data ----|                             |
    |                           |                             |
```

## Security Features

1. **Password Hashing:** bcrypt
2. **JWT Tokens:** Access token (30 min) + Refresh token (7 days)
3. **Account Lockout:** 5 failed attempts = 30 min lock
4. **Session Tracking:** IP, User Agent, Device Label
5. **Failed Login Attempts:** Tracked per user

## API Endpoints

- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout (invalidate session)
- `GET /health` - Health check
- `GET /` - API info
