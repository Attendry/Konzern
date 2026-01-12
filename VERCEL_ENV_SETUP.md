# Setting Up Environment Variables in Vercel

## Current Issue

Your frontend is deployed but trying to call `http://localhost:3000/api`, which won't work in production. You need to set the `VITE_API_URL` environment variable in Vercel.

## Architecture Overview

**Important:** Supabase is your **database**, not your backend API!

Your architecture is:
- **Supabase** = Database (PostgreSQL) - Already hosted ✅
- **NestJS Backend** = API server - Needs to be deployed ⚠️
- **React Frontend** = UI - Already deployed on Vercel ✅

The frontend calls the NestJS backend, which then queries Supabase. So you need to deploy the NestJS backend separately.

## Step-by-Step Instructions

### 1. Deploy Your NestJS Backend

**If your backend is NOT deployed yet**, you need to deploy it first. The backend should be deployed to one of these platforms:

- **Railway** (recommended)
- **Render**
- **Heroku**
- **AWS/DigitalOcean**
- **Any other hosting service**

**Backend Deployment Required:**
- The NestJS backend in the `backend/` folder needs to be deployed
- It will connect to your Supabase database (which is already set up)
- See deployment options below

**Backend Configuration:**
When deploying the backend, you'll need to set these environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `Supabase_Secret` - Your Supabase service role key
- `Supabase_Public` - Your Supabase anon key (optional)

These are the same values you use for local development (see `README_SUPABASE_SETUP.md`).

### 2. Set Environment Variable in Vercel

1. **Go to Vercel Dashboard:**
   - Navigate to your project: `https://vercel.com/dashboard`
   - Click on your **Konzern** project

2. **Open Settings:**
   - Click **Settings** in the top menu
   - Click **Environment Variables** in the left sidebar

3. **Add the Variable:**
   - Click **Add New**
   - **Key:** `VITE_API_URL`
   - **Value:** Your backend API URL (e.g., `https://your-backend.railway.app/api`)
   - **Environment:** Select all three:
     - ✅ Production
     - ✅ Preview
     - ✅ Development
   - Click **Save**

4. **Redeploy:**
   - Go to **Deployments** tab
   - Click the **⋯** (three dots) on the latest deployment
   - Click **Redeploy**
   - OR push a new commit to trigger a new deployment

### 3. Verify It Works

After redeploying:

1. **Open your deployed frontend** in a browser
2. **Open Developer Console** (F12)
3. **Check the Network tab:**
   - API calls should now go to your backend URL (not localhost)
   - You should see successful requests (200 status)

4. **Check Console logs:**
   - Should see: `[API] GET https://your-backend.railway.app/api/companies`
   - Should NOT see: `[API] GET http://localhost:3000/api/companies`

## Example Configuration

If your backend is deployed to Railway at `https://konzern-backend.railway.app`:

**Environment Variable:**
- Key: `VITE_API_URL`
- Value: `https://konzern-backend.railway.app/api`
- Environments: Production, Preview, Development

## Troubleshooting

### Still seeing localhost errors?

1. **Check the environment variable is set:**
   - Vercel Dashboard → Settings → Environment Variables
   - Verify `VITE_API_URL` exists and has the correct value

2. **Redeploy after setting the variable:**
   - Environment variables are only available in NEW deployments
   - Old deployments won't have the variable

3. **Check the value format:**
   - Should include the protocol: `https://...`
   - Should include the `/api` path if your backend uses it
   - Should NOT have a trailing slash: `https://example.com/api` ✅ (not `https://example.com/api/` ❌)

### Backend not deployed yet?

You have two options:

**Option 1: Deploy Backend First (Recommended)**
1. Deploy backend to Railway/Render/Heroku
2. Get the backend URL
3. Set `VITE_API_URL` in Vercel
4. Redeploy frontend

**Option 2: Use Local Backend (Development Only)**
- This only works for local development
- For production, you MUST deploy the backend

## Backend Deployment Quick Start

If you need to deploy the backend:

### Railway (Recommended)
1. Go to [Railway](https://railway.app)
2. Create new project
3. Connect your GitHub repository: `Attendry/Konzern`
4. **Important:** Set **Root Directory** to `backend`
5. Set environment variables:
   - `SUPABASE_URL` = Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - `Supabase_Secret` = Your Supabase service role key
   - `Supabase_Public` = Your Supabase anon key (optional)
   - `NODE_ENV` = `production`
   - `PORT` = `3000` (or let Railway assign one)
6. Railway will auto-detect NestJS and build
7. After deployment, get the URL (e.g., `https://your-app.railway.app`)
8. **Use `https://your-app.railway.app/api` as `VITE_API_URL` in Vercel**

### Render
1. Go to [Render](https://render.com)
2. Create new **Web Service**
3. Connect GitHub repository: `Attendry/Konzern`
4. **Root Directory:** `backend`
5. **Build Command:** `npm install && npm run build`
6. **Start Command:** `npm run start:prod`
7. Set environment variables:
   - `SUPABASE_URL` = Your Supabase project URL
   - `Supabase_Secret` = Your Supabase service role key
   - `Supabase_Public` = Your Supabase anon key (optional)
   - `NODE_ENV` = `production`
   - `PORT` = `3000`
8. Deploy and get URL (e.g., `https://your-app.onrender.com`)
9. **Use `https://your-app.onrender.com/api` as `VITE_API_URL` in Vercel**

## Important Notes

- ⚠️ **Environment variables are case-sensitive:** Use `VITE_API_URL` exactly
- ⚠️ **Vite variables must start with `VITE_`:** This is required for Vite to expose them
- ⚠️ **Redeploy required:** After setting environment variables, you must redeploy
- ⚠️ **CORS must be configured:** Your backend must allow requests from your Vercel domain

## CORS Configuration

Make sure your backend allows requests from your Vercel domain. In `backend/src/main.ts`, ensure CORS includes:

```typescript
app.enableCors({
  origin: [
    'http://localhost:5173', // Local development
    'https://your-vercel-app.vercel.app', // Your Vercel domain
    'https://your-custom-domain.com', // If you have a custom domain
  ],
  credentials: true,
});
```

Or for development, you can allow all origins (not recommended for production):

```typescript
app.enableCors({
  origin: true, // Allows all origins (development only!)
  credentials: true,
});
```
