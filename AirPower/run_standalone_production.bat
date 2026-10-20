@echo off
title AirPower Standalone Production Runner
color 0A
echo ===============================================================================
echo     AIRPOWER - STANDALONE SINGLE-PROCESS PRODUCTION RUNNER
echo     (Serves Compiled React SPA + FastAPI REST API + WebSockets on port 8000)
echo ===============================================================================
echo.

cd /d "%~dp0"

echo [1/2] Building frontend bundle (if needed)...
if not exist "frontend\dist\index.html" (
    echo Building React production bundle...
    cd frontend && npm run build && cd ..
)

echo [2/2] Launching unified FastAPI server on port 8000...
start http://localhost:8000/
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
