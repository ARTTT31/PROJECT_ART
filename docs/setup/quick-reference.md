# Quick Reference - ART Workspace

## Local URLs

- Frontend: `http://localhost:3000`
- Login: `http://localhost:3000/login`
- Dashboard: `http://localhost:3000/dashboard`
- Profile: `http://localhost:3000/profile`
- Backend API: `http://localhost:8080`
- Swagger: `http://localhost:8080/docs`
- Health: `http://localhost:8080/health`

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
npm test                              # Vitest unit/component tests
npm run build
npm run test:smoke                    # Playwright; needs port 3000 free
```

> If `PORT` is set to `0` in your shell, `next dev` binds a random port and the
> Playwright web server times out — run `PORT=3000 npm run test:smoke`.

### Backend

```powershell
cd backend
.\venv\Scripts\python.exe -m flake8 app --max-line-length=120 --exclude=__pycache__
.\venv\Scripts\python.exe -m mypy app
.\venv\Scripts\python.exe -m pytest -q --tb=short
```

## Common Tasks

### Run Alembic migrations

```powershell
cd backend
alembic upgrade head
```

### Create a new migration

```powershell
cd backend
alembic revision --autogenerate -m "describe change"
```

### Test oil prices endpoint

```powershell
cd backend
.\venv\Scripts\python.exe scripts\checks\check_oil_prices.py
```

`backend/scripts/checks/` holds manual connectivity checks. They are deliberately
named `check_*` and `pytest.ini` pins `testpaths = tests`, so a bare `pytest` run
never collects them.

## Notes

- Production URLs must come from deployment environment variables, not hardcoded personal URLs.
- **Alembic is the only owner of the schema.** Run `alembic upgrade head` on every release; the legacy startup `ALTER TABLE` repair has been removed. `AUTO_CREATE_TABLES=True` is a throwaway-local-database convenience and must stay `False` in production.
- Current dashboard routes in this repo are `/dashboard`, `/camera`, and `/profile`.
- Live notifications (`/api/v1/ws/notifications`) require a signed-in session — the handshake authenticates with the `access_token` cookie and is rejected with close code `1008` otherwise. See the README's Security section.
