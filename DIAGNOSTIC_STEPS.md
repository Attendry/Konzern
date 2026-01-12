# Diagnostic Steps for Timeout Issues

## Step 1: Verify Backend is Running

### Check if backend process is running:

**Windows PowerShell:**
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*Konzern*"}
```

**Or check port 3000:**
```powershell
Test-NetConnection -ComputerName localhost -Port 3000
```

**Expected:** Should show port is open/listening

### If backend is NOT running:

1. Open a new terminal
2. Navigate to backend directory:
   ```bash
   cd backend
   ```
3. Start the backend:
   ```bash
   npm run start:dev
   ```

4. **Watch for these in the output:**
   ```
   ✅ Supabase Client erfolgreich erstellt
   ✅ Supabase-Verbindungstest erfolgreich (XXXms)
   ✅ API listening on http://localhost:3000/api
   ```

5. **If you see warnings:**
   - `⚠️ WARNING: Missing Supabase configuration` → Check `.env.local`
   - `⚠️ Supabase-Verbindungstest fehlgeschlagen` → Check Supabase connection

---

## Step 2: Test Backend Directly (Bypass Frontend)

### Test Health Endpoint:

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -Method GET
```

**Or using curl (if available):**
```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-XX...",
  "uptime": 123.45
}
```

**If this fails:**
- Backend is not running → Go to Step 1
- Connection refused → Backend not listening on port 3000
- Timeout → Backend is hanging

---

### Test Companies Endpoint:

**Windows PowerShell:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/companies" -Method GET
```

**Or using curl:**
```bash
curl http://localhost:3000/api/companies
```

**Expected:**
- If successful: JSON array (may be empty `[]`)
- If error: Error message with status code

**Watch backend console** while making this request. You should see:
```
GET /api/companies - Request received
[CompanyService] findAll() - Starting database query
[CompanyService] findAll() - Database query completed in XXXms
```

**If you see the request but it hangs:**
- The Supabase query is taking too long
- Check Supabase connection
- Check network connectivity

---

## Step 3: Check Backend Logs

### While backend is running, look for:

1. **Startup logs:**
   ```
   === Supabase Configuration ===
   Supabase_Public: [shows first 20 chars]...
   Supabase_Secret: [shows first 20 chars]...
   Supabase URL: https://[your-project].supabase.co
   ✅ Supabase Client erfolgreich erstellt
   ```

2. **Request logs when you make a request:**
   ```
   GET /api/companies - Request received
   [CompanyService] findAll() - Starting database query
   ```

3. **Error logs:**
   - Any red error messages
   - Stack traces
   - Supabase connection errors

---

## Step 4: Test Supabase Connection Directly

### Run the connection test script:

```bash
cd backend
node test-supabase-connection.ts
```

**Expected Output:**
```
1. Teste Verbindung zu Supabase...
✅ Verbindung erfolgreich!
✅ "companies" Tabelle existiert

2. Teste Lesen von Unternehmen...
✅ X Unternehmen gefunden

3. Teste Erstellen eines Unternehmens...
✅ Test-Unternehmen erfolgreich erstellt: [uuid]
✅ Test-Unternehmen wieder gelöscht

✅ Alle Tests erfolgreich! Supabase ist korrekt konfiguriert.
```

**If this fails:**
- Check `.env.local` configuration
- Verify Supabase credentials are correct
- Check network connectivity to Supabase

---

## Step 5: Check Vite Proxy

### Verify Vite is proxying correctly:

1. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. Check Vite startup logs for:
   ```
   ➜  Local:   http://localhost:5173/
   ➜  Network: use --host to expose
   ```

3. In browser, open DevTools (F12) → Network tab
4. Make a request (e.g., load Company Management page)
5. Look for the request to `/api/companies`

**Check:**
- Request URL should be: `http://localhost:5173/api/companies`
- Status should be 200 (if backend responds) or timeout (if backend doesn't respond)
- If you see CORS errors, the proxy isn't working

---

## Step 6: Common Issues and Solutions

### Issue: Backend starts but requests timeout

**Possible causes:**
1. Supabase query is hanging
2. Network issue to Supabase
3. Backend is stuck in a loop

**Solution:**
- Check backend logs for the specific request
- Test Supabase connection directly (Step 4)
- Check if Supabase is reachable from your network

### Issue: Backend doesn't start

**Possible causes:**
1. Port 3000 is already in use
2. Missing dependencies
3. Configuration error

**Solution:**
```bash
# Check what's using port 3000 (Windows)
netstat -ano | findstr :3000

# Kill the process if needed (replace PID with actual process ID)
taskkill /PID [PID] /F

# Then restart backend
cd backend
npm run start:dev
```

### Issue: Vite proxy not working

**Possible causes:**
1. Vite config incorrect
2. Frontend not using relative URL

**Solution:**
- Verify `vite.config.ts` has proxy configuration
- Verify `api.ts` uses `/api` in dev mode (not absolute URL)
- Restart Vite dev server

### Issue: CORS errors

**Possible causes:**
1. Frontend using absolute URL instead of relative
2. Backend CORS config incorrect

**Solution:**
- Frontend should use `/api` (relative) in dev mode
- Backend CORS should allow `http://localhost:5173`
- Check `backend/src/main.ts` CORS configuration

---

## Step 7: Quick Test Script

Create a test file `test-backend.ps1` in project root:

```powershell
# Test Backend Connectivity
Write-Host "Testing Backend Connection..." -ForegroundColor Cyan

# Test Health Endpoint
Write-Host "`n1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Health endpoint OK: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health endpoint FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Backend is likely not running or not responding" -ForegroundColor Yellow
    exit 1
}

# Test Companies Endpoint
Write-Host "`n2. Testing Companies Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/companies" -Method GET -TimeoutSec 10
    Write-Host "✅ Companies endpoint OK: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   Found $($data.Count) companies" -ForegroundColor Gray
} catch {
    Write-Host "❌ Companies endpoint FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Message -like "*timeout*") {
        Write-Host "   Backend is running but query is timing out" -ForegroundColor Yellow
        Write-Host "   Check backend logs and Supabase connection" -ForegroundColor Yellow
    }
}

Write-Host "`n✅ Diagnostic complete!" -ForegroundColor Green
```

Run it:
```powershell
.\test-backend.ps1
```

---

## What to Check Next

Based on the diagnostic results:

1. **If health endpoint works but companies endpoint times out:**
   - The issue is with the Supabase query
   - Check Supabase connection
   - Check backend logs for the specific query

2. **If both endpoints timeout:**
   - Backend might be hanging on startup
   - Check backend logs for errors
   - Verify Supabase configuration

3. **If health endpoint fails:**
   - Backend is not running or not listening
   - Start the backend
   - Check for port conflicts

4. **If everything works via direct API but fails from frontend:**
   - Vite proxy issue
   - Check Vite configuration
   - Restart Vite dev server

---

**Next Steps:** Run the diagnostic steps above and share the results to identify the specific issue.
