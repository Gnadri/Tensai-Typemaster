@echo off
setlocal
title Tensai TypeMaster - Extension Watch Build

cd /d "%~dp0"

echo ==========================================
echo Tensai TypeMaster - Extension Watch Build
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install Node.js ^(LTS^) and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] node_modules not found. Running npm install once...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
  echo.
)

echo [INFO] Starting extension watch build...
echo [INFO] Leave this window open while editing App.tsx.
echo [INFO] Reload the extension in chrome://extensions after changes rebuild.
echo.

call npm run dev:extension

echo.
echo [INFO] Watch process ended.
pause

