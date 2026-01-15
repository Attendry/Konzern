import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import { ValidationService } from './validation.service';
import * as XLSX from 'xlsx';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { ImportDataDto } from './dto/import-data.dto';

// Multer File Type
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface ImportRow {
  accountNumber: string;
  accountName?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  isIntercompany?: boolean;
  company?: string; // Für Multi-Unternehmen-Import
}

interface ColumnMapping {
  accountNumber: string[];
  accountName: string[];
  debit: string[];
  credit: string[];
  balance: string[];
  isIntercompany: string[];
  company?: string[];
}

@Injectable()
export class ImportService {
  constructor(
    private supabaseService: SupabaseService,
    private validationService: ValidationService,
  ) {}

  /**
   * Import multiple sheets from Excel template
   * This method will be called by the controller and should delegate to MultiSheetImportService
   * Note: MultiSheetImportService is injected separately to avoid circular dependencies
   */
  async importMultiSheet(
    file: MulterFile,
    options: {
      fiscalYear: number;
      periodStart?: string;
      periodEnd?: string;
    },
  ) {
    // This is a placeholder - the actual implementation is in MultiSheetImportService
    // The controller should inject MultiSheetImportService directly
    throw new BadRequestException(
      'Multi-sheet import should be called via MultiSheetImportService',
    );
  }

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Findet die Spaltenzuordnung basierend auf möglichen Spaltennamen
   */
  private findColumnMapping(headers: string[]): ColumnMapping {
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, '').replace(/[_-]/g, '');
    
    const mapping: ColumnMapping = {
      accountNumber: [],
      accountName: [],
      debit: [],
      credit: [],
      balance: [],
      isIntercompany: [],
      company: [],
    };

    // Log headers for debugging
    console.log('[ImportService] Detected headers:', headers);

