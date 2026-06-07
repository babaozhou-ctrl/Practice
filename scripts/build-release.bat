@echo off
cd /d "%~dp0\.."
setlocal

set "NODE_BIN=node"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found in PATH.
  echo Install Node.js 18+ first, then rerun this script.
  pause
  exit /b 1
)

set "BUILD_MODE=%~1"
if "%BUILD_MODE%"=="" set "BUILD_MODE=build"

echo Running Deep Pet release pipeline in mode: %BUILD_MODE%
%NODE_BIN% scripts\build-release.mjs --mode=%BUILD_MODE%
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Build pipeline failed with exit code %EXIT_CODE%.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Deep Pet pipeline finished successfully.
if /I "%BUILD_MODE%"=="dist" (
  echo Installer output should now be under the release\ directory.
)
endlocal
