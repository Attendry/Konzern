# Fix for "npm ci" Error in Vercel

## The Problem

Vercel build fails with:
```
npm error The `npm ci` command can only install with an existing package-lock.json
```

## Root Cause

The `package-lock.json` exists in the repository, but Vercel's install command might be running from the wrong directory, or there's a mismatch between:
- `rootDirectory` setting in Vercel Dashboard
- `rootDirectory` in `vercel.json`
- Install command directory

## Solution

### Option 1: Verify Vercel Dashboard Settings (Recommended)

1. **Go to Vercel Dashboard:**
   - Your Project → Settings → General
   - Scroll to **Build & Development Settings**

2. **Check Root Directory:**
   - Should be set to: `frontend`
   - If empty or different, set it to `frontend`

3. **Check Install Command:**
   - Should be **empty** (so it uses `frontend/vercel.json`)
   - OR set to: `git config --global user.name 'Attendry' || true && git config --global user.email 'attendry@example.com' || true && npm ci`

4. **Check Build Command:**
   - Should be **empty** (so it uses `frontend/vercel.json`)
   - OR set to: `npm run vercel-build`

5. **Save and Redeploy**

### Option 2: Use npm install as Fallback

The configuration has been updated to use `npm install` as a fallback if `npm ci` fails. This is already in place in:
- `frontend/vercel.json` - installCommand with fallback
- `frontend/vercel-build.sh` - checks for package-lock.json

### Option 3: Remove rootDirectory from vercel.json

If Vercel Dashboard has `rootDirectory` set, you can remove it from `vercel.json` to avoid conflicts:

1. Edit `vercel.json` and remove the `rootDirectory` line
2. Let Vercel Dashboard handle the root directory setting
3. This ensures Vercel uses `frontend/vercel.json` correctly

## Current Configuration

The project now has:
- ✅ `frontend/vercel.json` with robust install command
- ✅ `frontend/vercel-build.sh` with package-lock.json check
- ✅ Fallback to `npm install` if `npm ci` fails

## Verification

After fixing:
1. Push a new commit
2. Check Vercel build logs
3. Verify `npm ci` or `npm install` runs successfully
4. Build should complete

## If Still Failing

1. **Check build logs** for the exact directory where install runs
2. **Verify package-lock.json is in repository:**
   ```bash
   git ls-files frontend/package-lock.json
   ```
3. **Try manual install command in Vercel Dashboard:**
   ```bash
   git config --global user.name 'Attendry' || true && git config --global user.email 'attendry@example.com' || true && cd frontend && npm ci
   ```
   (Only if Root Directory is NOT set to `frontend`)
