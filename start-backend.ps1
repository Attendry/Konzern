# PowerShell Script zum Starten des Backends
# Führt aus: .\start-backend.ps1

Write-Host "=== Backend Start Script ===" -ForegroundColor Cyan

# Prüfe ob Node.js installiert ist
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js ist nicht installiert oder nicht im PATH" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js Version: $nodeVersion" -ForegroundColor Green

# Wechsle ins Backend-Verzeichnis
if (Test-Path "backend") {
    Set-Location backend
    Write-Host "✅ Wechsel ins Backend-Verzeichnis" -ForegroundColor Green
} else {
    Write-Host "❌ Backend-Verzeichnis nicht gefunden" -ForegroundColor Red
    exit 1
}

# Prüfe ob .env.local existiert
if (Test-Path ".env.local") {
    Write-Host "✅ .env.local gefunden" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env.local nicht gefunden" -ForegroundColor Yellow
    Write-Host "   Bitte erstellen Sie .env.local mit:" -ForegroundColor Yellow
    Write-Host "   SUPABASE_URL=https://[your-project-ref].supabase.co" -ForegroundColor Yellow
    Write-Host "   Supabase_Secret=[your-service-role-key]" -ForegroundColor Yellow
    Write-Host "   Supabase_Public=[your-anon-key]" -ForegroundColor Yellow
}

# Prüfe ob node_modules existiert
if (Test-Path "node_modules") {
    Write-Host "✅ node_modules gefunden" -ForegroundColor Green
} else {
    Write-Host "⚠️  node_modules nicht gefunden, installiere Dependencies..." -ForegroundColor Yellow
    npm install
}

# Starte das Backend
Write-Host "`n🚀 Starte Backend..." -ForegroundColor Cyan
Write-Host "   Backend wird auf http://localhost:3000/api laufen" -ForegroundColor Cyan
Write-Host "   Health-Check: http://localhost:3000/api/health" -ForegroundColor Cyan
Write-Host "`nDrücken Sie Ctrl+C zum Beenden`n" -ForegroundColor Yellow

npm run start:dev
