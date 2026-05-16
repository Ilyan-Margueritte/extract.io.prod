@echo off
cd /d "%~dp0"

echo ============================================
echo   Extract.io - Backend Server
echo ============================================
echo.

:: Set PYTHONPATH to include backend directory
set PYTHONPATH=%~dp0backend;%PYTHONPATH%

:: Start the backend server
"%~dp0backend\venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000 --host 127.0.0.1

pause