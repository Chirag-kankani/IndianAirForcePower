@echo off
title AirPower IAF Tactical Platform - Presentation Launcher
color 0B
echo ===============================================================================
echo     BHARATIYA VAYU SENA - AIRPOWER TACTICAL AIR PICTURE PLATFORM
echo     1-Click Local Demo Presentation Launcher
echo ===============================================================================
echo.

cd /d "%~dp0"
if exist "AirPower" cd AirPower

echo [1/3] Checking Python backend dependencies...
python -c "import fastapi, uvicorn, ortools, shapely, aiofiles" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Installing required backend packages...
    python -m pip install -r backend\requirements.txt
)

echo [2/3] Launching FastAPI Backend on port 8000...
start "AirPower Backend (FastAPI)" cmd /k "cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [3/3] Launching Vite Tactical Frontend on port 5173...
start "AirPower Frontend (React/Vite)" cmd /k "cd frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo Opening Tactical Air Picture in your default browser...
start http://localhost:5173/

echo.
echo ===============================================================================
echo     AIRPOWER SYSTEM RUNNING LOCALLY AT: http://localhost:5173/
echo     Press any key to close this launcher window (servers will stay open)
echo ===============================================================================
pause >nul
