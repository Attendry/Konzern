# Excel Import "Kontonummer" Detection Issue - Comprehensive Report

**Date:** January 15, 2026  
**Status:** Critical - Blocking Import Functionality  
**Priority:** High

## Executive Summary

The Excel import functionality is failing with the error "Keine Kontonummer-Spalte gefunden" despite the template file containing "Kontonummer" as the second column in the "Bilanzdaten" sheet. Despite extensive diagnostic logging and multiple detection strategies, the issue persists, and diagnostic logs are not appearing in production, suggesting either a deployment/build issue or a code path that isn't being executed.

## Problem Statement

### Primary Error
```
BadRequestException: Keine Kontonummer-Spalte gefunden. Erwartete Spaltennamen: Kontonummer, AccountNumber, Account_Number, Konto
```

**Error Location (from Railway logs):**
- File: `/app/dist/modules/import/import.service.js:127:23`
- This corresponds to a very early line in the compiled JavaScript, suggesting the error is thrown before most of our diagnostic code executes.

### Observed Behavior
1. **Template Download:** ✅ Working (CORS issue resolved)
2. **Template Upload:** ❌ Failing with "Kontonummer" detection error
3. **Diagnostic Logs:** ❌ Not appearing in Railway logs (critical indicator)
4. **Error Message Format:** Old short version (not the verbose version we added)

## Verification Results

### Template File Verification
**File:** `templates/Konsolidierung_Muster_v3.0.xlsx`

**Verified via Python (openpyxl):**
- ✅ Sheet order: "Bilanzdaten" is the first sheet (index 0)
- ✅ First row headers: `['Unternehmen', 'Kontonummer', 'Kontoname', 'HGB-Position', 'Kontotyp', 'Soll', 'Haben', 'Saldo', 'Zwischengesellschaft', 'Gegenpartei', 'Bemerkung']`
- ✅ "Kontonummer" is at index 1 (second column)
- ✅ Headers are properly formatted (no null/empty values)

**Verified via Node.js (XLSX library):**
- ✅ Sheet names: `['Bilanzdaten', 'Anleitung', ...]`
- ✅ First row: `["Unternehmen","Kontonummer","Kontoname",...]`
- ✅ "Kontonummer" is correctly present in the second position

**Conclusion:** The template file is **100% correct**. The issue is in how the backend reads/processes it.

## Code Analysis

### Current Detection Strategy (Multi-Layered)

The code implements multiple layers of detection:

1. **Sheet Selection Logic** (Lines 342-391)
   - Auto-selects "Bilanzdaten" sheet
   - Searches all sheets for one containing "Kontonummer" in headers
   - Falls back to first non-instruction sheet

2. **Header Extraction** (Lines 427-527)
   - Reads first row using `XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null })`
   - Converts headers to strings, handles null/undefined values
   - Logs each header individually

3. **Direct Kontonummer Check** (Lines 529-570) - **NEW**
   - Checks headers array directly before any complex logic
   - Simple string comparison: `header === 'Kontonummer' || header.toLowerCase() === 'kontonummer'`
   - Should catch it even if all other detection fails

4. **findColumnMapping Function** (Lines 74-273)
   - Multiple normalization strategies
   - Pattern matching with regex
   - Exact matches with variations

5. **Force Detection** (Lines 536-567)
   - Bypasses findColumnMapping logic
   - Direct header array iteration
   - Multiple case variations

6. **Ultra-Aggressive Fallback** (Lines 572-608)
   - Most permissive matching possible
   - Checks for "konto", "account", "nr", "no" in any form
   - Should never fail if "Kontonummer" exists

7. **Data-Based Fallback** (Lines 610-625)
   - Infers account number column from numeric data in first row
   - Looks for columns with 3-20 digit numeric values

8. **Last Resort** (Lines 627-644)
   - Uses first column with any numeric data (2-20 digits)

### Diagnostic Logging Added

**Entry Point Logging:**
- `[ImportService] ========== IMPORT EXCEL CALLED ==========`
- File name, size, financial statement ID, sheet name

**Workbook Reading:**
- Workbook read success
- Sheet names and count

**Sheet Selection:**
- Every sheet checked
- Why each sheet is selected/rejected
- When "Kontonummer" is found in sheet headers

**Header Detection:**
- Raw header row from Excel
- Each header individually with type information
- Normalized versions

**Column Mapping:**
- Before and after findColumnMapping
- Force detection results
- Ultra-aggressive fallback results

**Error Logging:**
- Full diagnostic information before throwing error
- All available headers
- Normalized headers
- First data row sample

## Critical Observations

### 1. No Diagnostic Logs Appearing
**Observation:** Despite extensive logging added to the code, **NONE** of the diagnostic logs appear in Railway logs, including:
- ❌ Entry point log (`[ImportService] ========== IMPORT EXCEL CALLED ==========`)
- ❌ Workbook reading logs
- ❌ Sheet selection logs
- ❌ Header detection logs
- ❌ Column mapping logs

**Implications:**
- The code path we're adding logs to may not be executing
- There might be an early validation/error that throws before our logs
- The build might not be updating (cached build)
- There might be a different code path being executed

### 2. Error Message Format Mismatch
**Observation:** The error message in Railway logs is:
```
Keine Kontonummer-Spalte gefunden. Erwartete Spaltennamen: Kontonummer, AccountNumber, Account_Number, Konto
```

