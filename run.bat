@echo off
REM Karratha WTP Simulator - Windows Launch Script
REM Double-click this file to start the development server

echo ========================================
echo   Karratha WTP Simulator - Version 13
echo ========================================
echo.

cd /d "%~dp0karratha-wtp-simulator"

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies (first time setup)...
    call npm install
    echo.
)

echo Starting development server...
echo App will open at: http://localhost:5173
echo Press Ctrl+C to stop the server
echo.

call npm run dev

pause
