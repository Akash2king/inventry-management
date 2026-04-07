@echo off
setlocal EnableExtensions
REM Portable Django dev server launcher for Windows.
REM Place this file in waste_oil_backend (same folder as manage.py). Double-click or run from cmd.

cd /d "%~dp0" || exit /b 1

@REM if exist ".venv\Scripts\activate.bat" (
@REM   call "%~dp0.venv\Scripts\activate.bat"
@REM ) else if exist "venv\Scripts\activate.bat" (
@REM   call "%~dp0venv\Scripts\activate.bat"
@REM ) else if exist "env\Scripts\activate.bat" (
@REM   call "%~dp0env\Scripts\activate.bat"
@REM ) else (
@REM   echo.
@REM   echo [run-server.bat] No virtual environment found next to manage.py.
@REM   echo Create one, then run this again:
@REM   echo   python -m venv .venv
@REM   echo   .venv\Scripts\activate.bat
@REM   echo   pip install -r requirements\dev.txt
@REM   echo.
@REM   pause
@REM   exit /b 1
@REM )

echo.
echo Starting Django at http://0.0.0.0:8000  (Ctrl+C to stop^)
echo.
python manage.py runserver 0.0.0.0:8000
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" pause
exit /b %ERR%
