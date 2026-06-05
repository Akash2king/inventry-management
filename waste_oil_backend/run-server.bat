@echo off
setlocal EnableExtensions
cd /d "%~dp0" || exit /b 1

if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
) else (
  echo.
  echo [run-server.bat] No .venv found. Create it:
  echo   python -m venv .venv
  echo   .venv\Scripts\activate.bat
  echo   pip install -r requirements\dev.txt
  echo.
  pause
  exit /b 1
)

echo.
echo Starting Django at http://0.0.0.0:8000  (Ctrl+C to stop^)
echo.
python manage.py runserver 0.0.0.0:8000
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" pause
exit /b %ERR%
