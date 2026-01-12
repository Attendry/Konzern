# Quick Fix Action Plan

This document provides step-by-step instructions to fix the critical issues identified in the audit.

---

## Step 1: Verify Supabase Configuration (CRITICAL)

### Check if `.env.local` exists

```bash
cd backend
dir .env.local  # Windows
# or
ls -la .env.local  # Linux/Mac
```

### If file doesn't exist, create it:

1. Create `backend/.env.local` file
2. Add the following (replace with your actual values):

```env
SUPABASE_URL=https://[your-project-ref].supabase.co
Supabase_Secret=[your-service-role-key]
Supabase_Public=[your-anon-key]
```

**Where to find these values:**
- Go to https://app.supabase.com
- Select your project
- Go to Settings → API
- `SUPABASE_URL` = Project URL
- `Supabase_Secret` = service_role key (NOT anon key!)
- `Supabase_Public` = anon key (optional)

### Test the connection:

```bash
cd backend
node test-supabase-connection.ts
```

**Expected output:**
- ✅ Verbindung erfolgreich!
- ✅ "companies" Tabelle existiert

**If you see errors:**
- Check that the URL and keys are correct
- Verify you're using the service_role key (not anon key)
- Check that migrations have been run (see Step 2)

---

## Step 2: Verify Database Migrations (CRITICAL)

### Check if migrations have been run:

