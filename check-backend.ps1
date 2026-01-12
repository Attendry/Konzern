# PowerShell Script zum Prüfen des Backend-Status
# Führt aus: .\check-backend.ps1

Write-Host "=== Backend Status Check ===" -ForegroundColor Cyan

# Prüfe ob Port 3000 offen ist
Write-Host "`n1. Prüfe Port 3000..." -ForegroundColor Yellow
$portCheck = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($portCheck) {
    Write-Host "   ✅ Port 3000 ist offen" -ForegroundColor Green
} else {
    Write-Host "   ❌ Port 3000 ist geschlossen - Backend läuft nicht" -ForegroundColor Red
    Write-Host "   Starten Sie das Backend mit: cd backend && npm run start:dev" -ForegroundColor Yellow
    exit 1
}

# Prüfe Health-Check
Write-Host "`n2. Prüfe Health-Check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -Method GET -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Health-Check erfolgreich" -ForegroundColor Green
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "   Status: $($healthData.status)" -ForegroundColor Green
        Write-Host "   Uptime: $([math]::Round($healthData.uptime, 2)) Sekunden" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Health-Check antwortet mit Status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Health-Check fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Backend läuft möglicherweise nicht oder ist nicht erreichbar" -ForegroundColor Red
}

# Prüfe Companies-Endpoint
Write-Host "`n3. Prüfe Companies-Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/companies" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Companies-Endpoint antwortet" -ForegroundColor Green
        $companies = $response.Content | ConvertFrom-Json
        Write-Host "   Anzahl Unternehmen: $($companies.Count)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Companies-Endpoint antwortet mit Status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Companies-Endpoint fehlgeschlagen: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Message -like "*timeout*") {
        Write-Host "   ⚠️  Möglicherweise hängt das Backend bei Supabase-Verbindung" -ForegroundColor Yellow
        Write-Host "   Prüfen Sie die Backend-Logs und Supabase-Konfiguration" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Check abgeschlossen ===" -ForegroundColor Cyan
