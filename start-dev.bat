@echo off
cd /d "%~dp0"
setlocal

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron runtime not found in node_modules\
  echo Install dependencies before launching dev mode.
  pause
  exit /b 1
)

echo Starting Deep Pet development runtime...
echo This expects a separate Vite dev server if you are using hot reload.
start "" "node_modules\electron\dist\electron.exe" "." --dev --remote-debugging-port=9222
echo Remote debugging is available at http://localhost:9222
endlocal