1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to SQL Editor
4. Run this query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('companies', 'accounts', 'financial_statements', 'account_balances');
```

**Expected:** Should return 4 rows (one for each table)

### If tables don't exist, run migrations:

1. In Supabase SQL Editor, open `supabase/migrations/001_initial_schema.sql`
2. Copy the entire contents
3. Paste into SQL Editor
4. Click "Run"
5. Repeat for:
   - `002_intercompany_transactions_enhancement.sql`
   - `003_participations_table.sql`

### Verify unique constraint exists:

Run this query in SQL Editor:

```sql
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name
FROM pg_constraint
WHERE conrelid = 'account_balances'::regclass
AND contype = 'u';
```

**Expected:** Should show a unique constraint on `(financial_statement_id, account_id)`

**If constraint doesn't exist, create it:**

```sql
ALTER TABLE account_balances 
ADD CONSTRAINT account_balances_unique 
UNIQUE (financial_statement_id, account_id);
```

---

## Step 3: Test Backend Startup

### Start the backend:

```bash
cd backend
npm run start:dev
```

### Check for these in the output:

**✅ Good signs:**
```
=== Supabase Configuration ===
Supabase_Public: [shows first 20 chars]...
Supabase_Secret: [shows first 20 chars]...
Supabase URL: https://[your-project].supabase.co
✅ Supabase Client erfolgreich erstellt
✅ Supabase-Verbindungstest erfolgreich (XXXms)
✅ API listening on http://localhost:3000/api
```

**❌ Warning signs:**
```
⚠️  WARNING: Missing Supabase configuration
⚠️  WARNING: Missing SUPABASE_URL
⚠️  Supabase-Verbindungstest fehlgeschlagen
```

**If you see warnings:**
- Go back to Step 1 and fix `.env.local`
- Restart the backend

---

## Step 4: Test Health Endpoint

### In a new terminal:

```bash
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-XX...",
  "uptime": 123.45
}
```

**If this fails:**
- Backend is not running → Go to Step 3
- Port 3000 is blocked → Check if another process is using it
- Wrong URL → Check backend logs for the actual port

---

## Step 5: Test Company Creation (Backend)

### Using curl:

```bash
curl -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Company\",\"taxId\":\"12345\",\"isConsolidated\":true}"
```

**Expected response:**
```json
{
  "id": "uuid-here",
  "name": "Test Company",
  "taxId": "12345",
  "isConsolidated": true,
  ...
}
```

**If you get an error:**
- Check backend logs for the error message
- Common issues:
  - `Supabase Client nicht initialisiert` → Go to Step 1
  - `relation "companies" does not exist` → Go to Step 2
  - `timeout` → Check Supabase connection/network

### Test GET companies:

```bash
curl http://localhost:3000/api/companies
```

**Expected:** Array of companies (may be empty `[]` or contain the test company)

---

## Step 6: Test Frontend

### Start frontend:

```bash
cd frontend
npm run dev
```

### Open browser:

1. Go to http://localhost:5173
2. Open browser console (F12)
3. Navigate to "Unternehmensverwaltung" (Company Management)
4. Check console for errors

**✅ Good signs:**
- No errors in console
- Companies list loads (may be empty)
- Can see "Neues Unternehmen" button

**❌ Warning signs:**
- `Request timeout` → Backend not running or not reachable
- `CORS error` → Check backend CORS config
- `404 Not Found` → Check API URL in frontend

### Test creating a company:

1. Click "Neues Unternehmen"
2. Fill in the form:
   - Name: "Test Company"
   - (Other fields optional)
3. Click "Erstellen"
4. Check console and backend logs

**Expected:**
- Company appears in the list
- No errors in console
- Backend logs show successful creation

**If it fails:**
- Check browser console for error message
- Check backend logs
- Verify Supabase connection (Step 1)

---

## Step 7: Test Import Functionality

### Prerequisites:
- At least one company exists
- At least one financial statement exists

### Create a financial statement:

1. In frontend, go to "Datenimport" (Data Import)
2. If no financial statements exist, click "Jahresabschluss erstellen"
3. Fill in:
   - Unternehmen: Select a company
   - Geschäftsjahr: 2024
   - Periodenstart: 2024-01-01
   - Periodenende: 2024-12-31
4. Click "Jahresabschluss erstellen"

### Test template download:

1. Click "Vorlage herunterladen"
2. Should download `Konsolidierung_Muster.xlsx`

**If this fails:**
- Check backend logs
- Verify template file exists in `templates/` directory
- Check file permissions

### Test import:

1. Use the downloaded template or create a simple Excel file with:
   - Column headers: `Kontonummer`, `Kontoname`, `Soll`, `Haben`, `Saldo`
   - At least one row of data
2. Select the financial statement
3. Select the file
4. Click "Importieren"

**Expected:**
- Import completes
- Shows "Erfolgreich X Datensätze importiert"
- No errors

**If it fails:**
- Check backend logs for specific error
- Verify file format matches expected columns
- Check that accounts exist or will be created

---

## Common Error Solutions

### Error: "Supabase Client nicht initialisiert"

**Solution:**
1. Check `backend/.env.local` exists
2. Verify `SUPABASE_URL` and `Supabase_Secret` are set
3. Restart backend

### Error: "relation 'companies' does not exist"

**Solution:**
1. Run migrations (Step 2)
2. Verify tables exist in Supabase Dashboard

### Error: "Request timeout"

**Solution:**
1. Check backend is running (Step 3)
2. Check backend logs for errors
3. Verify Supabase connection (Step 1)
4. Check network/firewall

### Error: "CORS error"

**Solution:**
1. Verify frontend uses relative URL `/api` in dev mode
2. Check `backend/src/main.ts` CORS config
3. Verify frontend runs on port 5173

### Error: "unique constraint violation" during import

**Solution:**
1. Verify unique constraint exists (Step 2)
2. Check that the constraint is on `(financial_statement_id, account_id)`
3. If constraint doesn't exist, create it (see Step 2)

### Error: "Template nicht gefunden"

**Solution:**
1. Verify `templates/Konsolidierung_Muster.xlsx` exists
2. Check file permissions
3. Try running backend from project root, not `dist/` directory

---

## Verification Checklist

After completing all steps, verify:

- [ ] Backend starts without errors
- [ ] Supabase connection is established
- [ ] Health endpoint returns 200 OK
- [ ] Can create a company via API (curl)
- [ ] Can fetch companies via API
- [ ] Frontend loads without errors
- [ ] Can create a company via frontend
- [ ] Can update a company via frontend
- [ ] Can delete a company via frontend
- [ ] Can download import template
- [ ] Can import an Excel file
- [ ] Import shows errors/warnings correctly

---

## Next Steps After Fixes

Once everything works:

1. **Improve Error Handling:**
   - Replace generic `Error` with NestJS exceptions
   - Add proper HTTP status codes
   - Improve error messages

2. **Improve Frontend UX:**
   - Replace `alert()` with toast notifications
   - Add loading spinners
   - Improve error display

3. **Code Cleanup:**
   - Remove unused TypeORM config
   - Fix linter errors
   - Add missing type definitions

4. **Add Tests:**
   - Unit tests for services
   - Integration tests for API
   - E2E tests for workflows

---

## Getting Help

If you're still stuck after following these steps:

1. **Check Backend Logs:**
   - Look for error messages
   - Check Supabase connection status
   - Verify all modules loaded

2. **Check Browser Console:**
   - Look for JavaScript errors
   - Check network requests
   - Verify API calls are being made

3. **Check Supabase Dashboard:**
   - Verify tables exist
   - Check data in tables
   - Review API logs

4. **Review Documentation:**
   - `README_SUPABASE_SETUP.md`
   - `TROUBLESHOOTING.md`
   - `DEBUGGING_FIXES.md`
   - `AUDIT_REPORT.md`

---

**Last Updated:** 2024-01-XX
