# Root Route Fix

## The Issue

The backend is receiving requests to `/` (root path) which returns 404 because there's no root route handler. The backend is an API server with all routes under `/api` prefix.

## What I Fixed

Added a root route handler in `health.controller.ts` that provides helpful API information when someone accesses the backend root.

## Available Routes

After the fix, accessing `http://localhost:3000/` will return:
```json
{
  "message": "Konzern API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/api/health",
    "companies": "/api/companies",
    "financialStatements": "/api/financial-statements",
    "import": "/api/import",
    "consolidation": "/api/consolidation"
  },
  "documentation": "All API endpoints are prefixed with /api"
}
```

## Important Notes

1. **The frontend should NOT be making requests to `/`** - all API requests should go to `/api/...`

2. **If you see this error from the frontend**, it means:
   - The frontend is making a request to the wrong path
   - Check browser console for the actual request URL
   - Verify `api.ts` is using the correct baseURL

3. **If you're accessing the backend directly in browser**:
   - `http://localhost:3000/` - Now returns API info (after fix)
   - `http://localhost:3000/api/health` - Health check
   - `http://localhost:3000/api/companies` - Companies endpoint

## Testing

After restarting the backend:

```powershell
# Test root route
Invoke-WebRequest -Uri "http://localhost:3000/" -Method GET

# Should return API information, not 404
```

## Next Steps

1. **Restart the backend** to apply the fix
2. **Check if frontend is making requests to `/`** - if so, that's the real issue
3. **Verify all frontend API calls use `/api/...` paths**
