# Debug 405 Error: Method Not Allowed

## Step 1: Check Browser Console

When you try to save a company, open browser console (F12) and look for:

1. **The exact URL being called:**
   - Should see: `[API] POST https://konzern-backend-production.up.railway.app/api/companies`
   - Or: `[API] PATCH https://konzern-backend-production.up.railway.app/api/companies/...`

2. **The error details:**
   - Click on the error in console
   - Check the "Network" tab
   - Look at the failed request
   - What's the exact URL?
   - What's the response status and message?

## Step 2: Check Railway Logs

1. Go to Railway Dashboard → `konzern-backend` → **Logs** tab
2. Try creating a company from frontend
3. Look for:
   - `POST /api/companies - Request received` (if you see this, request reached backend)
   - CORS messages
   - Any error messages

**If you DON'T see `POST /api/companies - Request received`:**
- The request isn't reaching the backend
- Could be Railway blocking it
- Could be URL/routing issue

**If you DO see the request in logs:**
- The backend received it but rejected it
- Check for CORS errors in logs

## Step 3: Test Endpoint Directly

Test if the backend accepts POST requests:

**In browser console, run:**
```javascript
fetch('https://konzern-backend-production.up.railway.app/api/companies', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test Company', isConsolidated: true })
})
.then(r => {
  console.log('Status:', r.status);
  return r.text();
})
.then(text => {
  console.log('Response:', text);
})
.catch(err => console.error('Error:', err));
```

**What to check:**
- If you get 405 → Backend is blocking POST
- If you get CORS error → CORS configuration issue
- If you get 200/201 → Backend works, issue is in frontend

## Step 4: Verify Environment Variables

In Railway → Variables, verify:
- ✅ `ALLOWED_ORIGINS` exists
- ✅ Value is: `https://your-vercel-app.vercel.app,http://localhost:5173`
- ✅ No extra quotes or spaces
- ✅ Backend has been redeployed AFTER setting the variable

## Step 5: Check Railway Service Configuration

1. Railway → `konzern-backend` → Settings
2. Check:
   - **Root Directory:** Should be `backend` (or empty if service is at root)
   - **Start Command:** Should be `npm run start:prod` or `node dist/main`
   - **Port:** Should be set or auto-assigned

## Common Causes

### 1. Backend Not Redeployed
- Environment variables only apply to NEW deployments
- Must redeploy after adding `ALLOWED_ORIGINS`

### 2. Wrong Vercel URL in ALLOWED_ORIGINS
- Must match exactly (including https://)
- No trailing slash
- Check your actual Vercel deployment URL

### 3. Railway Blocking Methods
- Some Railway configurations block certain HTTP methods
- Check Railway service settings

### 4. Route Not Matching
- Check if URL has double `/api/api` or missing `/api`
- Verify `VITE_API_URL` in Vercel is correct

## Quick Fix to Try

**Temporarily allow all origins (for testing only):**

In Railway, set:
- `NODE_ENV` = `development`

This will allow all origins. If this fixes it, then it's definitely a CORS issue and you need to set `ALLOWED_ORIGINS` correctly.

**Then set it back to:**
- `NODE_ENV` = `production`
- `ALLOWED_ORIGINS` = `https://your-vercel-app.vercel.app,http://localhost:5173`
