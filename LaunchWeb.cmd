@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\launch-web.ps1" %*
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo LaunchWeb failed with exit code %EXITCODE%.
  echo If you installed Node via a terminal-only tool like nvm/fnm, add Node/npm to your system PATH.
  pause
)
exit /b %EXITCODE%
