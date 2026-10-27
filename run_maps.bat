@echo off
cd /d "%~dp0"
py -3 --version >nul 2>nul
if not errorlevel 1 (
  py -3 tools\launch_tools.py maps
  goto done
)
python --version >nul 2>nul
if errorlevel 1 (
  echo Install Python 3 from python.org and enable Add Python to PATH.
  pause
  exit /b 1
)
python tools\launch_tools.py maps
:done
if errorlevel 1 pause
