@echo off
setlocal
title Tensai TypeMaster - Clean Node Build Tools

cd /d "%~dp0"

echo ==========================================
echo Tensai TypeMaster - Clean Node Build Tools
echo ==========================================
echo.
echo This will remove local build tooling folders (node_modules).
echo It will NOT remove your source files or dist output.
echo.
set /p CONFIRM=Type YES to continue: 

if /I not "%CONFIRM%"=="YES" (
  echo.
  echo Cancelled.
  pause
  exit /b 0
)

if exist "node_modules" (
  echo.
  echo [INFO] Removing node_modules...
  rmdir /s /q "node_modules"
  if errorlevel 1 (
    echo [ERROR] Failed to remove node_modules. Close any terminals/editors using it and try again.
    pause
    exit /b 1
  )
) else (
  echo.
  echo [INFO] node_modules not found. Nothing to clean.
)

echo.
echo [DONE] Local Node build tools removed.
echo Your extension can still load from the repo root using the built files in dist.
pause

