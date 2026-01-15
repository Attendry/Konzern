# Column Detection Code Audit Report

## Issue
Import fails with: "Keine Kontonummer-Spalte gefunden" even though template has "Kontonummer" as second column.

## Code Flow Analysis

### 1. Excel Reading (Line 369)
```typescript
const rawDataArray: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
```
**Potential Issues:**
- `header: 1` returns array of arrays - first row is headers
- `defval: null` means empty cells become `null`
- If first row has merged cells or formatting, headers might be in wrong positions

### 2. Header Extraction (Lines 395-439)
```typescript
const headerRow = rawDataArray[0];
// Convert to strings...
```
**Potential Issues:**
- If `headerRow` is sparse array, some indices might be undefined
- Excel might return headers in different order than expected
- Merged cells might cause header row to have fewer elements

### 3. Header Normalization (Lines 403-439)
```typescript
headers.push(headerStr);
```
**Potential Issues:**
- Headers are cleaned but original might have special characters
- If header is `null` or empty, it becomes `Spalte_X` which won't match

### 4. Column Mapping Detection (Line 450)
```typescript
const columnMapping = this.findColumnMapping(headers);
```

### 5. findColumnMapping Function (Lines 74-254)
**Detection Logic Flow:**

#### Step 1: Exact Match Check (Lines 119-127)
```typescript
if (headerLower === 'kontonummer' || 
    header === 'Kontonummer' ||
    headerTrimmed.toLowerCase() === 'kontonummer' ||
    headerLower.includes('kontonummer') ||
    headerTrimmed.toLowerCase().includes('kontonummer'))
```
**Potential Issues:**
- `headerLower` is `header.toLowerCase()` - should work
- `headerTrimmed` is `header.trim()` - should work
- BUT: If header has encoding issues, `toLowerCase()` might not work correctly
- If header is `null` or empty, it becomes `Spalte_X` before this check

#### Step 2: Normalized Exact Matches (Lines 130-149)
```typescript
const allVariations = [normalized, originalLower, cleanedLower, ...];
for (const variation of allVariations) {
  if (exactMatches.includes(variation)) { ... }
}
```
**Potential Issues:**
- `normalize()` function removes spaces, underscores, hyphens
- If "Kontonummer" has any of these, it becomes "kontonummer" which should match
- BUT: If header is already `Spalte_2` (because it was null), it won't match

#### Step 3: Pattern Matching (Lines 151-185)
```typescript
const accountNumberPatterns = [/kontonummer/i, ...];
for (const variation of [normalized, originalLower, ...]) {
  if (accountNumberPatterns.some(pattern => pattern.test(variation))) { ... }
}
```
**Potential Issues:**
- Patterns use `/i` flag for case-insensitive matching
- Should match "Kontonummer" in any case
- BUT: If header was converted to `Spalte_2`, patterns won't match

### 6. Force Detection (Lines 452-478)
```typescript
for (let i = 0; i < headers.length; i++) {
  const h = headers[i];
  if (h === 'Kontonummer' || hLower === 'kontonummer' || ...) {
    columnMapping.accountNumber.push(h);
  }
}
```
**Potential Issues:**
- This runs AFTER `findColumnMapping()` 
- If headers array doesn't contain "Kontonummer" (because it was null/empty), this won't help
- This should catch it if it exists in headers array

### 7. Fallback Detection (Lines 481-496, 514-544, 547-579)
Multiple fallback mechanisms check:
- Data-based detection (numeric values in first row)
- Ultra-permissive header matching
- Last resort: any numeric column

## CRITICAL FINDINGS

### Issue #1: Header Row Might Be Sparse
If Excel returns a sparse array for headers, some columns might be `undefined`:
```typescript
// If headerRow = ['Unternehmen', undefined, 'Kontonummer', ...]
// Then headers[1] = 'Spalte_2' (wrong!)
// And headers[2] = 'Kontonummer' (correct, but index is wrong)
```

### Issue #2: Sheet Selection Might Be Wrong
The code auto-selects "Bilanzdaten" sheet, but:
- If template has "Anleitung" as first sheet, it might be selected first
- The auto-selection logic might not work if sheet names don't match exactly

### Issue #3: Headers Array Length Mismatch
If `headerRow.length` doesn't match actual number of columns:
- Some headers might be missing
- Indices might be wrong

### Issue #4: Error Thrown Before All Checks Complete
The error is thrown at line 499, but there are fallback checks AFTER that (lines 514-579).
However, if `columnMapping.accountNumber.length === 0` at line 499, it enters the error block.
The fallback checks inside the error block should set `foundAlternative = true`, but if they all fail, error is thrown.

## ROOT CAUSE HYPOTHESIS

**Most Likely:** The headers array doesn't contain "Kontonummer" because:
1. Wrong sheet is being read (Anleitung instead of Bilanzdaten)
2. Header row is sparse/incorrectly parsed
3. Headers are being read from wrong row (not row 1)
4. Excel file structure doesn't match expectations

## RECOMMENDED FIXES

1. **Add explicit sheet name logging** - Log which sheet is actually being read
2. **Log raw headerRow before processing** - See exactly what Excel returns
3. **Add header index verification** - Check if "Kontonummer" exists at expected index
4. **Add sheet name validation** - Ensure we're not reading Anleitung sheet
5. **Add header count validation** - Ensure we have expected number of headers (11 for template)
