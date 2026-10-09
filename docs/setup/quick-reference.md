# Quick Reference - ART Workspace

## Local URLs

- Frontend: `http://localhost:3000`
- Login: `http://localhost:3000/login`
- Dashboard: `http://localhost:3000/dashboard`
- Profile: `http://localhost:3000/profile`
- Backend API: `http://localhost:8080`
- Swagger: `http://localhost:8080/docs`
- Health (liveness + database status): `http://localhost:8080/health`
- Readiness (`503` when the database is down): `http://localhost:8080/health/ready`

## Local Run

### Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Validation

### Frontend

```powershell
cd frontend
npm run type-check
npm run lint
npm test                              # Vitest unit/component tests (86 tests)
npm run build
npm run test:smoke                    # Playwright; runs on port 3000
```

> The smoke-test script pins `-p 3000` automatically so random port binding does not break Playwright.

### Backend

```powershell
cd backend
.\venv\Scripts\python.exe -m flake8 app --max-line-length=120 --exclude=__pycache__
.\venv\Scripts\python.exe -m mypy app
.\venv\Scripts\python.exe -m pytest -q --tb=short      # Pytest (162 tests, 76.57% coverage)
```

## Common Tasks

### Run Alembic migrations

```powershell
cd backend
alembic upgrade head
```

### Check that the models and the migration chain agree

```powershell
cd backend
alembic check          # "No new upgrade operations detected." = clean
```

CI runs `alembic upgrade head` + `alembic check` on every push, so drift fails the build.

### Create a new migration

```powershell
cd backend
alembic revision --autogenerate -m "describe change"
```

### Run the expired-session cleanup by hand

```powershell
cd backend
.\venv\Scripts\python.exe -m app.services.session_cleanup
```

The same job runs in-app every `SESSION_CLEANUP_INTERVAL_HOURS` (default 6, `0` disables it).

### Audit backend dependencies

```powershell
cd backend
.\venv\Scripts\python.exe -m pip_audit -r requirements.txt
```

### Test oil prices endpoint

```powershell
cd backend
.\venv\Scripts\python.exe scripts\checks\check_oil_prices.py
```

`backend/scripts/checks/` holds manual connectivity checks. They are deliberately
named `check_*` and `pytest.ini` pins `testpaths = tests`, so a bare `pytest` run
never collects them.

## Settings worth knowing

| Variable | Default | Why you would set it |
|---|---|---|
| `TRUSTED_PROXY_IPS` | empty | Comma-separated IPs/CIDRs allowed to assert `X-Forwarded-For`. Empty trusts loopback/RFC1918 peers only, so public callers cannot pick their own rate-limit bucket. |
| `SESSION_CLEANUP_INTERVAL_HOURS` | `6` | Interval of the in-app expired-session cleanup; `0` turns it off. |
| `WS_BROADCAST_REDIS_URL` | empty | Fan WebSocket broadcasts out to every instance via Redis pub/sub. Empty = process-local. |
| `WS_MAX_CONNECTIONS` / `WS_MAX_CONNECTIONS_PER_USER` | `200` / `3` | Per-process socket caps. |
| `NEXT_PUBLIC_WS_URL` (frontend) | empty | Override the notification socket origin when a hosting rewrite does not forward WebSocket upgrades. |

## Notes

- Production URLs must come from deployment environment variables, not hardcoded personal URLs.
- **Alembic is the only owner of the schema.** Run `alembic upgrade head` on every release; the legacy startup `ALTER TABLE` repair has been removed. `AUTO_CREATE_TABLES=True` is a throwaway-local-database convenience and must stay `False` in production.
- Current dashboard routes in this repo are `/dashboard`, `/camera`, and `/profile`.
- Live notifications (`/api/v1/ws/notifications`) require a signed-in session — the handshake authenticates with the `access_token` cookie and is rejected with close code `1008` otherwise. See the README's Security section.
