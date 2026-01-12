# Final Railway Configuration Fix

## Current Issues

1. **Node.js 18.20.8** - Railway is still using Node.js 18, not 20
2. **Build Failing** - `npm error Missing script: "build"` - Railway is running build from root, not backend workspace

## Complete Fix

### Step 1: Set Node.js 20 (CRITICAL)

Railway is still using Node.js 18. You MUST set it to 20:

1. **Railway Dashboard** → `konzern-backend` → **Variables** tab
2. **Add/Edit Variable:**
   - **Key:** `NODE_VERSION`
   - **Value:** `20`
3. **Save** - This is critical!

### Step 2: Fix Build Command

Railway is trying to run `npm run build` from the root directory, but the build script is in the `backend` workspace.

**Option A: Use Workspace Command (If Root Directory = `.`)**

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Scroll to **Build & Deploy** section
3. Find **Build Command**
4. Set to: `npm install && npm run build --workspace=konzern-backend`
5. **Save**

**Option B: Set Root Directory to `backend` (RECOMMENDED - Simpler)**

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Find **Root Directory**
3. Set to: `backend`
4. Then **Build Command** can be: `npm install && npm run build`
5. **Start Command** can be: `npm run start:prod`
6. **Save**

### Step 3: Verify Start Command

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Find **Start Command**
3. Should be:
   - If Root Directory = `.`: `npm run start:prod --workspace=konzern-backend`
   - If Root Directory = `backend`: `npm run start:prod`

## Recommended Configuration (Root Directory = `backend`)

This is the simplest and most reliable setup:

**Settings:**
- **Root Directory:** `backend`
- **Node Version:** `20` (via `NODE_VERSION` environment variable)
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:prod`

**Environment Variables:**
- `NODE_VERSION` = `20` ⚠️ **CRITICAL - Must be set!**
- `ALLOWED_ORIGINS` = `https://konzern-git-master-attendry.vercel.app,http://localhost:5173`
- `SUPABASE_URL` = (your Supabase URL)
- `Supabase_Secret` = (your Supabase secret)
- `NODE_ENV` = `production`

## Why Root Directory = `backend` is Better

1. ✅ Simpler commands (no workspace flags)
2. ✅ Railway auto-detects NestJS better
3. ✅ Build and start commands are straightforward
4. ✅ Less chance of configuration errors

## Step-by-Step: Complete Reset

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab

2. **Set Root Directory:**
   - Find **Root Directory**
   - Set to: `backend`
   - Save

3. **Set Build Command:**
   - Find **Build Command**
   - Set to: `npm install && npm run build`
   - Save

4. **Set Start Command:**
   - Find **Start Command**
   - Set to: `npm run start:prod`
   - Save

5. **Set Node.js Version:**
   - Go to **Variables** tab
   - Add/Edit: `NODE_VERSION` = `20`
   - Save

6. **Redeploy:**
   - Go to **Deployments** tab
   - Click **Redeploy** on latest deployment
   - Wait for completion

## Verify After Redeploy

Check Railway logs. You should see:

**Build Phase:**
- ✅ `Node.js version: v20.x.x` (NOT v18!)
- ✅ `npm install` completes
- ✅ `nest build` completes
- ✅ `dist/main.js` created

**Start Phase:**
- ✅ `node dist/main` (NOT `nest start`)
- ✅ `✅ API listening on http://...`
- ✅ No SIGTERM errors
- ✅ No Node.js version warnings

## Troubleshooting

### Still Using Node.js 18?

1. **Check `NODE_VERSION` variable:**
   - Variables tab → Make sure `NODE_VERSION` = `20` (not `18`)
   - Make sure it's saved (not just typed)

2. **Check Railway Settings:**
   - Settings → Build & Deploy → Node Version
   - Should be `20` or `latest`

3. **Force Redeploy:**
   - After setting `NODE_VERSION`, Railway should auto-redeploy
   - If not, manually trigger redeploy

### Build Still Failing?

1. **Check Root Directory:**
   - Should be `backend` (not `.` or empty)

2. **Check Build Command:**
   - If Root Directory = `backend`: `npm install && npm run build`
   - If Root Directory = `.`: `npm install && npm run build --workspace=konzern-backend`

3. **Check Build Logs:**
   - Look for TypeScript compilation errors
   - Look for missing dependencies

## Summary

**The key fixes:**
1. ✅ Set `NODE_VERSION` = `20` in Variables (CRITICAL!)
2. ✅ Set **Root Directory** = `backend` (simplest)
3. ✅ Set **Build Command** = `npm install && npm run build`
4. ✅ Set **Start Command** = `npm run start:prod`
5. ✅ Redeploy

After these changes, Railway should:
- Use Node.js 20 ✅
- Build successfully ✅
- Start in production mode ✅
- Accept CORS requests ✅
