# Timeout Error Troubleshooting Guide

## Current Issue

Frontend requests to `/api/companies` are timing out after 30 seconds with error:
```
Request timeout - Der Server antwortet nicht. Bitte prüfen Sie, ob das Backend läuft.
```

## Immediate Diagnostic Steps

### 1. Check if Backend is Running

**Open a new terminal and run:**
```powershell
# Check if port 3000 is listening
Test-NetConnection -ComputerName localhost -Port 3000
```

**Or check for Node processes:**
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue
```

**If backend is NOT running:**
1. Open terminal in `backend/` directory
2. Run: `npm run start:dev`
3. Wait for: `✅ API listening on http://localhost:3000/api`
4. **Watch for errors** in the startup logs

---

### 2. Test Backend Directly (Bypass Frontend)

**Run the diagnostic script:**
```powershell
.\test-backend.ps1
```

**Or test manually:**

**Test Health Endpoint (fast, no database):**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -Method GET
```

**Expected:** Should return quickly with status 200

**If this fails:**
- Backend is not running → Start it
- Connection refused → Backend not listening on port 3000
- Check if another process is using port 3000

---

**Test Companies Endpoint:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/companies" -Method GET -TimeoutSec 35
```

**Watch the backend console** while making this request. You should see:
```
GET /api/companies - Request received
[CompanyService] findAll() - Starting database query
[CompanyService] findAll() - Database query completed in XXXms
```

**If you see the request but it hangs:**
- The Supabase query is taking too long or hanging
- Check Supabase connection (see Step 3)

**If you don't see the request:**
- Request isn't reaching the backend
- Check Vite proxy configuration
- Check network/firewall

---

### 3. Test Supabase Connection

**Run the connection test:**
```bash
cd backend
node test-supabase-connection.ts
```

**Expected output:**
```
✅ Verbindung erfolgreich!
✅ "companies" Tabelle existiert
✅ X Unternehmen gefunden
```

**If this fails:**
- Check `backend/.env.local` exists and has correct values
- Verify Supabase credentials
- Check network connectivity to Supabase

---

### 4. Check Backend Logs

**While backend is running, look for:**

1. **Startup logs:**
   ```
   === Supabase Configuration ===
   Supabase URL: https://[your-project].supabase.co
   ✅ Supabase Client erfolgreich erstellt
   ✅ Supabase-Verbindungstest erfolgreich
   ```

2. **When you make a request, you should see:**
   ```
   GET /api/companies - Request received
   [CompanyService] findAll() - Starting database query
   ```

3. **If query completes:**
   ```
   [CompanyService] findAll() - Database query completed in XXXms
   ```

4. **If query hangs:**
   - You'll see "Starting database query" but never see "completed"
   - This means Supabase query is hanging

---

## Common Causes and Solutions

### Cause 1: Backend Not Running

**Symptoms:**
- Health endpoint fails
- Connection refused errors
- No backend process running

**Solution:**
```bash
cd backend
npm run start:dev
```

Wait for: `✅ API listening on http://localhost:3000/api`

---

### Cause 2: Supabase Query Hanging

**Symptoms:**
- Health endpoint works
- Companies endpoint times out
- Backend logs show "Starting database query" but never "completed"
- Backend process is running but not responding

**Possible reasons:**
1. Supabase connection is slow/unreachable
2. Network issue to Supabase
3. Supabase query is actually hanging
4. Supabase credentials are incorrect (but connection test might still work)

**Solution:**
1. Test Supabase connection directly:
   ```bash
   cd backend
   node test-supabase-connection.ts
   ```

2. Check Supabase Dashboard:
   - Go to https://app.supabase.com
   - Check if project is active
   - Check API logs for errors

3. Try a simpler query:
   - Modify `findAll()` to remove the complex join
   - Test with just `select('*')` first

4. Check network:
   - Verify you can reach Supabase from your network
   - Check firewall/proxy settings

---

### Cause 3: Vite Proxy Not Working

**Symptoms:**
- Direct API calls work (via PowerShell/curl)
- Frontend requests timeout
- CORS errors in browser

**Solution:**
1. Verify Vite proxy config in `frontend/vite.config.ts`:
   ```typescript
   proxy: {
     '/api': {
       target: 'http://localhost:3000',
       changeOrigin: true,
     },
   }
   ```

2. Restart Vite dev server:
   ```bash
   cd frontend
   # Stop current server (Ctrl+C)
   npm run dev
   ```

3. Check browser Network tab:
   - Request should go to `http://localhost:5173/api/companies`
   - Should be proxied to `http://localhost:3000/api/companies`

---

### Cause 4: Port Conflict

**Symptoms:**
- Backend won't start
- "Port 3000 already in use" error
- Health endpoint fails

**Solution:**
```powershell
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID [PID] /F

# Restart backend
cd backend
npm run start:dev
```

---

## Quick Fix: Simplify the Query

If the Supabase query is hanging, try simplifying it temporarily:

**Edit `backend/src/modules/company/company.service.ts`:**

**Current (complex join):**
```typescript
.select(`
  *,
  parent_company:companies!companies_parent_company_id_fkey(*),
  children:companies!companies_parent_company_id_fkey(*)
`)
```

**Temporary simplified version:**
```typescript
.select('*')
```

This will help identify if the issue is with the complex join query.

---

## Step-by-Step Debugging

1. **Start Backend:**
   ```bash
   cd backend
   npm run start:dev
   ```
   Wait for: `✅ API listening on http://localhost:3000/api`

2. **Test Health Endpoint:**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/api/health"
   ```
   Should return quickly

3. **Test Companies Endpoint:**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/api/companies" -TimeoutSec 35
   ```
   Watch backend console for logs

4. **If Companies Endpoint Times Out:**
   - Check backend logs for the request
   - Test Supabase connection: `node test-supabase-connection.ts`
   - Try simplifying the query (see above)

5. **If Direct API Works but Frontend Doesn't:**
   - Check Vite proxy configuration
   - Restart Vite dev server
   - Check browser Network tab

---

## What to Share for Further Help

If issues persist, share:

1. **Backend startup logs** (first 20-30 lines)
2. **Backend logs when making request** (the specific request that times out)
3. **Result of:** `node test-supabase-connection.ts`
4. **Result of:** `.\test-backend.ps1`
5. **Browser console errors** (F12 → Console)
6. **Browser Network tab** (F12 → Network → look for the failing request)

---

## Expected Behavior

**When everything works:**

1. Backend starts:
   ```
   ✅ Supabase Client erfolgreich erstellt
   ✅ API listening on http://localhost:3000/api
   ```

2. Health endpoint responds in <100ms:
   ```json
   {"status":"ok","timestamp":"...","uptime":123.45}
   ```

3. Companies endpoint responds in <2s:
   ```json
   []
   ```
   or
   ```json
   [{"id":"...","name":"..."}]
   ```

4. Frontend loads companies without timeout

---

**If any of these fail, follow the troubleshooting steps above.**
