# This script launches the no-cache Python server
Write-Host "Starting Kiki-Islands No-Cache Server..." -ForegroundColor Cyan
Write-Host "Make sure you have Python installed." -ForegroundColor Yellow

python server.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start Python server. Is Python installed?" -ForegroundColor Red
    Pause
}
