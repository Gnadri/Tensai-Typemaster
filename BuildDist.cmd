@echo off
setlocal

set "ROOT_DIR=%~dp0"
pushd "%ROOT_DIR%" >nul

echo [BuildDist] Repo: %CD%

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [BuildDist] npm.cmd not found on PATH.
  echo [BuildDist] Install Node.js or add npm to PATH.
  popd >nul
  exit /b 1
)

if exist dist (
  echo [BuildDist] Cleaning dist...
  rmdir /s /q dist
)

echo [BuildDist] Building extension bundles and dist files...
call npm run build:extension
if errorlevel 1 (
  echo [BuildDist] Build failed.
  popd >nul
  exit /b 1
)

echo [BuildDist] Build complete.
echo [BuildDist] Source manifest version:
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$m = Get-Content 'extension\\manifest.json' | ConvertFrom-Json; Write-Host ('  ' + $m.version)"

echo [BuildDist] Dist manifest version:
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$m = Get-Content 'dist\\manifest.json' | ConvertFrom-Json; Write-Host ('  ' + $m.version)"

echo [BuildDist] Dist bundle timestamps:
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-Item 'dist\\quiz.bundle.js','dist\\popup.bundle.js' | Select-Object Name, LastWriteTime | Format-Table -AutoSize"

echo [BuildDist] Reload the unpacked extension in chrome://extensions and reopen any existing quiz tabs.

popd >nul
exit /b 0
