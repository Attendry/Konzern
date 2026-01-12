# Troubleshoot CORS Issues

## Current Problem

You're seeing CORS errors even after setting `ALLOWED_ORIGINS`. The errors show:
- Origin: `https://konzern-2e9bir9ey-attendry.vercel.app`
- Error: `No 'Access-Control-Allow-Origin' header is present`
- Also seeing: `ERR_FAILED` (backend might not be responding)

## Step 1: Check if Backend is Running

The `ERR_FAILED` error suggests the backend might not be running or reachable.

**Check Railway:**
1. Railway Dashboard → `konzern-backend` → **Deployments** tab
2. Is the latest deployment **successful** (green checkmark)?
3. If not, check the **Logs** tab for errors

**Test Backend Directly:**
Open in browser or run in terminal:
```bash
curl https://konzern-backend-production.up.railway.app/api/health
```

If this fails, the backend is not running. Check Railway logs for startup errors.

## Step 2: Check Railway Logs for CORS Messages

1. Railway Dashboard → `konzern-backend` → **Logs** tab
2. Look for CORS-related messages:
   - `CORS Configuration:` (should show NODE_ENV and ALLOWED_ORIGINS)
   - `CORS Check: origin=...` (should show each request)
   - `CORS: ✅ Allowing origin:` or `CORS: ❌ Blocking origin:`

**What to look for:**
- If you see `CORS: ❌ Blocking origin`, the origin check is failing
- If you DON'T see any CORS logs, the backend might not be receiving requests

## Step 3: Verify ALLOWED_ORIGINS in Railway

1. Railway Dashboard → `konzern-backend` → **Variables** tab
2. Check `ALLOWED_ORIGINS`:
   - Should be: `https://konzern-git-master-attendry.vercel.app,http://localhost:5173`
   - **NO trailing slash** on URLs
   - **NO spaces** (or spaces are OK, code trims them)

3. Check `NODE_ENV`:
   - Should be: `production` (for production)
   - If set to `development`, all origins are allowed (good for testing)

## Step 4: Verify Backend Has New Code

The backend needs the latest code that auto-allows `*.vercel.app` domains.

**Check if Railway has latest code:**
1. Railway Dashboard → `konzern-backend` → **Deployments** tab
2. Check the latest deployment timestamp
3. Compare with when you last pushed to GitHub
4. If Railway hasn't deployed recently, manually trigger a redeploy

**Manually Redeploy:**
1. Railway Dashboard → `konzern-backend` → **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Wait for deployment to complete

## Step 5: Test CORS Directly

**In browser console (on your Vercel site), run:**
```javascript
fetch('https://konzern-backend-production.up.railway.app/api/companies', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Headers:', [...r.headers.entries()]);
  return r.json();
})
.then(data => console.log('Data:', data))
.catch(err => console.error('Error:', err));
```

**Check the response:**
- If you see CORS error → Backend is running but blocking
- If you see `ERR_FAILED` → Backend is not running or not reachable
- If you see data → CORS is working!

## Step 6: Temporary Fix - Allow All Origins (Testing Only)

**⚠️ Only for testing - NOT for production!**

To test if CORS is the issue:

1. Railway Dashboard → `konzern-backend` → **Variables** tab
2. Set `NODE_ENV` = `development`
3. Save and wait for redeploy
4. Test your frontend

**If this fixes it:**
- CORS was the issue
- Set `NODE_ENV` back to `production`
- Fix `ALLOWED_ORIGINS` (see Step 3)

**If this doesn't fix it:**
- Backend might not be running
- Check Railway logs for errors

## Step 7: Check Railway Logs After Request

1. Try loading your frontend
2. Immediately check Railway logs
3. Look for:
   - `CORS Configuration:` (should appear on startup)
   - `CORS Check: origin=...` (should appear for each request)
   - Any error messages

**If you see CORS logs:**
- Backend is receiving requests
- Check if origin is being allowed or blocked

**If you DON'T see CORS logs:**
- Backend might not be receiving requests
- Check if backend is running
- Check Railway networking settings

## Common Issues

### Backend Not Running
- Check Railway deployments - is latest deployment successful?
- Check Railway logs for startup errors
- Verify environment variables are set (SUPABASE_URL, etc.)

### CORS Still Blocking
- Verify `ALLOWED_ORIGINS` has no trailing slashes
- Verify `NODE_ENV` is set correctly
- Check Railway logs for CORS messages
- Make sure backend has latest code (redeploy)

### ERR_FAILED / No Response
- Backend might be down
- Railway service might be paused
- Check Railway status page
- Verify Railway service is active

## Quick Checklist

- [ ] Backend deployment is successful (green checkmark)
- [ ] `ALLOWED_ORIGINS` is set (no trailing slashes)
- [ ] `NODE_ENV` is set to `production` (or `development` for testing)
- [ ] Backend has been redeployed after setting variables
- [ ] Railway logs show CORS configuration on startup
- [ ] Railway logs show CORS checks for requests
- [ ] Backend health endpoint responds: `/api/health`
