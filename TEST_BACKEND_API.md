# Test Backend API Endpoints

## Quick Test Commands

Test if your backend endpoints are working correctly:

### Test POST /api/companies

**Using curl (if you have it):**
```bash
curl -X POST https://konzern-backend-production.up.railway.app/api/companies \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Company","isConsolidated":true}'
```

**Using PowerShell:**
```powershell
Invoke-RestMethod -Uri "https://konzern-backend-production.up.railway.app/api/companies" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Test Company","isConsolidated":true}'
```

**Using browser console (JavaScript):**
```javascript
fetch('https://konzern-backend-production.up.railway.app/api/companies', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test Company', isConsolidated: true })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

### Test PATCH /api/companies/:id

Replace `COMPANY_ID` with an actual company ID:
```bash
curl -X PATCH https://konzern-backend-production.up.railway.app/api/companies/COMPANY_ID \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}'
```

## Check Railway Logs

1. Go to Railway Dashboard → `konzern-backend` → **Logs** tab
2. Try creating a company from the frontend
3. Look for:
   - `POST /api/companies - Request received` (should appear)
   - CORS messages
   - Any error messages

## Verify Environment Variables

In Railway → Variables, check:
- ✅ `ALLOWED_ORIGINS` is set
- ✅ Value includes your Vercel URL
- ✅ No extra spaces or quotes

## Check Browser Console

When you try to save a company, check the browser console for:
- The exact URL being called
- The HTTP method (POST or PATCH)
- The full error response
