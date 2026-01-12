# Fix 405 Error: Configure CORS in Railway

## The Problem

You're getting a **405 Method Not Allowed** error when trying to save companies. This is likely a CORS issue where your Vercel frontend isn't allowed to make POST/PATCH requests to your Railway backend.

## Solution: Set ALLOWED_ORIGINS in Railway

### Step 1: Get Your Vercel Frontend URL

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Open your **konzern-frontend** project
3. Copy your deployment URL (e.g., `https://konzern-frontend.vercel.app`)
   - Or your custom domain if you have one

### Step 2: Set Environment Variable in Railway

1. Go to [Railway Dashboard](https://railway.app)
2. Open your **konzern-backend** service
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Key:** `ALLOWED_ORIGINS`
   - **Value:** `https://your-vercel-app.vercel.app,http://localhost:5173`
   - Replace `your-vercel-app` with your actual Vercel domain
6. Click **Add**

**Example:**
```
ALLOWED_ORIGINS = https://konzern-frontend.vercel.app,http://localhost:5173
```

### Step 3: Redeploy Backend

1. Railway will automatically redeploy when you add environment variables
2. OR manually trigger: Go to **Deployments** → Click **Redeploy**

### Step 4: Test

1. Go back to your Vercel frontend
2. Try creating/updating a company
3. Should work now! ✅

## Alternative: Allow All Origins (Development Only)

**⚠️ Only for testing/development - NOT recommended for production!**

If you want to allow all origins temporarily:

1. In Railway, add environment variable:
   - **Key:** `NODE_ENV`
   - **Value:** `development`

2. Redeploy

**Note:** This makes your API accessible from any website, which is a security risk. Only use for testing!

## Verify CORS is Working

After setting `ALLOWED_ORIGINS` and redeploying:

1. Check Railway logs - you should see:
   ```
   CORS enabled for origins: https://your-vercel-app.vercel.app,http://localhost:5173
   ```

2. Try creating a company in your frontend
3. Check browser console - should see successful POST request

## Troubleshooting

### Still getting 405 error?

1. **Check Railway logs:**
   - Look for CORS warnings
   - Should see: `CORS: Allowing origin: https://...`

2. **Verify Vercel URL is correct:**
   - Check your Vercel deployment URL
   - Make sure it matches exactly in `ALLOWED_ORIGINS`
   - No trailing slash!

3. **Check environment variable:**
   - Railway → Variables → Verify `ALLOWED_ORIGINS` is set
   - Value should be comma-separated: `url1,url2`

4. **Redeploy after setting variable:**
   - Environment variables only apply to new deployments

### Getting CORS errors instead of 405?

- Check browser console for CORS error messages
- Verify the origin in the error matches your Vercel URL
- Make sure `ALLOWED_ORIGINS` includes your exact Vercel domain

## Summary

**To fix 405 error:**
1. ✅ Set `ALLOWED_ORIGINS` in Railway with your Vercel URL
2. ✅ Redeploy backend
3. ✅ Test creating/updating companies

The 405 error should be resolved! 🎉
