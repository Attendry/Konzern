# Route Fix Explanation

## The Problem

The backend error shows:
```json
{
  "statusCode": 404,
  "path": "/companies",
  "message": "Cannot GET /companies"
}
```

This means the backend received a request to `/companies` instead of `/api/companies`.

## Root Cause

The backend has:
- Global prefix: `/api` (set in `main.ts`)
- Controller route: `@Controller('companies')`
- Full route: `/api/companies`

The frontend makes requests to `/api/companies` (baseURL `/api` + path `/companies`).

The Vite proxy should forward `/api/companies` to `http://localhost:3000/api/companies`, but somehow the backend is receiving `/companies` (without the `/api` prefix).

## The Fix

Updated `frontend/vite.config.ts` to explicitly keep the path:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (path) => path, // Keep the /api prefix when forwarding
  },
}
```

This ensures that when the frontend requests `/api/companies`, it gets forwarded to `http://localhost:3000/api/companies` (with the `/api` prefix intact).

## Testing

After restarting the Vite dev server:

1. **Check the request in browser DevTools:**
   - Open Network tab
   - Make a request (e.g., load Company Management page)
   - The request should show: `http://localhost:5173/api/companies`
   - Status should be 200 (not 404)

2. **Check backend logs:**
   - Should see: `GET /api/companies - Request received`
   - Not: `GET /companies`

3. **Test directly:**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/api/companies"
   ```
   Should return 200 with company data (or empty array)

## If Issue Persists

If you still see 404 errors:

1. **Restart Vite dev server:**
   ```bash
   cd frontend
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Check browser console:**
   - Look for the actual request URL
   - Verify it's `/api/companies` not `/companies`

3. **Check backend logs:**
   - Verify the path the backend receives
   - Should be `/api/companies`

4. **Alternative: Use absolute URL temporarily:**
   If proxy still doesn't work, you can temporarily use absolute URL:
   ```typescript
   // In frontend/src/services/api.ts
   const API_BASE_URL = 'http://localhost:3000/api';
   ```
   But this will cause CORS issues unless CORS is properly configured.

## Expected Behavior After Fix

- Frontend requests: `/api/companies`
- Vite proxy forwards to: `http://localhost:3000/api/companies`
- Backend receives: `/api/companies`
- Backend responds: 200 OK with company data
