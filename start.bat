@echo off
echo ========================================
echo   ART Workspace - Quick Start
echo ========================================
echo.

echo Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not running!
    echo Please install Docker Desktop first.
    pause
    exit /b 1
)

echo Docker is ready!
echo.

echo Starting services...
docker-compose up -d

echo.
echo ========================================
echo   Services are starting...
echo ========================================
echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo   Access URLs:
echo ========================================
echo   Frontend:  http://localhost:8080
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo ========================================
echo.

echo Checking service status...
docker-compose ps

echo.
echo ========================================
echo   Next Steps:
echo ========================================
echo   1. Create admin user:
echo      docker-compose exec backend python create_admin.py
echo.
echo   2. Open browser and go to:
echo      http://localhost:8080
echo.
echo   3. View logs:
echo      docker-compose logs -f
echo ========================================
echo.

pause
