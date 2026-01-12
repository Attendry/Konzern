# Fix CORS Error: Quick Guide

## The Problem

You're seeing:
```
Access to XMLHttpRequest ... has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present
```

This means your Railway backend doesn't know it should accept requests from your Vercel frontend.

## Quick Fix (2 Steps)

### Step 1: Find Your Vercel URLs

You need to add your Vercel URLs to Railway's `ALLOWED_ORIGINS`.

**Find your Vercel URLs:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Open your project
3. Go to **Settings** → **Domains**
4. You'll see:
   - **Production URL:** `https://your-project.vercel.app` (or custom domain)
   - **Preview URLs:** `https://your-project-xxxxx.vercel.app` (for each preview)

**OR check the error message:**
- Your current origin: `https://konzern-9lybj38pp-attendry.vercel.app`
- This is a preview deployment URL

### Step 2: Add to Railway

1. **Go to Railway Dashboard:**
   - Open [railway.app](https://railway.app)
   - Open your project
   - Click on `konzern-backend` service

2. **Go to Variables:**
   - Click **Variables** tab
   - Look for `ALLOWED_ORIGINS` (or create it if it doesn't exist)

3. **Set the Value:**
   - **Key:** `ALLOWED_ORIGINS`
   - **Value:** Add your production Vercel URL (and localhost):
     ```
     https://your-production-url.vercel.app,http://localhost:5173
     ```
   
   **Good News:** 🎉
   - ✅ **You only need your PRODUCTION URL!**
   - ✅ All Vercel preview URLs (`*.vercel.app`) are automatically allowed
   - ✅ The backend will accept any `*.vercel.app` domain if you have any vercel.app URL in the list
   
   **Important:**
   - ✅ Include `https://` for the production URL
   - ✅ Include `http://localhost:5173` for local development
   - ✅ No need to add preview URLs - they're auto-allowed!

4. **Example:**
   ```
   https://konzern-frontend.vercel.app,http://localhost:5173
   ```
   
   This will automatically allow:
   - ✅ `https://konzern-frontend.vercel.app` (production)
   - ✅ `https://konzern-9lybj38pp-attendry.vercel.app` (preview - auto-allowed)
   - ✅ `https://konzern-xyz123-abc456.vercel.app` (any preview - auto-allowed)
   - ✅ `http://localhost:5173` (local dev)

5. **Save and Redeploy:**
   - Click **Save** or **Add**
   - Railway will automatically redeploy
   - Wait for deployment to complete (check Deployments tab)

### Step 3: Verify Backend is Running

The 502 Bad Gateway error suggests the backend might not be running.

**Check Railway:**
1. Railway Dashboard → `konzern-backend` → **Deployments** tab
2. Is the latest deployment **successful** (green checkmark)?
3. If not, check the logs for errors

**Check Logs:**
1. Railway Dashboard → `konzern-backend` → **Logs** tab
2. You should see:
   - `Starting NestJS application...`
   - `CORS enabled for origins: ...`
   - `Application is running on: ...`

**If backend is not running:**
- Check for build errors in Railway logs
- Verify environment variables are set (SUPABASE_URL, etc.)
- Check if the service is paused/stopped

## Alternative: Allow All Vercel Preview URLs

If you have many preview deployments, you can temporarily allow all Vercel URLs:

**In Railway, set:**
- `NODE_ENV` = `development` (allows all origins)

**Note:** The backend code already automatically allows all `*.vercel.app` preview domains if you have any vercel.app URL in `ALLOWED_ORIGINS`. No code changes needed!

## Verify It's Working

1. **Check Railway Logs:**
   - Try loading the page again
   - Railway logs should show: `CORS: Allowing origin: https://konzern-9lybj38pp-attendry.vercel.app`

2. **Check Browser Console:**
   - Should no longer see CORS errors
   - Should see successful API calls

3. **Test API:**
   - Open browser console
   - Run:
   ```javascript
   fetch('https://konzern-backend-production.up.railway.app/api/companies')
     .then(r => r.json())
     .then(console.log)
     .catch(console.error)
   ```
   - Should return data, not CORS error

## Common Issues

### Still Getting CORS Error?

1. **Backend not redeployed:**
   - Environment variables only apply to NEW deployments
   - Make sure Railway redeployed after adding `ALLOWED_ORIGINS`

2. **Wrong URL format:**
   - ❌ Wrong: `konzern-9lybj38pp-attendry.vercel.app` (missing https://)
   - ✅ Correct: `https://konzern-9lybj38pp-attendry.vercel.app`

3. **Preview URLs not working:**
   - Preview URLs are automatically allowed if you have any `*.vercel.app` URL in `ALLOWED_ORIGINS`
   - Just make sure you have at least one vercel.app URL in the list (your production URL)

4. **502 Bad Gateway:**
   - Backend is not running
   - Check Railway logs for errors
   - Verify all environment variables are set

### Finding Your Production Vercel URL

1. Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Look for the production domain
3. Usually: `https://your-project-name.vercel.app`
4. Or check the **Deployments** tab → Production deployment → Click to see URL

## Summary

**Railway needs:**
- ✅ `ALLOWED_ORIGINS` = `https://your-vercel-production-url.vercel.app,http://localhost:5173`
  - **Only production URL needed!** All preview URLs are automatically allowed
- ✅ Backend must be running (check for 502 errors)
- ✅ Backend must be redeployed after setting the variable

**How it works:**
- If `ALLOWED_ORIGINS` contains any `*.vercel.app` URL, the backend automatically allows ALL `*.vercel.app` domains
- This means every preview deployment will work without updating `ALLOWED_ORIGINS`
- You only need to set your production Vercel URL once
