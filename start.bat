@echo off
cd /d "%~dp0"

echo ============================================
echo   Extract.io - Demarrage local
echo ============================================
echo.

:: ─── Backend ──────────────────────────────────
echo [1/4] Verification du backend...
cd backend
if not exist "venv\Scripts\python.exe" (
    echo     Creation de l'environnement virtuel...
    python -m venv venv
    call venv\Scripts\activate
    echo     Installation des dependances Python...
    :: Skip psycopg2 (PostgreSQL) for local dev - use SQLite instead
    type requirements.txt | findstr /V "psycopg2" > %TEMP%\requirements-local.txt
    pip install -r %TEMP%\requirements-local.txt
    del %TEMP%\requirements-local.txt
    echo     Installation de Playwright Chromium...
    python -m playwright install chromium
) else (
    call venv\Scripts\activate
    echo     Verification des dependances Python...
    python -c "import fastapi" 2>nul || (
        echo     Installation des dependances manquantes...
        type requirements.txt | findstr /V "psycopg2" > %TEMP%\requirements-local.txt
        pip install -r %TEMP%\requirements-local.txt
        del %TEMP%\requirements-local.txt
        echo     Installation de Playwright Chromium...
        python -m playwright install chromium
    )
)

cd ..

:: ─── Frontend ─────────────────────────────────
echo [2/4] Verification du frontend...
cd frontend
if not exist "node_modules" (
    echo     Installation des dependances Node.js...
    call npm install
)
cd ..

:: ─── Demarrage ────────────────────────────────
echo [3/4] Demarrage des serveurs...

:: Backend sur le port 8000
start "Extract.io - Backend" cmd /c "cd /d %~dp0backend && .\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"

:: Frontend sur le port 5173
start "Extract.io - Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"

:: ─── Fin ──────────────────────────────────────
echo [4/4] Demarrage termine !
echo.
echo     Backend  : http://127.0.0.1:8000
echo     Frontend : http://127.0.0.1:5173
echo     Docs API : http://127.0.0.1:8000/docs
echo.
echo     Ferme cette fenetre pour arreter les serveurs.
echo.
pause
