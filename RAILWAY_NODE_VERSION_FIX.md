# Fix Node.js Version in Railway

## The Problem

Railway is using Node.js 18, but Supabase requires Node.js 20 or later. This causes:
- ⚠️ Deprecation warnings from Supabase
- Potential compatibility issues
- SIGTERM errors (process termination)

## Solution: Set Node.js 20 in Railway

### Method 1: Using .nvmrc File (Automatic)

I've created a `.nvmrc` file in the `backend/` directory that specifies Node.js 20. Railway should automatically detect this.

**File created:** `backend/.nvmrc`
```
20
```

### Method 2: Set in Railway Dashboard (Manual)

If Railway doesn't auto-detect `.nvmrc`, set it manually:

1. **Go to Railway Dashboard:**
   - Railway → Your Project → `konzern-backend` service

2. **Go to Settings:**
   - Click **Settings** tab
   - Scroll to **Build & Deploy** section

3. **Set Node.js Version:**
   - Look for **"Node Version"** or **"NODE_VERSION"** setting
   - Set to: `20` or `20.x` or `latest`
   - Save

### Method 3: Set via Environment Variable

1. **Go to Variables:**
   - Railway → `konzern-backend` → **Variables** tab

2. **Add Environment Variable:**
   - **Key:** `NODE_VERSION`
   - **Value:** `20`
   - Click **Add**

3. **Redeploy:**
   - Railway will automatically redeploy with Node.js 20

## Verify Node.js Version

After redeploying, check Railway logs. You should see:
```
Node.js version: v20.x.x
```

Instead of:
```
Node.js version: v18.x.x
```

## What I've Done

1. ✅ Created `backend/.nvmrc` with Node.js 20
2. ✅ Added `engines` field to `package.json` specifying Node.js >=20.0.0

## Next Steps

1. **Push the changes** (I'll do this)
2. **Railway should auto-detect** the `.nvmrc` file and use Node.js 20
3. **If not, manually set** Node.js version in Railway settings
4. **Redeploy** the backend
5. **Check logs** to verify Node.js 20 is being used

## Troubleshooting

### Railway Still Using Node.js 18?

1. **Check Railway Settings:**
   - Settings → Build & Deploy → Node Version
   - Make sure it's set to 20 or latest

2. **Set NODE_VERSION Environment Variable:**
   - Variables tab → Add `NODE_VERSION` = `20`
   - Redeploy

3. **Check Railway Logs:**
   - Look for Node.js version in build logs
   - Should show v20.x.x, not v18.x.x

### Still Getting SIGTERM Errors?

SIGTERM (process termination) can be caused by:
1. **Node.js version mismatch** - Fixed by upgrading to Node.js 20
2. **Memory limits** - Check Railway service limits
3. **Startup errors** - Check Railway logs for errors before SIGTERM

After upgrading to Node.js 20, the SIGTERM errors should stop if they were caused by the version mismatch.

## Summary

**To fix:**
1. ✅ `.nvmrc` file created (auto-detected by Railway)
2. ✅ `package.json` engines field added
3. ⚠️ **You may need to manually set Node.js 20 in Railway settings**
4. ⚠️ **Redeploy after setting Node.js version**
