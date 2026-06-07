@echo off
cd /d "%~dp0"
setlocal

if not exist "dist\index.html" (
  echo Missing production build output in dist\
  echo Run the build script first: scripts\build-release.bat
  pause
  exit /b 1
)

if not exist "dist-electron\main.js" (
  echo Missing Electron main bundle in dist-electron\
  echo Run the build script first: scripts\build-release.bat
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron runtime not found in node_modules\
  echo Install dependencies before launching Deep Pet.
  pause
  exit /b 1
)

echo Launching Deep Pet...
start "" "node_modules\electron\dist\electron.exe" "."
echo Deep Pet should now be visible on your desktop.
endlocal
