# Quick Setup: Vercel Environment Variables

## What You Need

**Only ONE environment variable is needed in Vercel:**

### `VITE_API_URL`

This tells your frontend where to find your backend API.

## Step-by-Step

### 1. Get Your Backend URL from Railway

**Step-by-step to find your Railway URL:**

1. **Go to Railway Dashboard:**
   - Open [railway.app](https://railway.app) in your browser
   - Log in if needed

2. **Find Your Project:**
   - You should see your project (might be called "Konzern" or similar)
   - Click on the project to open it

3. **Open the Backend Service:**
   - You should see `konzern-backend` service listed
   - Click on `konzern-backend` to open it

4. **Find the Public URL:**
   - Look for a tab/section called **"Settings"** or **"Networking"**
   - OR look at the top of the service page for a section showing the URL
   - OR check the **"Deployments"** tab - the URL might be shown there
   - You're looking for something like:
     - `https://konzern-backend-production-xxxx.up.railway.app`
     - OR `https://xxxxx.up.railway.app`
     - OR a custom domain if you set one up

5. **If you can't find it or it's not generated:**
   - Click on the **"Settings"** tab in your `konzern-backend` service
   - Scroll down to **"Networking"** section
   - Look for **"Generate Domain"** button or toggle
   - Click it to generate a public domain (if not already generated)
   - The URL will appear after generation
   - It will look like: `https://xxxxx.up.railway.app` or `https://konzern-backend-production-xxxx.up.railway.app`

6. **Alternative: Check the service overview page:**
   - Sometimes the URL is shown at the very top of the service page
   - Look for a clickable link or a "Open" button next to the service name
   - This will show your public URL

6. **Copy the URL and add `/api`:**
   - Copy the full URL (e.g., `https://konzern-backend-production-abc123.up.railway.app`)
   - Add `/api` to the end: `https://konzern-backend-production-abc123.up.railway.app/api`
   - This is your API URL!

**Visual Guide:**
```
Railway Dashboard
  └─ Your Project
      └─ konzern-backend service
          ├─ Settings tab → Networking section → Public URL
          ├─ OR top of page → Public URL section
          └─ OR Deployments tab → URL shown in deployment details
```

### 2. Set Environment Variable in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Open your **konzern-frontend** project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Fill in:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://konzern-backend-production-xxxx.up.railway.app/api` 
     - ⚠️ **IMPORTANT:** Must start with `https://` (not just the domain!)
     - Must end with `/api`
     - Example: `https://konzern-backend-production.up.railway.app/api`
   - **Environments:** Check all three:
     - ✅ Production
     - ✅ Preview  
     - ✅ Development
6. Click **Save**

### 3. Redeploy Frontend

**Important:** Environment variables only apply to NEW deployments!

1. Go to **Deployments** tab
2. Click **⋯** (three dots) on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete

### 4. Test

1. Open your Vercel frontend URL
2. Open browser console (F12)
3. Check Network tab - API calls should go to your Railway backend (not localhost)
4. Should see data loading successfully!

## Example

If your Railway backend URL is:
```
https://konzern-backend-production-abc123.up.railway.app
```

Then set in Vercel:
```
VITE_API_URL = https://konzern-backend-production-abc123.up.railway.app/api
```

## Troubleshooting

### Still seeing localhost errors?

1. **Check environment variable is set:**
   - Vercel Dashboard → Settings → Environment Variables
   - Verify `VITE_API_URL` exists and has correct value

2. **Redeploy after setting variable:**
   - Old deployments don't have new environment variables
   - Must redeploy after adding/changing variables

3. **Check the value:**
   - ✅ **MUST start with `https://`** - This is critical!
   - ✅ Should include `/api` at the end
   - ✅ Should NOT have trailing slash: `https://example.com/api` ✅ (not `https://example.com/api/` ❌)
   - ❌ **WRONG:** `konzern-backend-production.up.railway.app/api` (missing `https://`)
   - ✅ **CORRECT:** `https://konzern-backend-production.up.railway.app/api`

### CORS Errors?

If you see CORS errors, you need to update your backend CORS configuration:

1. In Railway, add environment variable to `konzern-backend`:
   - **Key:** `ALLOWED_ORIGINS`
   - **Value:** `https://your-vercel-app.vercel.app,http://localhost:5173`
   - Replace `your-vercel-app` with your actual Vercel domain

2. Redeploy backend in Railway

### 405 Method Not Allowed Error?

If you see `Request failed with status code 405`, check:

1. **Missing `https://` in VITE_API_URL:**
   - ❌ Wrong: `konzern-backend-production.up.railway.app/api`
   - ✅ Correct: `https://konzern-backend-production.up.railway.app/api`
   - The URL MUST start with `https://`

2. **Fix it:**
   - Vercel Dashboard → Settings → Environment Variables
   - Edit `VITE_API_URL`
   - Make sure it starts with `https://`
   - Save and redeploy

3. **Verify in browser console:**
   - Should see: `[API] POST https://konzern-backend-production.up.railway.app/api/companies`
   - NOT: `[API] POST konzern-backend-production.up.railway.app/api/companies` (missing https://)

## Summary

**Vercel needs:**
- ✅ `VITE_API_URL` = Your Railway backend URL + `/api`

**That's it!** Just one variable. 🎉
