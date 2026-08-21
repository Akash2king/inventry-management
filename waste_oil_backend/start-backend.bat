@echo off
setlocal EnableExtensions
cd /d "%~dp0" || exit /b 1

rem Install venv + deps, pick DB (menu), ask seed y/n, migrate, run Django.
rem Interactive prompts: DB profile → bind address → seed y/n
rem Usage:
rem   start-backend.bat
rem   start-backend.bat local
rem   start-backend.bat cloud 0.0.0.0:8000
rem   start-backend.bat --seed
rem   start-backend.bat --no-seed
rem   start-backend.bat --install-only

set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY (
  echo Python 3 not found. Install from https://www.python.org/downloads/
  echo Enable "Add python.exe to PATH", then re-open this terminal.
  pause
  exit /b 1
)

%PY% scripts\bootstrap_backend.py %*
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" pause
exit /b %ERR%
