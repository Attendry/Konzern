# Railway Deployment Update Guide

**Date:** January 17, 2026  
**Purpose:** Update Railway deployment after version migrations

---

## ✅ What Happens Automatically

When you push your code to GitHub (and Railway is connected):

1. ✅ **Railway detects the push** and triggers a new deployment
2. ✅ **Railway runs `npm install`** - This will automatically install all updated dependencies from `package.json`
3. ✅ **Railway runs `npm run build`** - Builds the application
4. ✅ **Railway runs the start command** - Starts the application

**So yes, the updated dependencies will automatically install!** 🎉

---

## ⚠️ What You Need to Update Manually

However, you need to update the **Node.js version** in Railway settings:

### Critical: Update Node.js Version to 24

Railway needs to be told to use Node.js 24 (or it may still use an older version).

#### Method 1: Via Environment Variable (Recommended)

1. **Go to Railway Dashboard:**
   - Open [railway.app](https://railway.app)
   - Navigate to your `konzern-backend` service

2. **Go to Variables tab:**
   - Click on **Variables** tab

3. **Add/Update Node.js Version:**
   - **Key:** `NODE_VERSION`
   - **Value:** `24` (or `24.0.0` for specific version)
   - Click **Add** or **Update**

4. **Save** - Railway will automatically redeploy

#### Method 2: Via Settings (Alternative)

1. **Go to Railway Dashboard:**
   - Navigate to `konzern-backend` service
   - Click **Settings** tab

2. **Find Build & Deploy section:**
   - Scroll to **Build & Deploy** settings
   - Look for **Node Version** or **NODE_VERSION** field

3. **Set Node.js Version:**
   - Set to: `24` or `24.0.0`

4. **Save** - Railway will automatically redeploy

---

## Railway Auto-Detection

Railway can also auto-detect Node.js version from:

1. **`.nvmrc` file** - We've updated this to `24` ✅
2. **`package.json` engines** - We've updated this to `>=24.0.0` ✅

**However**, Railway may not always auto-detect, so it's safer to set it manually via the environment variable.

---

## Complete Railway Configuration Checklist

After pushing your code, verify these settings in Railway:

### Environment Variables
- [ ] `NODE_VERSION` = `24` ⚠️ **CRITICAL - Must be set!**
- [ ] `ALLOWED_ORIGINS` = (your Vercel frontend URLs)
- [ ] `SUPABASE_URL` = (your Supabase URL)
- [ ] `Supabase_Secret` = (your Supabase secret)
- [ ] `GEMINI_API_KEY` = (your Google Gemini API key - if using AI features)
- [ ] `NODE_ENV` = `production`

### Build & Deploy Settings
- [ ] **Root Directory:** `backend` (should be set to `backend` directory)
- [ ] **Node Version:** `24` (via `NODE_VERSION` env var or settings)
- [ ] **Build Command:** `npm install && npm run build` (or auto-detected)
- [ ] **Start Command:** `npm run start:prod` (or `node dist/main.js`)

---

## Deployment Flow

### What Happens When You Push Code:

```
1. Push to GitHub
   ↓
2. Railway detects push
   ↓
3. Railway checks out code
   ↓
4. Railway reads package.json
   ↓
5. Railway installs Node.js (version from NODE_VERSION or .nvmrc)
   ↓
6. Railway runs: npm install
   ✅ Installs all updated dependencies automatically
   ↓
7. Railway runs: npm run build
   ✅ Builds with new TypeScript, NestJS, etc.
   ↓
8. Railway runs: npm run start:prod
   ✅ Starts application
```

---

## Verification Steps

After Railway redeploys, check:

### 1. Check Railway Logs

1. **Railway Dashboard** → `konzern-backend` → **Logs** tab
2. Look for:
   ```
   ✅ Node.js version: v24.x.x (not v18 or v20)
   ✅ Installing dependencies...
   ✅ Building application...
   ✅ Application started successfully
   ```

### 2. Check Build Logs

Look for these in Railway build logs:
```
✅ npm install - installing updated packages
✅ @google/genai@0.14.0 installed
✅ @nestjs/common@11.1.11 installed
✅ typescript@5.9.2 installed
✅ Build successful
```

### 3. Test API Endpoint

```powershell
# Test health endpoint
curl https://your-railway-url.up.railway.app/api/health

# Should return: {"status":"ok"}
```

### 4. Test AI Features

If you have AI chat features:
- Test that AI chat works (verifies Google GenAI SDK migration)
- Check Railway logs for any AI-related errors

---

## Troubleshooting

### Issue: Railway Still Using Old Node.js Version

**Solution:**
1. Set `NODE_VERSION` = `24` in Railway Variables
2. Trigger a manual redeploy:
   - Railway Dashboard → Deployments → Click "Redeploy"

### Issue: Build Fails with Dependency Errors

**Possible Causes:**
1. Node.js version mismatch
2. Peer dependency conflicts

**Solution:**
1. Verify `NODE_VERSION` = `24` is set
2. Check Railway build logs for specific errors
3. If needed, Railway may need `--legacy-peer-deps` flag (unlikely, but possible)

### Issue: Application Fails to Start

**Check:**
1. Railway logs for startup errors
2. Verify `npm run start:prod` command is correct
3. Verify `dist/main.js` exists after build
4. Check environment variables are set correctly

---

## Summary

✅ **Dependencies will install automatically** when you push code  
⚠️ **You must update Node.js version** in Railway to 24  
✅ **Railway will auto-redeploy** after you set `NODE_VERSION`

---

## Quick Action Items

1. **Push your code to GitHub** (if not already pushed)
2. **Set `NODE_VERSION` = `24`** in Railway Variables
3. **Wait for Railway to redeploy** (automatic)
4. **Check Railway logs** to verify successful deployment
5. **Test your API endpoints** to ensure everything works

---

**Last Updated:** January 17, 2026
