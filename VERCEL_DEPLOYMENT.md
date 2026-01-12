# Vercel Deployment Guide

This guide explains how to deploy the Konzern frontend to Vercel.

## Prerequisites

- GitHub repository connected to Vercel
- Vercel account (free tier is sufficient)

## Project Structure

This is a monorepo with the following structure:
```
konzern/
├── frontend/     # React + Vite application (deployed to Vercel)
├── backend/      # NestJS API (deploy separately to Railway/Render/etc.)
└── supabase/    # Database migrations
```

## Vercel Configuration

### Automatic Setup (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository: `Attendry/Konzern`
4. Configure the project:
   - **Framework Preset:** Vite (or leave as auto-detect)
   - **Root Directory:** `frontend` ⚠️ **IMPORTANT**
   - **Build Command:** `npm run build` (or leave empty - uses package.json)
   - **Output Directory:** `dist` (or leave empty - Vite default)
   - **Install Command:** `npm ci` (or leave empty)

### Environment Variables

Add the following environment variables in Vercel (Settings → Environment Variables):

- `VITE_API_URL` - Your backend API URL (e.g., `https://your-backend.railway.app/api`)
  - Add for: Production, Preview, Development

### Manual Configuration

If automatic setup doesn't work, the project includes:
- `vercel.json` in root (for monorepo setup)
- `frontend/vercel.json` (for frontend-specific config)

## Deployment Process

1. **Push to GitHub:** Vercel automatically deploys on every push to the main/master branch
2. **Preview Deployments:** Every pull request gets a preview deployment
3. **Production:** Merges to main/master trigger production deployments

## Troubleshooting

### 404 Errors

If you see 404 errors:
1. Verify **Root Directory** is set to `frontend` in Vercel settings
2. Check build logs to ensure build completes successfully
3. Verify `frontend/dist/index.html` exists after build

### Build Failures

1. Check build logs in Vercel dashboard
2. Ensure Node.js version is 18+ (specified in `.nvmrc`)
3. Verify all dependencies are in `frontend/package.json`

### API Connection Issues

1. Set `VITE_API_URL` environment variable in Vercel
2. Ensure your backend CORS is configured to allow your Vercel domain
3. Check browser console for CORS errors

## Backend Deployment

The NestJS backend should be deployed separately to:
- **Railway** (recommended)
- **Render**
- **Heroku**
- **AWS/DigitalOcean**

The backend is not deployed to Vercel as it requires a long-running Node.js process.

## Git Author Configuration

If you see "A commit author is required" error:

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

Or set globally:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Then amend the last commit:
```bash
git commit --amend --reset-author --no-edit
git push --force-with-lease
```

## Support

For issues, check:
- Vercel build logs
- Browser console errors
- Network tab for API calls
