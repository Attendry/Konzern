# Import Error Debugging Guide

## Current Issue: 400 Bad Request on Import

The import is failing with a 400 error. This guide helps identify the specific cause.

## Common Causes of 400 Errors

### 1. Missing financialStatementId

**Error Message:** `financialStatementId ist erforderlich`

**Check:**
- Is a financial statement selected in the frontend?
- Is the `financialStatementId` being sent in the FormData?

**Fix:**
- Make sure you've created a financial statement first
- Verify the dropdown shows the financial statement
- Check browser console for the request payload

---

### 2. File Not Uploaded

**Error Message:** `Keine Datei hochgeladen` or `Datei ist leer`

**Check:**
- Is a file selected in the file input?
- Is the file actually being sent in the request?

**Fix:**
- Select a file before clicking Import
- Check file size (should be > 0 bytes)
- Try a different file

---

### 3. Wrong File Type

**Error Message:** `Ungültiger Dateityp` or `Falscher Dateityp für Excel-Import`

**Check:**
- Is the file actually an Excel file (.xlsx or .xls)?
- Check the file extension

**Fix:**
- Use a valid Excel file (.xlsx or .xls)
- Download the template and use that format

---

### 4. Excel File Structure Issues

**Error Messages:**
- `Excel-Datei enthält keine Arbeitsblätter`
- `Excel-Datei enthält keine Daten`
- `Excel-Datei enthält keine Spaltenüberschriften`
- `Keine Kontonummer-Spalte gefunden`

**Check:**
- Does the Excel file have at least one sheet?
- Does the first row contain column headers?
- Is there a column named "Kontonummer" (or similar)?

**Fix:**
- Use the template from "Vorlage herunterladen"
- Ensure first row has headers: `Kontonummer`, `Kontoname`, `Soll`, `Haben`, `Saldo`
- Ensure there's at least one data row

---

### 5. No Valid Data Rows

**Error Message:** `Keine gültigen Datenzeilen gefunden`

**Check:**
- Are there data rows below the header?
- Do the rows have account numbers?

**Fix:**
- Add at least one data row with a valid account number
- Ensure account numbers are in the correct column

---

## How to Debug

### Step 1: Check Backend Logs

When you try to import, watch the backend console. You should see:

```
Excel Import Request: { hasFile: true, fileName: '...', ... }
Extracted parameters: { financialStatementId: '...', fileType: 'excel', ... }
```

**If you see errors:**
- `Import error: No file uploaded` → File not being sent
- `Import error: financialStatementId missing` → financialStatementId not in request
- `Import error: Wrong file type` → File type mismatch

### Step 2: Check Browser Console

Open DevTools (F12) → Console tab. Look for:
- `[API] POST /api/import/excel` - Request being made
- `[API] Response Error: POST /api/import/excel - 400` - Error response
- The error object should show the actual error message

### Step 3: Check Network Tab

Open DevTools (F12) → Network tab:
1. Make the import request
2. Find the request to `/api/import/excel`
3. Click on it
4. Check:
   - **Request Payload** - Should show FormData with `file` and `financialStatementId`
   - **Response** - Should show the error message

### Step 4: Test with Template

1. Click "Vorlage herunterladen" to get the template
2. Open the template in Excel
3. Add at least one row of data:
   ```
   Kontonummer: 1000
   Kontoname: Test Account
   Soll: 1000
   Haben: 0
   Saldo: 1000
   ```
4. Save the file
5. Try importing it

---

## Expected Request Format

The frontend should send a `FormData` with:
- `file`: The Excel file
- `financialStatementId`: UUID of the financial statement
- `fileType`: "excel"
- `sheetName`: (optional) Sheet name to import

---

## Quick Test

1. **Create a financial statement first:**
   - Go to Data Import page
   - Click "Jahresabschluss erstellen" if needed
   - Fill in the form and create

2. **Download template:**
   - Click "Vorlage herunterladen"
   - Open in Excel
   - Add test data (at least one row)

3. **Import:**
   - Select the financial statement
   - Select the file
   - Click "Importieren"

---

## If Still Failing

Check the backend console for the specific error message. The improved error handling should now show:
- More detailed error messages
- Better logging of what's being received
- Specific validation errors

Share the error message from:
1. Backend console logs
2. Browser console (the error object)
3. Network tab (response body)

This will help identify the exact issue.
