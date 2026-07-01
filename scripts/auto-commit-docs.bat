@echo off
REM Auto-commit Documentation and Changes Script (Windows)
REM Usage: scripts\auto-commit-docs.bat "your custom message (optional)"

setlocal enabledelayedexpansion

echo ========================================
echo 📦 Auto-commit Documentation Script
echo ========================================
echo.

REM Check if we're in a git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Not in a git repository
    exit /b 1
)

REM Check for uncommitted changes
git status -s > temp_status.txt
set /p FIRST_LINE=<temp_status.txt
del temp_status.txt

if "%FIRST_LINE%"=="" (
    echo ⚠️  No changes to commit
    exit /b 0
)

REM Show status
echo 📊 Current status:
git status -s
echo.

REM Stage all changes
echo 📝 Staging all changes...
git add .

REM Generate or use custom commit message
if not "%~1"=="" (
    set "COMMIT_MSG=%~1"
    echo ✅ Using custom commit message
) else (
    echo 🤖 Generating commit message...
    
    REM Get timestamp
    for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (
        set DATE=%%c-%%a-%%b
    )
    for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
        set TIME=%%a:%%b
    )
    
    set "COMMIT_MSG=chore: update project files

Changes automatically committed

Committed: !DATE! !TIME!"
)

echo.
echo 📝 Commit message:
echo !COMMIT_MSG!
echo.

REM Commit changes
echo 💾 Creating commit...
git commit -m "!COMMIT_MSG!"

if errorlevel 1 (
    echo ❌ Commit failed
    exit /b 1
)

REM Get commit hash
for /f "tokens=*" %%a in ('git rev-parse --short HEAD') do set COMMIT_HASH=%%a
echo ✅ Committed successfully: !COMMIT_HASH!
echo.

REM Ask to push
set /p PUSH_CONFIRM="🚀 Push to remote? (y/n): "

if /i "%PUSH_CONFIRM%"=="y" (
    echo 📤 Pushing to remote...
    
    REM Get current branch
    for /f "tokens=*" %%a in ('git branch --show-current') do set CURRENT_BRANCH=%%a
    
    REM Push
    git push origin !CURRENT_BRANCH!
    
    if errorlevel 1 (
        echo ❌ Push failed
        exit /b 1
    )
    
    echo ✅ Pushed to origin/!CURRENT_BRANCH! successfully!
) else (
    echo ⏸️  Skipped push. Run 'git push' manually when ready.
)

echo.
echo ========================================
echo ✨ Done!
echo ========================================

endlocal
