# Complete Deployment Guide: Vite Frontend + NestJS Backend

## Current Status

✅ **Vite Frontend** - Already deployed on Vercel  
⚠️ **NestJS Backend** - Needs deployment  
✅ **Supabase Database** - Already set up

## Overview

```
┌─────────────────┐
│  Vite Frontend  │  ← Deployed on Vercel ✅
│   (React App)   │
└────────┬────────┘
         │ HTTP Requests
         │ (needs VITE_API_URL)
         ▼
┌─────────────────┐
│ NestJS Backend  │  ← Needs deployment ⚠️
│   (API Server)  │
└────────┬────────┘
         │ Database Queries
         │ (uses Supabase credentials)
         ▼
┌─────────────────┐
│  Supabase DB    │  ← Already set up ✅
│   (PostgreSQL)  │
└─────────────────┘
```

---

## Part 1: Vite Frontend (Already Done! ✅)

### What's Already Working

Your React frontend is **already deployed on Vercel** and working! You just need to configure it to point to your backend.

### What You Need to Do

1. **Wait until backend is deployed** (see Part 2)
2. **Set environment variable in Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://your-backend-url.railway.app/api`
   - Apply to: Production, Preview, Development
   - Redeploy

**That's it for the frontend!** It's already built and deployed.

---

## Part 2: NestJS Backend Deployment

### Step 1: Prepare Backend for Deployment

#### 1.1 Check Your Backend Code

Your backend is in the `backend/` folder. Verify it has:
- ✅ `package.json` with build scripts
- ✅ `src/main.ts` (entry point)
- ✅ Supabase service configured

#### 1.2 Prepare Environment Variables

You'll need these for deployment:
- `SUPABASE_URL` - Your Supabase project URL
- `Supabase_Secret` - Your Supabase service role key
- `Supabase_Public` - Your Supabase anon key (optional)
- `NODE_ENV` - Set to `production`
- `PORT` - Usually auto-assigned by hosting service

**Where to find Supabase credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** = `SUPABASE_URL`
   - **service_role key** = `Supabase_Secret` (⚠️ Keep secret!)
   - **anon key** = `Supabase_Public` (optional)

---

### Step 2: Choose Deployment Platform

You have several options. **Railway is recommended** for simplicity.

#### Option A: Railway (Recommended) ⭐

**Why Railway:**
- ✅ Easiest setup
- ✅ Auto-detects NestJS
- ✅ Free tier available
- ✅ Automatic HTTPS
- ✅ Environment variables UI

**Steps:**

1. **Sign up/Login:**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose repository: `Attendry/Konzern`

3. **Configure Service:**
   - Railway will auto-detect it's a Node.js project
   - **Important:** Set **Root Directory** to `backend`
   - Railway will auto-detect NestJS

4. **Set Environment Variables:**
   - Click on your service
   - Go to "Variables" tab
   - Add these variables:
     ```
     SUPABASE_URL=https://xxxxx.supabase.co
     Supabase_Secret=your-service-role-key
     Supabase_Public=your-anon-key
     NODE_ENV=production
     ```
   - Railway will auto-assign `PORT`

5. **Deploy:**
   - Railway will automatically:
     - Run `npm install`
     - Run `npm run build`
     - Run `npm run start:prod` (or `node dist/main.js`)
   - Wait for deployment to complete

6. **Get Your Backend URL:**
   - After deployment, Railway will show your URL
   - Example: `https://your-app.railway.app`
   - **Your API URL:** `https://your-app.railway.app/api`
   - Copy this URL!

7. **Test Backend:**
   - Open: `https://your-app.railway.app/api/health`
   - Should return: `{"status":"ok",...}`

#### Option B: Render

**Steps:**

1. **Sign up/Login:**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect repository: `Attendry/Konzern`

3. **Configure:**
   - **Name:** `konzern-backend` (or any name)
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`

4. **Set Environment Variables:**
   - Scroll to "Environment Variables"
   - Add:
     ```
     SUPABASE_URL=https://xxxxx.supabase.co
     Supabase_Secret=your-service-role-key
     Supabase_Public=your-anon-key
     NODE_ENV=production
     PORT=3000
     ```

5. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment

6. **Get URL:**
   - Render will show: `https://your-app.onrender.com`
   - **Your API URL:** `https://your-app.onrender.com/api`

#### Option C: Heroku

**Steps:**

1. **Install Heroku CLI:**
   ```bash
   # Download from heroku.com or use package manager
   ```

2. **Login:**
   ```bash
   heroku login
   ```

