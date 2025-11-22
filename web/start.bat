@echo off
echo === Spoustim Flask server na Windows ===

REM Vytvoření virtuálního prostředí, pokud neexistuje
IF NOT EXIST .venv (
    echo [*] Vytvářím virtuální prostředí .venv...
    python -m venv .venv
)

REM Aktivace virtuálního prostředí
call .venv\Scripts\activate

REM Kontrola Flasku
pip show flask >nul 2>&1
IF ERRORLEVEL 1 (
    echo [*] Flask není nainstalovaný. Instaluji...
    pip install flask
)

REM Spuštění serveru
set FLASK_APP=app.py
set FLASK_ENV=development
flask run

pause
