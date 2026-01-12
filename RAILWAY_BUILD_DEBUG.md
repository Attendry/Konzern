# Fix Railway Build - dist/main Not Found

## The Problem

Railway is looking for `/app/dist/main` but it doesn't exist. This means the build didn't complete successfully.

## Check Build Logs First

Before fixing, check what's happening during the build:

1. **Railway Dashboard** → `konzern-backend` → **Deployments** tab
2. Click on the latest deployment
3. Look at the **Build** phase logs
4. Check for:
   - Does `npm install` complete?
   - Does `npm run build` run?
   - Does `nest build` complete?
   - Any TypeScript compilation errors?
   - Any missing dependencies?

## Solution: Ensure Build Completes

### Option 1: Verify Build Command (Root Directory = `backend`)

If Root Directory is set to `backend`:

1. **Railway Dashboard** → `konzern-backend` → **Settings** tab
2. Find **Build Command**
3. Should be: `npm install && npm run build`
4. Make sure it's saved

### Option 2: Add Explicit Build Steps

Sometimes Railway needs more explicit commands:

**Build Command:**
```bash
npm ci --production=false && npm run build
```

This ensures:
- `npm ci` does a clean install (faster, more reliable)
- `--production=false` includes dev dependencies (needed for build)
- `npm run build` runs the NestJS build

### Option 3: Check if Build is Running

The build might be failing silently. Add verbose logging:

**Build Command:**
```bash
npm install && npm run build && ls -la dist/
```

The `ls -la dist/` will show if `dist/` directory exists and what's in it.

## Verify Build Output

After build completes, Railway should have:
- `dist/` directory
- `dist/main.js` file
- `dist/main.js.map` (source map)

If these don't exist, the build failed.

## Common Build Issues

### TypeScript Compilation Errors

Check Railway build logs for:
- Type errors
- Missing type definitions
- Import errors

### Missing Dependencies

If build fails with "Cannot find module", check:
- Are all dependencies in `package.json`?
- Is `npm install` completing successfully?
- Are dev dependencies installed? (needed for `@nestjs/cli`)

### Build Command Not Running

If you don't see `nest build` in logs:
- Check Build Command is set correctly
- Check Root Directory is set to `backend`
- Railway might be skipping build step

## Recommended Build Command

**For Root Directory = `backend`:**

```
npm ci --production=false && npm run build
```

**Or if npm ci doesn't work:**

```
npm install && npm run build
```

## Verify After Build

After build completes, check Railway logs for:
- ✅ `dist/` directory created
- ✅ `dist/main.js` exists
- ✅ No build errors

Then the start command should work:
- `npm run start:prod` → `node dist/main` → Should find the file

## Alternative: Check if Railway is Building

Railway might be:
1. **Skipping build** - Check if build phase runs at all
2. **Building in wrong directory** - Check Root Directory setting
3. **Build failing silently** - Check for errors in build logs

## Debug Steps

1. **Check Build Logs:**
   - Railway → Deployments → Latest → Build logs
   - Look for `nest build` output
   - Look for errors

2. **Verify Build Command:**
   - Settings → Build Command
   - Should be: `npm install && npm run build` (or `npm ci --production=false && npm run build`)

3. **Check Root Directory:**
   - Settings → Root Directory
   - Should be: `backend`

4. **Try Manual Build Test:**
   - If you can SSH into Railway, try running build manually
   - Or check if `dist/` exists after build

## Summary

**The issue:** `dist/main.js` doesn't exist because build didn't complete.

**Fix:**
1. Check build logs for errors
2. Verify build command is correct
3. Ensure Root Directory = `backend`
4. Make sure `npm install` completes before `npm run build`
5. Check for TypeScript compilation errors

**Recommended Build Command:**
```
npm ci --production=false && npm run build
```

This ensures clean install with dev dependencies, then builds the project.
