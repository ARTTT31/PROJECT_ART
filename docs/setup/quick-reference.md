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
npm run build
```

### Backend

```powershell
cd backend
.\venv\Scripts\python.exe -m flake8 app --max-line-length=120 --exclude=__pycache__
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
.\venv\Scripts\python.exe scripts\tests\test_oil_prices.py
```

## Notes

- Production URLs must come from deployment environment variables, not hardcoded personal URLs.
- Use Alembic for production schema changes. Do not rely on raw auto-migrate flows.
- Current dashboard routes in this repo are `/dashboard`, `/camera`, and `/profile`.