**But our code has:**
```typescript
Keine Kontonummer-Spalte gefunden im Blatt "${sheetName}".\n\n` +
`Erwartete Spaltennamen: Kontonummer, AccountNumber, Account_Number, Account-Number, Konto, Konto-Nr, Konto Nr, Account, Nr, No\n\n` +
`Gefundene Spalten in der Datei: ${availableHeaders}\n\n` +
...
```

**Implications:**
- The old code is still running (build cache issue)
- OR the error is thrown from a different location
- OR the error message is being truncated/modified somewhere

### 3. Error Location (Line 127 in Compiled JS)
**Observation:** Error occurs at `/app/dist/modules/import/import.service.js:127:23`

**Analysis:**
- Line 127 in compiled JavaScript is very early
- In our source code, line 127 is inside `findColumnMapping` function (around the exact match check)
- But we're not seeing logs from `findColumnMapping` either
- This suggests the error might be thrown from a different location or an old version of the code

## Root Cause Hypotheses

### Hypothesis 1: Build/Deployment Issue (Most Likely)
**Theory:** Railway is using a cached build or the build isn't actually updating the deployed code.

**Evidence:**
- No diagnostic logs appearing (suggests old code)
- Old error message format (suggests old code)
- Error at line 127 (might be from old code structure)

**Verification Needed:**
- Check Railway build logs for actual compilation
- Verify dist folder is being updated
- Check if there's a build cache that needs clearing

### Hypothesis 2: Early Validation/Error
**Theory:** There's an early validation or error that throws before our diagnostic code executes.

**Evidence:**
- Error at line 127 (very early)
- No entry point logs appearing

**Verification Needed:**
- Check if there's validation in the controller before calling importExcel
- Check if there's a try-catch that's catching and re-throwing with a different message
- Check if there's middleware that's intercepting the request

### Hypothesis 3: Different Code Path
**Theory:** A different code path is being executed (e.g., a different import function or a cached route handler).

**Evidence:**
- No logs from our code
- Error format doesn't match our code

**Verification Needed:**
- Check if there are multiple import endpoints
- Check if there's route caching
- Check if there's a different service being called

### Hypothesis 4: Excel Reading Issue
**Theory:** The XLSX library is reading the file differently than expected, causing headers to be in a different format or position.

**Evidence:**
- Template is correct when read locally
- But backend might be reading it differently

**Verification Needed:**
- Add logging right after XLSX.read to see what it actually returns
- Compare local vs production XLSX library behavior
- Check if there are encoding issues

## Attempted Solutions

### Solution 1: Enhanced Logging
**Status:** ❌ Not Working (logs not appearing)
- Added entry point logging
- Added workbook reading logs
- Added sheet selection logs
- Added header detection logs
- Added column mapping logs

### Solution 2: Multiple Detection Strategies
**Status:** ❌ Not Working (error still occurs)
- Direct Kontonummer check
- Force detection
- Ultra-aggressive fallback
- Data-based inference
- Last resort numeric detection

### Solution 3: Template Fixes
**Status:** ✅ Template is Correct
- Verified sheet order
- Verified header format
- Verified "Kontonummer" position

### Solution 4: CORS Fixes
**Status:** ✅ Working
- Template download now works
- Cache-busting implemented

## Recommended Next Steps

### Immediate Actions

1. **Verify Build Process**
   - Check Railway build logs to confirm TypeScript is compiling
   - Verify dist folder contains updated code
   - Check for build cache that needs clearing
   - Consider forcing a clean rebuild

2. **Add Minimal Test Logging**
   - Add a single `console.log` at the very first line of `importExcel` function
   - If this doesn't appear, the function isn't being called or build isn't updating

3. **Check for Early Validation**
   - Review controller code for any validation before calling importExcel
   - Check for middleware that might be intercepting
   - Check for route handlers that might be cached

4. **Direct XLSX Test**
   - Add logging immediately after `XLSX.read()` to see what the library actually returns
   - Log the raw sheet data before any processing
   - Compare with local test results

### Alternative Approaches

1. **Bypass Detection Entirely**
   - If "Kontonummer" is always in the second column of "Bilanzdaten" sheet, hardcode it
   - Use index-based access: `headers[1]` as account number column
   - Only fall back to detection if hardcoded approach fails

2. **Use Multi-Sheet Import Service**
   - The `MultiSheetImportService` has simpler header detection
   - Uses direct index-based access: `headerMap['kontonummer'] ?? 1`
   - Might be more reliable

3. **Add Import Wizard/Manual Mapping**
   - Allow users to manually map columns
   - Bypass automatic detection entirely
   - More user control, less prone to detection failures

## Technical Details

### File Structure
- **Template:** `templates/Konsolidierung_Muster_v3.0.xlsx`
- **Backend Service:** `backend/src/modules/import/import.service.ts`
- **Backend Controller:** `backend/src/modules/import/import.controller.ts`
- **Template Generator:** `create_excel_template.py`

### Key Functions
- `importExcel()` - Main import function (line 312)
- `findColumnMapping()` - Column detection logic (line 74)
- `mapExcelRow()` - Row mapping (line 279)

### Dependencies
- `xlsx` library for Excel parsing
- `@nestjs/common` for exceptions
- TypeORM/Supabase for database operations

## Conclusion

The issue is **NOT** with the template file (verified correct). The problem appears to be either:
1. **Build/Deployment Issue:** Old code is still running despite rebuilds
2. **Code Path Issue:** Different code path is executing that we haven't instrumented
3. **Early Error:** Error is thrown before our diagnostic code executes

The fact that **NO diagnostic logs are appearing** is the most critical indicator that something fundamental is wrong with either the deployment or the code execution path.

**Recommended Priority:** Investigate build/deployment process first, then add minimal test logging to verify code execution.
