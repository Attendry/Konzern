# Fix Railway Build and Start Commands

## Current Issue

Railway is still running `nest start` (development) instead of the production command. The error shows:
```
command sh -c nest start
```

This means Railway hasn't picked up the new start command, OR the build isn't completing, so `dist/main` doesn't exist.

## Solution: Set Both Build and Start Commands

### Step 1: Verify Build Command

Railway needs to build the backend before starting it. Check:

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Scroll to **Build & Deploy** section
3. Find **Build Command**
4. Should be: `npm run build --workspace=konzern-backend`
   - OR: `cd backend && npm install && npm run build`
   - OR: Railway might auto-detect this

### Step 2: Set Start Command

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Scroll to **Build & Deploy** section
3. Find **Start Command**
4. Set to: `npm run start:prod --workspace=konzern-backend`
   - This runs `node dist/main` (production mode)
5. **Save**

### Step 3: Verify Root Directory

Check if Railway has the correct root directory:

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Find **Root Directory**
3. Options:
   - **If set to root (`.`):** Use workspace commands (current setup)
   - **If set to `backend`:** Can use direct commands

## Alternative: Set Root Directory to `backend`

If Railway allows setting the root directory:

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Find **Root Directory**
3. Set to: `backend`
4. Then:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`
5. **Save**

This is simpler and avoids workspace commands.

## Complete Railway Configuration

### Option A: Root Directory = `.` (Monorepo)

**Build Command:**
```
npm run build --workspace=konzern-backend
```

**Start Command:**
```
npm run start:prod --workspace=konzern-backend
```

### Option B: Root Directory = `backend` (Recommended)

**Build Command:**
```
npm install && npm run build
```

**Start Command:**
```
npm run start:prod
```

## Verify Build is Working

Check Railway logs during build phase. You should see:
- `npm install` running
- `nest build` running
- `dist/main.js` created successfully
- No build errors

If build fails, `dist/main.js` won't exist, and `npm run start:prod` will fail.

## Troubleshooting

### Still Seeing `nest start` Error?

1. **Double-check Start Command:**
   - Make sure it's saved in Railway
   - Should be: `npm run start:prod --workspace=konzern-backend`
   - NOT: `npm run start --workspace=konzern-backend`

2. **Redeploy:**
   - After changing start command, Railway should auto-redeploy
   - OR manually trigger: Deployments → Redeploy

3. **Check Build Logs:**
   - Make sure build completes successfully
   - Look for: `dist/main.js` created

### Build Failing?

Check Railway build logs for:
- Missing dependencies
- TypeScript compilation errors
- Missing environment variables needed for build

### `dist/main.js` Not Found?

This means the build didn't complete. Check:
1. Build command is correct
2. Build completes without errors
3. `dist/` directory exists after build

## Quick Fix Checklist

- [ ] **NODE_VERSION** = `20` (in Variables)
- [ ] **Build Command** = `npm run build --workspace=konzern-backend` (or `cd backend && npm install && npm run build`)
- [ ] **Start Command** = `npm run start:prod --workspace=konzern-backend` (or `npm run start:prod` if root dir is `backend`)
- [ ] **Root Directory** = `.` (monorepo) OR `backend` (simpler)
- [ ] **Redeploy** after changes
- [ ] **Check logs** - should see `✅ API listening on...`

## Summary

**The key issue:** Railway is running `nest start` (dev) instead of `node dist/main` (prod).

**Fix:** Change Start Command to `npm run start:prod --workspace=konzern-backend`

**Also ensure:** Build Command completes successfully so `dist/main.js` exists.
