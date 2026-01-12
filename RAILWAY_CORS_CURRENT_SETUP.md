# Current CORS Setup - Quick Check

## Your Current Setup

You have in Railway `ALLOWED_ORIGINS`:
```
https://konzern-git-master-attendry.vercel.app/
```

## Issues to Fix

### 1. Remove Trailing Slash

The trailing slash (`/`) at the end can cause issues. Update it to:
```
https://konzern-git-master-attendry.vercel.app
```

### 2. Add Localhost for Local Development

For local development, also add:
```
https://konzern-git-master-attendry.vercel.app,http://localhost:5173
```

## How to Update

1. **Go to Railway Dashboard:**
   - Railway → Your Project → `konzern-backend` → **Variables** tab

2. **Edit `ALLOWED_ORIGINS`:**
   - Click on `ALLOWED_ORIGINS` to edit
   - Change from: `https://konzern-git-master-attendry.vercel.app/`
   - Change to: `https://konzern-git-master-attendry.vercel.app,http://localhost:5173`
   - Remove the trailing slash
   - Add localhost for local dev

3. **Save:**
   - Railway will automatically redeploy

## What This Enables

With this setup, the backend will automatically allow:
- ✅ `https://konzern-git-master-attendry.vercel.app` (your current URL)
- ✅ `https://konzern-9lybj38pp-attendry.vercel.app` (preview - auto-allowed)
- ✅ `https://konzern-xyz123-abc456.vercel.app` (any preview - auto-allowed)
- ✅ `http://localhost:5173` (local development)

## After Redeploy

Once Railway redeploys with:
1. The updated `ALLOWED_ORIGINS` (no trailing slash)
2. The new code that auto-allows all `*.vercel.app` domains

All your Vercel preview deployments should work automatically! 🎉

## Verify It's Working

1. **Check Railway Logs:**
   - After redeploy, try accessing your frontend
   - Logs should show: `CORS: Allowing origin: https://konzern-9lybj38pp-attendry.vercel.app (Vercel preview)`

2. **Check Browser Console:**
   - Should no longer see CORS errors
   - API calls should succeed