3. **Create App:**
   ```bash
   cd backend
   heroku create konzern-backend
   ```

4. **Set Environment Variables:**
   ```bash
   heroku config:set SUPABASE_URL=https://xxxxx.supabase.co
   heroku config:set Supabase_Secret=your-service-role-key
   heroku config:set Supabase_Public=your-anon-key
   heroku config:set NODE_ENV=production
   ```

5. **Deploy:**
   ```bash
   git push heroku master
   ```

6. **Get URL:**
   - Heroku will show: `https://konzern-backend.herokuapp.com`
   - **Your API URL:** `https://konzern-backend.herokuapp.com/api`

---

### Step 3: Verify Backend is Working

After deployment, test your backend:

1. **Health Check:**
   ```
   GET https://your-backend-url.railway.app/api/health
   ```
   Should return: `{"status":"ok","timestamp":"...","uptime":...}`

2. **Test Companies Endpoint:**
   ```
   GET https://your-backend-url.railway.app/api/companies
   ```
   Should return: `[]` (empty array if no companies) or list of companies

3. **Check Logs:**
   - Railway/Render/Heroku dashboard → Logs
   - Should see: `Application is running on: http://0.0.0.0:PORT/api`

---

### Step 4: Connect Frontend to Backend

Now that your backend is deployed:

1. **Go to Vercel Dashboard:**
   - Your Project → Settings → Environment Variables

2. **Add Environment Variable:**
   - **Key:** `VITE_API_URL`
   - **Value:** `https://your-backend-url.railway.app/api`
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development
   - Click **Save**

3. **Redeploy Frontend:**
   - Go to Deployments tab
   - Click **⋯** (three dots) on latest deployment
   - Click **Redeploy**
   - OR push a new commit to trigger deployment

4. **Test:**
   - Open your Vercel frontend URL
   - Open browser console (F12)
   - Should see API calls going to your backend URL (not localhost)
   - Should see data loading successfully

---

## Troubleshooting

### Backend Won't Start

**Check:**
1. Environment variables are set correctly
2. Supabase credentials are valid
3. Build completed successfully
4. Check logs in Railway/Render/Heroku dashboard

**Common Issues:**
- Missing `NODE_ENV=production`
- Wrong `Root Directory` (should be `backend`)
- Supabase credentials incorrect
- Port not set (should auto-assign)

### Frontend Can't Connect to Backend

**Check:**
1. `VITE_API_URL` is set in Vercel
2. Backend URL is correct (includes `/api`)
3. Backend is actually running (test health endpoint)
4. CORS is configured in backend (should allow Vercel domain)

**CORS Configuration:**
In `backend/src/main.ts`, ensure:
```typescript
app.enableCors({
  origin: [
    'http://localhost:5173', // Local dev
    'https://your-vercel-app.vercel.app', // Your Vercel domain
  ],
  credentials: true,
});
```

Or for development (not recommended for production):
```typescript
app.enableCors({
  origin: true, // Allows all origins
  credentials: true,
});
```

### Database Connection Issues

**Check:**
1. Supabase credentials are correct
2. Supabase project is active
3. Database migrations have been run
4. Tables exist in Supabase

**Test Supabase Connection:**
```bash
cd backend
node check-supabase-connection.ts
```

---

## Quick Checklist

### Backend Deployment:
- [ ] Choose platform (Railway/Render/Heroku)
- [ ] Create project/service
- [ ] Set Root Directory to `backend`
- [ ] Set environment variables (Supabase credentials)
- [ ] Deploy
- [ ] Test health endpoint
- [ ] Copy backend URL

### Frontend Configuration:
- [ ] Set `VITE_API_URL` in Vercel
- [ ] Redeploy frontend
- [ ] Test frontend connects to backend
- [ ] Verify data loads

### Both Working:
- [ ] Frontend loads
- [ ] API calls go to backend (not localhost)
- [ ] Data displays correctly
- [ ] No CORS errors

---

## Summary

**Vite Frontend:**
- ✅ Already deployed on Vercel
- ⚠️ Just needs `VITE_API_URL` environment variable

**NestJS Backend:**
- ⚠️ Needs deployment to Railway/Render/Heroku
- ⚠️ Needs Supabase credentials as environment variables
- ⚠️ Then connect frontend to backend URL

**Total Time:** ~15-30 minutes for backend deployment

---

## Need Help?

If you get stuck:
1. Check the logs in your deployment platform
2. Verify environment variables are set correctly
3. Test backend health endpoint directly
4. Check browser console for frontend errors

Good luck! 🚀
