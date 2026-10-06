@echo off
setlocal enabledelayedexpansion
title PhantmOS Launcher
cd /d "%~dp0"

echo ===================================================
echo        Starting PhantmOS v3.2 Engine
echo ===================================================
echo.

:: 1. Check Root .env configuration
if not exist ".env" (
    if exist ".env.example" (
        echo [*] .env not found. Creating from .env.example...
        copy .env.example .env >nul
    )
)

:: 2. Check Frontend .env
if not exist "frontend\.env" (
    if exist "frontend\.env.production" (
        copy "frontend\.env.production" "frontend\.env" >nul
    )
)

:: 3. Detect Python Environment
set "PYTHON_EXE=python"
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
    echo [*] Using virtual environment: .venv
) else if exist "venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
    echo [*] Using virtual environment: venv
)

:: 4. Check Frontend Dependencies
if not exist "frontend\node_modules" (
    echo [*] frontend\node_modules not found. Installing npm dependencies...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
    echo.
)

:: 5. Start Backend Server (FastAPI / Uvicorn on port 8080)
echo [*] Starting Backend Server on http://localhost:8080 ...
start "PhantmOS Backend" cmd /k "title PhantmOS Backend && cd /d "%~dp0" && "!PYTHON_EXE!" -m uvicorn dashboard:app --host 0.0.0.0 --port 8080 --reload"

:: Wait 2 seconds for backend initialization
timeout /t 2 /nobreak >nul

:: 6. Start Frontend Dev Server (Vite)
echo [*] Starting Frontend Server (Vite) ...
start "PhantmOS Frontend" cmd /k "title PhantmOS Frontend && cd /d "%~dp0frontend" && npm run dev"

echo.
echo ===================================================
echo   PhantmOS services launched successfully!
echo   - Backend API: http://localhost:8080
echo   - Frontend:    http://localhost:5173 (or port shown in Vite)
echo ===================================================
echo.
pause