    headers.forEach((header, index) => {
      // Clean header multiple ways
      const originalHeader = header;
      const trimmedHeader = header.trim();
      const normalized = normalize(header);
      const originalLower = header.toLowerCase().trim();
      
      // Also try with common Excel encoding issues removed
      const cleanedHeader = header.replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); // Remove zero-width spaces
      const cleanedLower = cleanedHeader.toLowerCase().trim();
      const cleanedNormalized = normalize(cleanedHeader);
      
      // Log for debugging
      console.log(`[ImportService] Processing header ${index}: "${header}" -> normalized: "${normalized}", cleaned: "${cleanedLower}"`);
      
      // Kontonummer - check exact matches first (most common cases)
      // Check ALL variations including exact case-insensitive match
      const exactMatches = [
        'kontonummer', 'accountnumber', 'account_number', 'account-number',
        'konto', 'account', 'kontonr', 'kontonumber', 'accountnr', 'accountno',
        'accno', 'accnumber', 'kto', 'nr', 'no', 'nummer', 'number'
      ];
      
      // First check: exact case-insensitive match for "Kontonummer" (most common template column)
      let matched = false;
      if (header.toLowerCase() === 'kontonummer' || header === 'Kontonummer') {
        console.log(`[ImportService] Exact case-insensitive match for "Kontonummer": "${header}"`);
        mapping.accountNumber.push(header);
        matched = true;
      }
      
      // Second check: exact matches in normalized variations
      if (!matched) {
        const allVariations = [
          normalized, 
          originalLower, 
          cleanedLower, 
          cleanedNormalized, 
          trimmedHeader.toLowerCase().replace(/\s+/g, '').replace(/[_-]/g, ''),
          header.toLowerCase(), // Direct lowercase of original
          header.toLowerCase().trim(), // Direct lowercase trimmed
        ];
        
        for (const variation of allVariations) {
          if (exactMatches.includes(variation)) {
            console.log(`[ImportService] Exact match for account number column: "${header}" (matched variation: "${variation}")`);
            mapping.accountNumber.push(header);
            matched = true;
            break;
          }
        }
      }
      
      if (!matched) {
        // Kontonummer - expanded pattern matching with more variations
        // Match common variations: kontonummer, accountnumber, account_number, account-number, konto, account, etc.
        // Test both normalized (without spaces/underscores/hyphens) and original (with them)
        const accountNumberPatterns = [
          /kontonummer/i,
          /accountnumber/i,
          /account_number/i,
          /account-number/i,
          /account\s+number/i,
          /^konto$/i,
          /^account$/i,
          /kontonr/i,
          /kontonumber/i,
          /accountnr/i,
          /accountno/i,
          /accno/i,
          /accnumber/i,
          /^kto$/i,
          /^nr$/i,
          /^no$/i,
          /^nummer$/i,
          /^number$/i,
        ];
        
        // Test all variations: normalized, original, and cleaned
        for (const variation of [normalized, originalLower, cleanedLower, cleanedHeader, header]) {
          if (accountNumberPatterns.some(pattern => pattern.test(variation))) {
            console.log(`[ImportService] Pattern match for account number column: "${header}" (matched variation: "${variation}")`);
            mapping.accountNumber.push(header);
            matched = true;
            break;
          }
        }
      }
      // Kontoname - expanded patterns
      const accountNamePatterns = [
        /kontoname/i,
        /accountname/i,
        /account_name/i,
        /account-name/i,
        /account\s+name/i,
        /^name$/i,
        /bezeichnung/i,
        /description/i,
        /text/i,
      ];
      if (accountNamePatterns.some(pattern => pattern.test(normalized) || pattern.test(originalLower))) {
        mapping.accountName.push(header);
      }
      
      // Soll - expanded patterns
      const debitPatterns = [
        /^soll$/i,
        /debit/i,
        /sollbetrag/i,
        /debitamount/i,
        /debit_amount/i,
        /debit-amount/i,
      ];
      if (debitPatterns.some(pattern => pattern.test(normalized) || pattern.test(originalLower))) {
        mapping.debit.push(header);
      }
      
      // Haben - expanded patterns
      const creditPatterns = [
        /^haben$/i,
        /credit/i,
        /habenbetrag/i,
        /creditamount/i,
        /credit_amount/i,
        /credit-amount/i,
      ];
      if (creditPatterns.some(pattern => pattern.test(normalized) || pattern.test(originalLower))) {
        mapping.credit.push(header);
      }
      
      // Saldo - expanded patterns
      const balancePatterns = [
        /saldo/i,
        /balance/i,
        /betrag/i,
        /amount/i,
        /gesamt/i,
        /total/i,
      ];
      if (balancePatterns.some(pattern => pattern.test(normalized) || pattern.test(originalLower))) {
        mapping.balance.push(header);
      }
      // Zwischengesellschaft - handle with hyphen
      const intercompanyPatterns = [
        /zwischengesellschaft/i,
        /intercompany/i,
        /is_intercompany/i,
        /is-intercompany/i,
        /zwischen.*gesellschaft/i,
      ];
      if (intercompanyPatterns.some(pattern => 
        pattern.test(normalized) || 
        pattern.test(originalLower) || 
        pattern.test(cleanedLower)
      )) {
        mapping.isIntercompany.push(header);
      }
      
      // Unternehmen - handle with hyphen and variations
      const companyPatterns = [
        /unternehmen/i,
        /company/i,
        /firma/i,
        /unternehmensname/i,
        /company.*name/i,
      ];
      if (companyPatterns.some(pattern => 
        pattern.test(normalized) || 
        pattern.test(originalLower) || 
        pattern.test(cleanedLower)
      )) {
        mapping.company.push(header);
      }
    });

    return mapping;
  }

  /**
   * Mappt eine Excel-Zeile basierend auf der Spaltenzuordnung
   */
  private mapExcelRow(row: any, mapping: ColumnMapping): ImportRow {
    const getValue = (keys: string[]): any => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key];
        }
      }
      return undefined;
    };

    const accountNumber = getValue(mapping.accountNumber);
    if (!accountNumber) {
      throw new Error('Kontonummer nicht gefunden');
    }

    return {
      accountNumber: String(accountNumber).trim(),
      accountName: getValue(mapping.accountName) ? String(getValue(mapping.accountName)).trim() : undefined,
      debit: this.parseNumber(getValue(mapping.debit)),
      credit: this.parseNumber(getValue(mapping.credit)),
      balance: this.parseNumber(getValue(mapping.balance)),
      isIntercompany: this.parseBoolean(getValue(mapping.isIntercompany)),
      company: getValue(mapping.company) ? String(getValue(mapping.company)).trim() : undefined,
    };
  }

  private parseBoolean(value: any): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'ja' || str === 'yes';
  }

  async importExcel(
    file: MulterFile,
    importDataDto: ImportDataDto,
  ): Promise<{ imported: number; errors: string[]; warnings: string[] }> {
    try {
      if (!file || !file.buffer) {
        throw new BadRequestException('Datei ist leer oder ungültig');
      }

      // Dateiformat-Validierung
      const allowedMimes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (file.mimetype && !allowedMimes.includes(file.mimetype)) {
        throw new BadRequestException('Ungültiger Dateityp. Nur Excel-Dateien (.xlsx, .xls) sind erlaubt.');
      }

      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new BadRequestException('Excel-Datei enthält keine Arbeitsblätter');
      }

      // Smart sheet selection: prefer "Bilanzdaten" if available, otherwise use specified or first sheet
      let sheetName = importDataDto.sheetName;
      if (!sheetName) {
        // Prefer "Bilanzdaten" sheet (most common data sheet name)
        const bilanzSheet = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('bilanz') || 
          name.toLowerCase().includes('balance') ||
          name.toLowerCase() === 'bilanzdaten'
        );
        
        if (bilanzSheet) {
          sheetName = bilanzSheet;
          console.log(`[ImportService] Auto-selected sheet: "${sheetName}" (found Bilanz sheet)`);
        } else {
          // Skip instruction/info sheets and find first data sheet
          const skipSheets = ['anleitung', 'instruction', 'info', 'information', 'überblick', 'overview', 'hinweise'];
          const dataSheet = workbook.SheetNames.find(name => 
            !skipSheets.some(skip => name.toLowerCase().includes(skip))
          );
          
          sheetName = dataSheet || workbook.SheetNames[0];
          console.log(`[ImportService] Auto-selected sheet: "${sheetName}" (from ${workbook.SheetNames.length} available sheets)`);
        }
      }
      
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new BadRequestException(`Arbeitsblatt "${sheetName}" nicht gefunden. Verfügbare Blätter: ${workbook.SheetNames.join(', ')}`);
      }
      
      console.log(`[ImportService] Using sheet: "${sheetName}" (available sheets: ${workbook.SheetNames.join(', ')})`);
      
      // Erste Zeile für Spaltenzuordnung
      // Use header: 1 to get array of arrays, then convert to objects with first row as headers
      const rawDataArray: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
      console.log(`[ImportService] Raw data array length: ${rawDataArray?.length || 0}`);
      
      if (!rawDataArray || rawDataArray.length === 0) {
        // Try next sheet if this one is empty
        const nextSheet = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('bilanz') || 
          name.toLowerCase().includes('balance') ||
          (name.toLowerCase() !== 'anleitung' && name.toLowerCase() !== 'instruction')
        );
        
        if (nextSheet && nextSheet !== sheetName) {
          console.log(`[ImportService] Sheet "${sheetName}" is empty, trying "${nextSheet}"`);
          const nextWorksheet = workbook.Sheets[nextSheet];
          if (nextWorksheet) {
            const nextDataArray = XLSX.utils.sheet_to_json(nextWorksheet, { header: 1, defval: null });
            if (nextDataArray && nextDataArray.length > 0) {
              console.log(`[ImportService] Found data in "${nextSheet}", using that instead`);
              return this.importExcel({ ...file, buffer: file.buffer }, { ...importDataDto, sheetName: nextSheet });
            }
        }
        }
        throw new BadRequestException(`Excel-Datei enthält keine Daten im Blatt "${sheetName}". Verfügbare Blätter: ${workbook.SheetNames.join(', ')}`);
      }

      // First row should be headers
      const headerRow = rawDataArray[0];
      console.log(`[ImportService] Header row:`, headerRow);
      
      if (!headerRow || headerRow.length === 0) {
        throw new BadRequestException('Excel-Datei enthält keine Spaltenüberschriften');
      }

      // Convert headers to strings and clean them
      const headers = headerRow.map((h: any, i: number) => {
        // Handle different data types from Excel
        let headerStr: string;
        if (h === null || h === undefined || h === '') {
          headerStr = `Spalte_${i + 1}`;
        } else if (typeof h === 'number') {
          headerStr = String(h);
        } else if (typeof h === 'string') {
          headerStr = h;
        } else {
          headerStr = String(h);
        }
        
        // Remove zero-width spaces and other invisible characters, then trim
        headerStr = headerStr.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        
        // If after cleaning it's empty, use default name
        if (!headerStr || headerStr.length === 0) {
          headerStr = `Spalte_${i + 1}`;
        }
        
        return headerStr;
      });

      console.log('[ImportService] Raw header row from Excel:', JSON.stringify(headerRow));
      console.log('[ImportService] Detected headers from Excel:', JSON.stringify(headers));
      console.log('[ImportService] Header count:', headers.length);
      
      // Debug: Log each header individually with its type
      headers.forEach((h, i) => {
        console.log(`[ImportService] Header[${i}]: "${h}" (type: ${typeof headerRow[i]}, original: ${JSON.stringify(headerRow[i])})`);
      });

      const columnMapping = this.findColumnMapping(headers);
      
      // If still no account number found, try alternative: use first data row to infer headers
      if (columnMapping.accountNumber.length === 0 && rawDataArray.length > 1) {
        console.warn('[ImportService] No account number column found in headers, trying alternative detection');
        // Try to find a column that looks like account numbers in the data
        const firstDataRow = rawDataArray[1];
        if (firstDataRow) {
          for (let i = 0; i < Math.min(headers.length, firstDataRow.length); i++) {
            const cellValue = String(firstDataRow[i] || '').trim();
            // Check if this cell looks like an account number (numeric, 3-20 chars)
            if (/^\d{3,20}$/.test(cellValue)) {
              console.log(`[ImportService] Found potential account number column at index ${i}: "${headers[i]}" with value "${cellValue}"`);
              columnMapping.accountNumber.push(headers[i]);
              break;
            }
          }
        }
      }
      
      // Validierung: Mindestens Kontonummer muss vorhanden sein
      if (columnMapping.accountNumber.length === 0) {
        // Provide helpful error message with available headers
        const availableHeaders = headers.join(', ');
        const normalizedHeaders = headers.map(h => {
          const normalized = h.toLowerCase().trim().replace(/\s+/g, '').replace(/[_-]/g, '');
          return `${h} (normalized: "${normalized}")`;
        }).join(', ');
        
        console.error('[ImportService] Account number column not found.');
        console.error('[ImportService] Sheet name:', sheetName);
        console.error('[ImportService] Original headers:', JSON.stringify(headers, null, 2));
        console.error('[ImportService] Normalized headers:', headers.map(h => h.toLowerCase().trim().replace(/\s+/g, '').replace(/[_-]/g, '')));
        console.error('[ImportService] Column mapping result:', JSON.stringify(columnMapping, null, 2));
        console.error('[ImportService] First data row sample:', rawDataArray.length > 1 ? rawDataArray[1] : 'No data rows');
        
        // Try one more time with a very permissive check - look for any column that might be account number
        let foundAlternative = false;
        for (let i = 0; i < headers.length; i++) {
          const header = headers[i];
          const headerLower = header.toLowerCase();
          const normalized = headerLower.trim().replace(/\s+/g, '').replace(/[_-]/g, '');
          
          // ULTRA-PERMISSIVE: Check every possible variation
          // Check if header contains "kontonummer" in any form
          if (headerLower.includes('kontonummer') || 
              headerLower.includes('konto') || 
              normalized.includes('kontonummer') ||
              normalized.includes('konto') ||
              headerLower.includes('account') || 
              normalized.includes('account') ||
              headerLower.includes('nr') || 
              normalized.includes('nr') ||
              headerLower.includes('number') ||
              normalized.includes('number') ||
              normalized === 'nr' ||
              normalized === 'no' ||
              normalized === 'nummer' ||
              header === 'Kontonummer' ||
              header === 'kontonummer' ||
              header === 'KONTONUMMER') {
            console.log(`[ImportService] Found alternative account number column via ultra-permissive check: "${header}" (index ${i}, normalized: "${normalized}")`);
            columnMapping.accountNumber.push(header);
            foundAlternative = true;
            break;
          }
        }
        
        // If still not found, try to infer from data - look for numeric columns in first data row
        if (!foundAlternative && rawDataArray.length > 1) {
          const firstDataRow = rawDataArray[1];
          for (let i = 0; i < Math.min(headers.length, firstDataRow.length); i++) {
            const cellValue = String(firstDataRow[i] || '').trim();
            // Check if this cell looks like an account number (numeric, 3-20 chars)
            if (/^\d{3,20}$/.test(cellValue)) {
              console.log(`[ImportService] Found potential account number column at index ${i}: "${headers[i]}" with value "${cellValue}"`);
              columnMapping.accountNumber.push(headers[i]);
              foundAlternative = true;
              break;
            }
          }
        }
        
        if (!foundAlternative) {
          // Check if we're on the wrong sheet (Anleitung)
          if (sheetName.toLowerCase().includes('anleitung') || sheetName.toLowerCase().includes('instruction')) {
            // Try to find Bilanzdaten sheet
            const bilanzSheet = workbook.SheetNames.find(name => 
              name.toLowerCase().includes('bilanz') || 
              name.toLowerCase().includes('balance')
            );
            
            if (bilanzSheet) {
              console.log(`[ImportService] Detected instruction sheet, redirecting to "${bilanzSheet}"`);
              return this.importExcel({ ...file, buffer: file.buffer }, { ...importDataDto, sheetName: bilanzSheet });
            }
          }
          
          throw new BadRequestException(
            `Keine Kontonummer-Spalte gefunden im Blatt "${sheetName}".\n\n` +
            `Erwartete Spaltennamen: Kontonummer, AccountNumber, Account_Number, Account-Number, Konto, Konto-Nr, Konto Nr, Account, Nr, No\n\n` +
            `Gefundene Spalten in der Datei: ${availableHeaders}\n\n` +
            `Normalisierte Spaltennamen: ${normalizedHeaders}\n\n` +
            `Verfügbare Blätter: ${workbook.SheetNames.join(', ')}\n\n` +
            `Bitte verwenden Sie den Import-Assistenten für flexible Spaltenzuordnung oder wählen Sie das Blatt "Bilanzdaten" aus.`
          );
        }
      }
      
      console.log('[ImportService] Column mapping successful:', {
        accountNumber: columnMapping.accountNumber,
        accountName: columnMapping.accountName,
        debit: columnMapping.debit,
        credit: columnMapping.credit,
      });

      // Convert array format back to object format for mapping
      const rawData: any[] = rawDataArray.slice(1).map((row: any[]) => {
        const rowObj: any = {};
        headers.forEach((header, i) => {
          rowObj[header] = row[i] ?? null;
        });
        return rowObj;
      });

      // Mappe alle Zeilen
      const data: ImportRow[] = [];
      const errors: string[] = [];
      
      rawData.forEach((row, index) => {
        try {
          const mappedRow = this.mapExcelRow(row, columnMapping);
          data.push(mappedRow);
        } catch (error: any) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Zeile ${index + 2}: ${errorMessage}`);
        }
      });

      if (data.length === 0) {
        throw new BadRequestException('Keine gültigen Datenzeilen gefunden. ' + errors.join('; '));
      }

      const result = await this.processImportData(data, importDataDto.financialStatementId);
      return {
        ...result,
        errors: [...errors, ...result.errors],
        warnings: result.warnings || [],
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(`Fehler beim Lesen der Excel-Datei: ${errorMessage}`);
    }
  }

  async importCsv(
    file: MulterFile,
    importDataDto: ImportDataDto,
  ): Promise<{ imported: number; errors: string[]; warnings: string[] }> {
    return new Promise((resolve, reject) => {
      if (!file || !file.buffer) {
        reject(new BadRequestException('Datei ist leer oder ungültig'));
        return;
      }

      // CSV-Format-Validierung
      if (file.mimetype && file.mimetype !== 'text/csv' && !file.originalname?.endsWith('.csv')) {
        reject(new BadRequestException('Ungültiger Dateityp. Nur CSV-Dateien sind erlaubt.'));
        return;
      }

      const data: ImportRow[] = [];
      const parseErrors: string[] = [];
      let rowIndex = 0;

      const stream = Readable.from(file.buffer);

      stream
        .pipe(csv())
        .on('data', (row) => {
          rowIndex++;
          try {
            // Flexiblere Spaltenzuordnung für CSV
            const accountNumber = row.accountNumber || row['Kontonummer'] || row['Konto'] || row['AccountNumber'];
            if (!accountNumber) {
              parseErrors.push(`Zeile ${rowIndex + 1}: Keine Kontonummer gefunden`);
              return;
            }

            data.push({
              accountNumber: String(accountNumber).trim(),
              accountName: row.accountName || row['Kontoname'] || row['Name'] || row['AccountName'],
              debit: this.parseNumber(row.debit || row['Soll'] || row['Debit']),
              credit: this.parseNumber(row.credit || row['Haben'] || row['Credit']),
              balance: this.parseNumber(row.balance || row['Saldo'] || row['Balance']),
              isIntercompany: this.parseBoolean(
                row.isIntercompany || row['Zwischengesellschaft'] || row['Intercompany']
              ),
              company: row.company || row['Unternehmen'] || row['Company'],
            });
          } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            parseErrors.push(`Zeile ${rowIndex + 1}: ${errorMessage}`);
          }
        })
        .on('end', async () => {
          try {
            if (data.length === 0 && parseErrors.length > 0) {
              reject(new BadRequestException('Keine gültigen Daten gefunden. ' + parseErrors.join('; ')));
              return;
            }

            const result = await this.processImportData(
              data,
              importDataDto.financialStatementId,
            );
            resolve({
              ...result,
              errors: [...parseErrors, ...result.errors],
              warnings: result.warnings || [],
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(new BadRequestException(`Fehler beim Lesen der CSV-Datei: ${error.message}`));
        });
    });
  }

  private async processImportData(
    data: ImportRow[],
    financialStatementId: string,
  ): Promise<{ imported: number; errors: string[]; warnings: string[] }> {
    const { data: financialStatement, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('*, companies(*)')
      .eq('id', financialStatementId)
      .single();

    if (fsError || !financialStatement) {
      throw new BadRequestException(
        `Financial statement with ID ${financialStatementId} not found`,
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    // Validierung der Datenintegrität
    const validRows = data.filter((row, index) => {
      if (!row.accountNumber) {
        errors.push(`Zeile ${index + 1}: Keine Kontonummer angegeben`);
        return false;
      }

      // Validierung: Soll und Haben sollten numerisch sein
      if (row.debit !== undefined && (isNaN(row.debit) || row.debit < 0)) {
        warnings.push(`Zeile ${index + 1} (Konto ${row.accountNumber}): Ungültiger Soll-Wert`);
      }
      if (row.credit !== undefined && (isNaN(row.credit) || row.credit < 0)) {
        warnings.push(`Zeile ${index + 1} (Konto ${row.accountNumber}): Ungültiger Haben-Wert`);
      }

      return true;
    });

    if (validRows.length === 0) {
      return { imported: 0, errors, warnings };
    }

    // Batch fetch all existing accounts
    const accountNumbers = [...new Set(validRows.map((r) => r.accountNumber))];
    let existingAccounts: any[] = [];
    
    if (accountNumbers.length > 0) {
      const { data, error: accountsError } = await this.supabase
        .from('accounts')
        .select('*')
        .in('account_number', accountNumbers);
      
      if (accountsError) {
        errors.push(`Fehler beim Abrufen bestehender Konten: ${accountsError.message}`);
      } else {
        existingAccounts = data || [];
      }
    }

    const accountMap = new Map(
      existingAccounts.map((acc) => [acc.account_number, acc]),
    );

    // Create missing accounts in batch
    const accountsToCreate = validRows
      .filter((row) => !accountMap.has(row.accountNumber) && row.accountName)
      .map((row) => ({
        account_number: row.accountNumber,
        name: row.accountName!,
        account_type: 'asset' as const, // Default, sollte aus Daten bestimmt werden
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      }));

    if (accountsToCreate.length > 0) {
      const { data: newAccounts, error: createError } = await this.supabase
        .from('accounts')
        .insert(accountsToCreate)
        .select();

      if (createError) {
        errors.push(`Fehler beim Erstellen von Konten: ${createError.message}`);
      } else {
        (newAccounts || []).forEach((acc) => {
          accountMap.set(acc.account_number, acc);
        });
      }
    }

    // Check for missing account names
    validRows.forEach((row) => {
      if (!accountMap.has(row.accountNumber) && !row.accountName) {
        errors.push(`Konto ${row.accountNumber}: Kein Kontoname angegeben`);
      }
    });

    // Batch fetch existing balances
    const accountIds = Array.from(accountMap.values()).map((acc) => acc.id);
    let existingBalances: any[] = [];
    
    if (accountIds.length > 0) {
      const { data, error: balanceFetchError } = await this.supabase
        .from('account_balances')
        .select('*')
        .eq('financial_statement_id', financialStatementId)
        .in('account_id', accountIds);

      if (balanceFetchError) {
        errors.push(`Fehler beim Abrufen bestehender Salden: ${balanceFetchError.message}`);
      } else {
        existingBalances = data || [];
      }
    }

    const balanceMap = new Map(
      existingBalances.map((bal) => [bal.account_id, bal]),
    );

    // Prepare balance data for upsert
    // Don't include id or created_at - let Supabase handle it via unique constraint
    const balancesToUpsert = validRows
      .filter((row) => accountMap.has(row.accountNumber))
      .map((row) => {
        const account = accountMap.get(row.accountNumber)!;
        return {
          financial_statement_id: financialStatementId,
          account_id: account.id,
          debit: row.debit || 0,
          credit: row.credit || 0,
          balance: row.balance || (row.debit || 0) - (row.credit || 0),
          is_intercompany: row.isIntercompany || false,
          updated_at: SupabaseMapper.getCurrentTimestamp(),
        };
      });

    // Batch upsert balances using the unique constraint (financial_statement_id, account_id)
    // Supabase will automatically insert or update based on the unique constraint
    if (balancesToUpsert.length > 0) {
      // Process in batches to avoid Supabase limits (1000 rows per request)
      const batchSize = 1000;
      for (let i = 0; i < balancesToUpsert.length; i += batchSize) {
        const batch = balancesToUpsert.slice(i, i + batchSize);
        const { error: balanceError } = await this.supabase
          .from('account_balances')
          .upsert(batch, { 
            onConflict: 'financial_statement_id,account_id',
            ignoreDuplicates: false 
          });

        if (balanceError) {
          errors.push(`Fehler beim Speichern der Salden (Batch ${Math.floor(i / batchSize) + 1}): ${balanceError.message}`);
        }
      }
    }

    // Bilanzgleichheit prüfen (Aktiva = Passiva)
    const { data: allBalances } = await this.supabase
      .from('account_balances')
      .select('balance, accounts(account_type)')
      .eq('financial_statement_id', financialStatementId);

    if (allBalances && allBalances.length > 0) {
      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;

      allBalances.forEach((balance: any) => {
        const account = Array.isArray(balance.accounts) ? balance.accounts[0] : balance.accounts;
        const accountType = account?.account_type;
        const balanceValue = parseFloat(balance.balance) || 0;

        if (accountType === 'asset') {
          totalAssets += balanceValue;
        } else if (accountType === 'liability') {
          totalLiabilities += balanceValue;
        } else if (accountType === 'equity') {
          totalEquity += balanceValue;
        }
      });

      const totalAssetsAndEquity = totalAssets;
      const totalPassiva = totalLiabilities + totalEquity;
      const difference = Math.abs(totalAssetsAndEquity - totalPassiva);

      if (difference > 0.01) { // Toleranz für Rundungsfehler
        warnings.push(
          `Bilanzgleichheit: Aktiva (${totalAssetsAndEquity.toFixed(2)}) ≠ Passiva (${totalPassiva.toFixed(2)}). Differenz: ${difference.toFixed(2)}`
        );
      }
    }

    const imported = balancesToUpsert.length;

    // Zusätzliche Validierungen nach dem Import
    const accountNumbersForValidation = validRows.map((row) => row.accountNumber);
    const validationResult = await this.validationService.validateAll(
      financialStatementId,
      accountNumbersForValidation,
    );

    // Kombiniere Validierungsfehler und -warnungen
    errors.push(...validationResult.errors);
    warnings.push(...validationResult.warnings);

    return { imported, errors, warnings };
  }

  private parseNumber(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'number') {
      return value;
    }
    const parsed = parseFloat(String(value).replace(',', '.'));
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Import Excel with custom column mapping from the wizard
   */
  async importExcelWithMapping(
    file: MulterFile,
    options: {
      financialStatementId: string;
      sheetName?: string;
      columnMapping: Record<string, string>; // excelColumn -> systemField
    },
  ): Promise<{ imported: number; errors: string[]; warnings: string[] }> {
    try {
      if (!file || !file.buffer) {
        throw new BadRequestException('Datei ist leer oder ungültig');
      }

      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new BadRequestException('Excel-Datei enthält keine Arbeitsblätter');
      }

      const sheetName = options.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new BadRequestException(`Arbeitsblatt "${sheetName}" nicht gefunden`);
      }

      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      if (!rawData || rawData.length === 0) {
        throw new BadRequestException('Excel-Datei enthält keine Daten');
      }

      // Reverse the mapping: systemField -> excelColumn
      const reverseMapping: Record<string, string> = {};
      for (const [excelCol, sysField] of Object.entries(options.columnMapping)) {
        reverseMapping[sysField] = excelCol;
      }

      // Validate required fields
      if (!reverseMapping.accountNumber) {
        throw new BadRequestException('Kontonummer-Spalte muss zugeordnet werden');
      }

      // Map rows using the custom mapping
      const data: ImportRow[] = [];
      const errors: string[] = [];

      rawData.forEach((row, index) => {
        try {
          const accountNumber = row[reverseMapping.accountNumber];
          if (!accountNumber) {
            errors.push(`Zeile ${index + 2}: Kontonummer fehlt`);
            return;
          }

          const importRow: ImportRow = {
            accountNumber: String(accountNumber).trim(),
            accountName: reverseMapping.accountName 
              ? String(row[reverseMapping.accountName] || '').trim() || undefined 
              : undefined,
            debit: reverseMapping.debit 
              ? this.parseNumber(row[reverseMapping.debit]) 
              : undefined,
            credit: reverseMapping.credit 
              ? this.parseNumber(row[reverseMapping.credit]) 
              : undefined,
            balance: reverseMapping.balance 
              ? this.parseNumber(row[reverseMapping.balance]) 
              : undefined,
            isIntercompany: reverseMapping.isIntercompany 
              ? this.parseBoolean(row[reverseMapping.isIntercompany]) 
              : undefined,
            company: reverseMapping.partnerCompanyId 
              ? String(row[reverseMapping.partnerCompanyId] || '').trim() || undefined 
              : undefined,
          };

          // Calculate balance if only debit/credit provided
          if (importRow.balance === undefined && (importRow.debit !== undefined || importRow.credit !== undefined)) {
            importRow.balance = (importRow.debit || 0) - (importRow.credit || 0);
          }

          data.push(importRow);
        } catch (error: any) {
          errors.push(`Zeile ${index + 2}: ${error.message}`);
        }
      });

      if (data.length === 0) {
        throw new BadRequestException('Keine gültigen Datenzeilen gefunden. ' + errors.join('; '));
      }

      const result = await this.processImportData(data, options.financialStatementId);
      return {
        ...result,
        errors: [...errors, ...result.errors],
        warnings: result.warnings || [],
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Fehler beim Verarbeiten der Excel-Datei: ${error.message}`);
    }
  }

  async getImportTemplate(): Promise<Buffer> {
    // Versuche das Konsolidierungs-Muster-Template zu laden
    const fs = require('fs');
    const path = require('path');
    
    // process.cwd() ist das Backend-Verzeichnis, also müssen wir ein Verzeichnis höher gehen
    // Versuche verschiedene Pfade - von Backend-Verzeichnis aus
    // Versuche zuerst Version 3.0, dann Fallback auf alte Version
    const templateNames = [
      'Konsolidierung_Muster_v3.0.xlsx',
      'Konsolidierung_Muster.xlsx', // Fallback für alte Version
    ];
    
    const basePaths = [
      path.join(process.cwd(), 'templates'), // Backend/templates (wichtigster Pfad für Deployment)
      path.join(process.cwd(), 'dist', 'templates'), // dist/templates (nach Build)
      path.join(process.cwd(), '..', 'templates'), // Root/templates (für lokale Entwicklung)
      path.join(__dirname, '..', '..', '..', 'templates'), // Von dist/modules/import aus
      path.join(__dirname, '..', '..', '..', '..', 'templates'), // Von dist aus
      path.join(__dirname, '..', '..', '..', '..', '..', 'templates'), // Von src/modules/import aus
    ];
    
    const possiblePaths: string[] = [];
    for (const basePath of basePaths) {
      for (const templateName of templateNames) {
        possiblePaths.push(path.join(basePath, templateName));
      }
    }
    
    console.log('Suche Template in folgenden Pfaden:');
    console.log('  process.cwd():', process.cwd());
    console.log('  __dirname:', __dirname);
    
    for (const templatePath of possiblePaths) {
      console.log(`  - ${templatePath}`);
      try {
        if (fs.existsSync(templatePath)) {
          const templateBuffer = fs.readFileSync(templatePath);
          console.log(`✓ Template gefunden unter: ${templatePath} (${templateBuffer.length} bytes)`);
          return templateBuffer;
        }
      } catch (error: any) {
        console.log(`  ✗ Fehler beim Zugriff: ${error.message}`);
      }
    }
    
    console.warn('Konsolidierungs-Template nicht gefunden, erstelle Standard-Template im Speicher');

    // Fallback: Erstelle eine einfache Excel-Vorlage mit EXACT column names from template
    // This matches the Python script template exactly
    const templateData = [
      {
        'Unternehmen': 'Mutterunternehmen H',
        'Kontonummer': '1000',
        'Kontoname': 'Kasse',
        'HGB-Position': 'B.IV',
        'Kontotyp': 'asset',
        'Soll': 1000,
        'Haben': 0,
        'Saldo': 1000,
        'Zwischengesellschaft': 'Nein',
        'Gegenpartei': '',
        'Bemerkung': '',
      },
      {
        'Unternehmen': 'Mutterunternehmen H',
        'Kontonummer': '2000',
        'Kontoname': 'Bank',
        'HGB-Position': 'B.IV',
        'Kontotyp': 'asset',
        'Soll': 5000,
        'Haben': 0,
        'Saldo': 5000,
        'Zwischengesellschaft': 'Nein',
        'Gegenpartei': '',
        'Bemerkung': '',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bilanzdaten');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}
