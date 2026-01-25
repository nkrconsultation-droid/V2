# Karratha WTP Simulator - PowerShell Launch Script
# Run this script to start the development server

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Karratha WTP Simulator - Version 15           " -ForegroundColor Cyan
Write-Host "  Equipment: SACOR Delta-Canter 20-843A         " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to the project directory
Push-Location $PSScriptRoot\karratha-wtp-simulator

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies (first time setup)..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Start the dev server
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host "App will open at: http://localhost:5173" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

npm run dev

# Return to original directory when done
Pop-Location
