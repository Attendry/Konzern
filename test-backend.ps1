# Test Backend Connectivity
# Backend port can be overridden via $env:PORT or defaults to 3000
$backendPort = if ($env:PORT) { $env:PORT } else { 3000 }
$backendUrl = "http://localhost:$backendPort"

Write-Host "Testing Backend Connection..." -ForegroundColor Cyan
Write-Host "Backend URL: $backendUrl" -ForegroundColor Gray

# Test Health Endpoint
Write-Host "`n1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/health" -Method GET -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Health endpoint OK: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health endpoint FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Backend is likely not running or not responding" -ForegroundColor Yellow
    Write-Host "   Please start the backend: cd backend && npm run start:dev" -ForegroundColor Yellow
    exit 1
}

# Test Companies Endpoint
Write-Host "`n2. Testing Companies Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/companies" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ Companies endpoint OK: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   Found $($data.Count) companies" -ForegroundColor Gray
} catch {
    Write-Host "❌ Companies endpoint FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Message -like "*timeout*") {
        Write-Host "   Backend is running but query is timing out" -ForegroundColor Yellow
        Write-Host "   This suggests the Supabase query is hanging" -ForegroundColor Yellow
        Write-Host "   Check backend logs and Supabase connection" -ForegroundColor Yellow
    } elseif ($_.Exception.Message -like "*refused*") {
        Write-Host "   Connection refused - backend might not be running" -ForegroundColor Yellow
    } elseif ($_.Exception.Message -like "*500*" -or $_.Exception.Response.StatusCode -eq 500) {
        Write-Host "   Server error (500) - backend is running but there's an internal error" -ForegroundColor Yellow
        Write-Host "   Check backend logs for database connection or query errors" -ForegroundColor Yellow
    }
}

Write-Host "`n✅ Diagnostic complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Check backend console for error messages" -ForegroundColor White
Write-Host "2. Verify Supabase connection: cd backend && node test-supabase-connection.ts" -ForegroundColor White
Write-Host "3. Check backend logs for the specific request" -ForegroundColor White
