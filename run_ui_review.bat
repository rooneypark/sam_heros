@echo off
cd /d "%~dp0"
py -3 --version >nul 2>nul
if not errorlevel 1 (
  py -3 tools\launch_tools.py ui
  goto done
)
python tools\launch_tools.py ui
:done
if errorlevel 1 pause
