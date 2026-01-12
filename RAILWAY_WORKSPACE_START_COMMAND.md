# Fix Railway Start Command for Monorepo

## Current Issue

Railway is using:
```
npm run start --workspace=konzern-backend
```

This runs `nest start` (development mode), which causes SIGTERM errors. It should use the production command instead.

## Solution: Update Start Command

### Option 1: Use Production Command with Workspace (Recommended)

Since Railway is running from the root directory (monorepo), use:

**Start Command:**
```
npm run start:prod --workspace=konzern-backend
```

This will run `node dist/main` in production mode.

### Option 2: Set Root Directory to `backend`

If Railway allows setting the root directory to `backend`:

1. Railway Dashboard → `konzern-backend` → **Settings** tab
2. Find **Root Directory**
3. Set to: `backend`
4. Then **Start Command** can be: `npm run start:prod`

## How to Update in Railway

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Scroll to **Build & Deploy** section
3. Find **Start Command**
4. Change from: `npm run start --workspace=konzern-backend`
5. Change to: `npm run start:prod --workspace=konzern-backend`
6. **Save** - Railway will redeploy

## Verify After Redeploy

Check Railway logs. You should see:
- ✅ `✅ API listening on http://...`
- ✅ No more `SIGTERM` errors
- ✅ Backend starts successfully

## Alternative: Check Root Directory Setting

If Railway has **Root Directory** set to `backend`:
- **Start Command** can be: `npm run start:prod` (no workspace flag needed)

If Railway has **Root Directory** set to root (`.`):
- **Start Command** must be: `npm run start:prod --workspace=konzern-backend`

## Summary

**Current (Wrong):**
```
npm run start --workspace=konzern-backend  ❌ (development mode)
```

**Should be:**
```
npm run start:prod --workspace=konzern-backend  ✅ (production mode)
```
