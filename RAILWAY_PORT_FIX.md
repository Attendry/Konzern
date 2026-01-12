# Fix Railway Port Configuration

## Issue: 502 Bad Gateway / Application Failed to Respond

According to [Railway's documentation](https://docs.railway.com/reference/errors/application-failed-to-respond), this error occurs when:
1. The application is not listening on the correct host (`0.0.0.0`) or port
2. The **target port** in Railway settings doesn't match the port your app is listening on

## What We Fixed

✅ **Code fix:** Updated `backend/src/main.ts` to always listen on `0.0.0.0` (Railway requirement)

The backend now:
- Always listens on host `0.0.0.0` (required by Railway)
- Uses the `PORT` environment variable (Railway automatically injects this)

## What You Need to Check in Railway

### Step 1: Check Target Port Setting

1. **Railway Dashboard** → Go to your `konzern-backend` service
2. Click on **Settings** tab
3. Scroll to **Networking** or **Public Networking** section
4. Look for **Target Port** or **Port** setting
5. **Important:** This should match the `PORT` environment variable Railway is using

### Step 2: Verify PORT Environment Variable

1. **Railway Dashboard** → `konzern-backend` → **Variables** tab
2. Check if `PORT` is set:
   - **If `PORT` is set:** Note the value (e.g., `3000`, `8080`)
   - **If `PORT` is NOT set:** Railway auto-assigns one (usually shown in logs)

### Step 3: Match Target Port to PORT Variable

**Option A: If PORT is set to a specific value (e.g., `3000`)**
- Set **Target Port** in Railway settings to the same value (`3000`)

**Option B: If PORT is auto-assigned by Railway**
- Check Railway logs to see what port was assigned
- Set **Target Port** in Railway settings to match that port
- OR: Set `PORT` environment variable to a specific value (e.g., `3000`) and set Target Port to match

### Step 4: Recommended Configuration

**Set a fixed PORT:**
1. **Variables** tab → Add/Edit:
   - **Key:** `PORT`
   - **Value:** `3000` (or any port you prefer)
2. **Settings** tab → **Networking** → **Target Port:**
   - Set to: `3000` (same as PORT variable)

This ensures consistency between what your app listens on and what Railway expects.

## Verify After Fix

1. **Check Railway logs** - Should show:
   ```
   ✅ API listening on http://0.0.0.0:3000/api
   ```

2. **Test health endpoint:**
   ```
   https://konzern-backend-production.up.railway.app/api/health
   ```
   Should return: `{"status":"ok","timestamp":"...","uptime":...}`

3. **Test from frontend:**
   - CORS errors should be gone
   - API calls should work

## Common Issues

### Issue: Target Port is set but PORT env var is different
**Solution:** Make them match - either:
- Set `PORT` env var to match Target Port, OR
- Set Target Port to match `PORT` env var

### Issue: Target Port is not set
**Solution:** Railway might be using default. Check logs to see what port the app is listening on, then set Target Port to match.

### Issue: App is listening on wrong port
**Solution:** The code now always uses `process.env.PORT || 3000`, so ensure `PORT` is set correctly in Railway variables.

## Summary

✅ **Code is fixed** - Always listens on `0.0.0.0` and `PORT` env var
⚠️ **You need to check** - Railway Target Port setting must match `PORT` env var

After matching the ports, Railway should be able to route traffic to your backend correctly.
