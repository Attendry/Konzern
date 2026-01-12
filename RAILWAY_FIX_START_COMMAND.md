# Fix Railway Start Command and Node.js Version

## Current Issues

1. **Node.js 18** - Railway is still using Node.js 18, not 20
2. **Wrong Start Command** - Railway is running `nest start` (development) instead of production
3. **SIGTERM Errors** - Backend is crashing because of wrong start command

## Fix 1: Set Node.js 20 in Railway

### Method 1: Via Environment Variable (Recommended)

1. **Railway Dashboard** → `konzern-backend` → **Variables** tab
2. **Add New Variable:**
   - **Key:** `NODE_VERSION`
   - **Value:** `20`
3. **Save** - Railway will redeploy

### Method 2: Via Settings

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Scroll to **Build & Deploy** section
3. Find **Node Version** or **NODE_VERSION**
4. Set to: `20` or `latest`
5. **Save**

## Fix 2: Set Correct Start Command

Railway is currently running `nest start` (development mode), but it should run the production command.

### Option 1: Set Start Command in Railway (Recommended)

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Scroll to **Build & Deploy** section
3. Find **Start Command**
4. Set to: `npm run start:prod`
   - OR: `node dist/main`
5. **Save** - Railway will redeploy

### Option 2: Railway Auto-Detection

Railway should auto-detect from `package.json`, but if it doesn't, use Option 1.

## Complete Railway Configuration

After fixing, your Railway service should have:

**Environment Variables:**
- `NODE_VERSION` = `20`
- `ALLOWED_ORIGINS` = `https://konzern-git-master-attendry.vercel.app,http://localhost:5173`
- `SUPABASE_URL` = (your Supabase URL)
- `Supabase_Secret` = (your Supabase secret)
- `NODE_ENV` = `production`

**Build & Deploy Settings:**
- **Node Version:** `20`
- **Start Command:** `npm run start:prod`
- **Root Directory:** `backend` (if not set automatically)

## Verify After Redeploy

1. **Check Railway Logs:**
   - Should see: `Node.js version: v20.x.x` (not v18)
   - Should see: `✅ API listening on http://...`
   - Should NOT see: `⚠️ Node.js 18 and below are deprecated`
   - Should NOT see: `SIGTERM` errors

2. **Check Backend is Running:**
   - Open: `https://konzern-backend-production.up.railway.app/api/health`
   - Should return: `{"status":"ok"}`

3. **Check CORS:**
   - Railway logs should show: `CORS Configuration:` on startup
   - Should show: `CORS: ✅ Allowing origin: ...` for requests

## Troubleshooting

### Still Using Node.js 18?

1. Make sure `NODE_VERSION` environment variable is set to `20`
2. Make sure it's saved (not just typed)
3. Redeploy the service
4. Check logs - should show v20.x.x

### Still Getting SIGTERM?

1. Make sure **Start Command** is `npm run start:prod` (not `nest start`)
2. Make sure backend is built (`npm run build` should run during build phase)
3. Check Railway logs for build errors
4. Verify `dist/main.js` exists after build

### Backend Not Starting?

Check Railway logs for:
- Build errors
- Missing environment variables
- Port binding errors
- Database connection errors

## Summary

**To fix both issues:**
1. ✅ Set `NODE_VERSION` = `20` in Railway Variables
2. ✅ Set **Start Command** = `npm run start:prod` in Railway Settings
3. ✅ Redeploy
4. ✅ Verify Node.js 20 in logs
5. ✅ Verify backend starts successfully
