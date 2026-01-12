# Vercel Deployment Troubleshooting Guide

## Current Issues
1. Vercel refuses to deploy
2. Git pushes don't trigger new deployments

## ⚠️ CRITICAL: Private Repository Issue

**If your GitHub repository is PRIVATE, this is likely the root cause!**

### Vercel Plan Limitations:
- **Hobby Plan (Free)**: ❌ **DOES NOT support** deployments from private repositories in GitHub organizations
- **Pro Plan**: ✅ Supports private repositories (commit author must be a team member)

### Solutions for Private Repositories:

#### Option 1: Make Repository Public (Free)
1. Go to GitHub: `https://github.com/Attendry/Konzern`
2. Click **Settings → General → Danger Zone**
3. Click **Change visibility → Make public**
4. Confirm the change
5. Vercel deployments should work immediately

#### Option 2: Upgrade to Vercel Pro Plan
1. Go to Vercel Dashboard → Settings → Billing
2. Upgrade to **Pro Plan** ($20/month per user)
3. Private repository deployments will be enabled
4. **Note**: Commit author must be a member of the Vercel Pro team

#### Option 3: Use Personal Account (If Applicable)
- If the repository is under a personal GitHub account (not organization), Hobby plan may work
- Check if `Attendry` is an organization or personal account

## Step-by-Step Fix

### 1. Verify Vercel Project Connection to GitHub

**Check if project is connected:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings → Git**
4. Verify:
   - ✅ Repository is connected: `Attendry/Konzern`
   - ✅ Production Branch: `master` (or `main`)
   - ✅ Git Integration is enabled

**If NOT connected or shows "Disconnected":**
1. Click **Connect Git Repository**
2. Select **GitHub**
3. Authorize Vercel if needed
4. Select repository: `Attendry/Konzern`
5. Click **Import**

### 2. Check GitHub Webhook Configuration

**In GitHub:**
1. Go to your repository: `https://github.com/Attendry/Konzern`
2. Click **Settings → Webhooks**
3. Look for a webhook from `vercel.com`
4. Verify it's **Active** and shows recent deliveries

**If webhook is missing or failing:**
1. In Vercel Dashboard → Settings → Git
2. Click **Disconnect** (if connected)
3. Wait 10 seconds
4. Click **Connect Git Repository** again
5. Reconnect to GitHub

### 3. Verify Vercel Project Settings

**Critical Settings (Settings → General):**

1. **Root Directory:** `frontend` ⚠️ **MUST BE SET**
   - If empty, Vercel will use root `vercel.json`
   - If set to `frontend`, Vercel will use `frontend/vercel.json`

2. **Build Command:** 
   - **Option A (if Root Directory = `frontend`):**
     ```
     (git config user.name 'Attendry' || true) && (git config user.email 'attendry@example.com' || true) && npm ci && npm run build
     ```
   - **Option B (if Root Directory = empty):**
     ```
     cd frontend && (git config user.name 'Attendry' || true) && (git config user.email 'attendry@example.com' || true) && npm ci && npm run build
     ```

3. **Output Directory:** `dist`

4. **Install Command:** `npm ci`

5. **Framework Preset:** `Vite`

### 4. Check Build Logs for Errors

**In Vercel Dashboard:**
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Check **Build Logs** for:
   - Git config errors
   - Build command failures
   - Missing dependencies
   - TypeScript errors

**Common errors and fixes:**

| Error | Fix |
|-------|-----|
| "A commit author is required" | Build command already includes git config |
| "Cannot find module" | Run `npm ci` in frontend directory |
| "Build failed" | Check TypeScript errors in logs |
| "404 Not Found" | Verify Output Directory is `dist` |

### 5. Manual Deployment Trigger

**If git push doesn't trigger deployment:**

**Option A: Trigger via Vercel Dashboard**
1. Go to **Deployments** tab
2. Click **Redeploy** on latest deployment
3. Or click **Create Deployment** → Select branch `master`

**Option B: Create a test commit**
```bash
# Make a small change
echo "# Test deployment" >> frontend/README.md

# Commit and push
git add frontend/README.md
git commit -m "test: trigger Vercel deployment"
git push origin master
```

**Option C: Use Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project (if not linked)
cd frontend
vercel link

# Deploy
vercel --prod
```

### 6. Verify Git Branch Configuration

**Check which branch triggers production:**
1. Vercel Dashboard → Settings → Git
2. **Production Branch:** Should be `master` or `main`
3. **Preview Deployments:** Should be enabled for all branches

**If using `main` instead of `master`:**
```bash
# Rename branch
git branch -m master main
git push -u origin main
git push origin --delete master

# Update Vercel settings to use `main`
```

### 7. Environment Variables Check

**Required environment variables:**
1. Vercel Dashboard → Settings → Environment Variables
2. Add if missing:
   - `VITE_API_URL` (for Production, Preview, Development)
   - Value: Your backend API URL

### 8. Force Reconnect Everything

**Complete reset procedure:**

1. **In Vercel Dashboard:**
   - Settings → Git → **Disconnect** repository
   - Wait 30 seconds

2. **In GitHub:**
   - Settings → Webhooks → Delete any Vercel webhooks

3. **Reconnect:**
   - Vercel Dashboard → Add New Project
   - Import `Attendry/Konzern`
   - Configure:
     - Root Directory: `frontend`
     - Framework: Vite
     - Build Command: (leave empty - uses vercel.json)
     - Output Directory: `dist`

4. **Test:**
   ```bash
   # Create test commit
   git commit --allow-empty -m "test: trigger Vercel deployment"
   git push origin master
   ```

### 9. Check Vercel Project Limits

**Free tier limits:**
- 100 builds per day
- Check if you've hit the limit
- Vercel Dashboard → Usage

### 10. Verify Repository Permissions

**GitHub repository must allow Vercel:**
1. GitHub → Settings → Applications → Authorized OAuth Apps
2. Find **Vercel**
3. Verify it has access to `Attendry/Konzern`
4. If not, reconnect in Vercel Dashboard

## Quick Diagnostic Checklist

- [ ] **Repository is PUBLIC** OR you have **Vercel Pro Plan** (if private)
- [ ] Vercel project exists and is connected to GitHub
- [ ] Root Directory is set to `frontend` in Vercel settings
- [ ] Build Command includes git config (or is empty to use vercel.json)
- [ ] Output Directory is `dist`
- [ ] GitHub webhook exists and is active
- [ ] Production branch matches your git branch (`master` or `main`)
- [ ] Recent commits exist on the production branch
- [ ] Build logs show no errors
- [ ] Environment variables are set (if needed)
- [ ] Vercel usage limits not exceeded
- [ ] Commit author email matches Vercel account email

## Still Not Working?

1. **Check Vercel Status:** https://www.vercel-status.com/
2. **Check GitHub Status:** https://www.githubstatus.com/
3. **Vercel Support:** https://vercel.com/support
4. **Check build logs** for specific error messages
5. **Try deploying via Vercel CLI** to see detailed errors

## Test Deployment Command

After fixing everything, test with:
```bash
git commit --allow-empty -m "test: verify Vercel deployment"
git push origin master
```

Then check Vercel Dashboard → Deployments for new deployment.
