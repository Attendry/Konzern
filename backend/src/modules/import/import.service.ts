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

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Findet die Spaltenzuordnung basierend auf möglichen Spaltennamen
   */
  private findColumnMapping(headers: string[]): ColumnMapping {
    const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, '');
    
    const mapping: ColumnMapping = {
      accountNumber: [],
      accountName: [],
      debit: [],
      credit: [],
      balance: [],
      isIntercompany: [],
      company: [],
    };

    headers.forEach((header, index) => {
      const normalized = normalize(header);
      
      // Kontonummer
      if (normalized.match(/kontonummer|accountnumber|account_number|konto/i)) {
        mapping.accountNumber.push(header);
      }
      // Kontoname
      if (normalized.match(/kontoname|accountname|account_name|name/i)) {
        mapping.accountName.push(header);
      }
      // Soll
      if (normalized.match(/^soll$|debit/i)) {
        mapping.debit.push(header);
      }
      // Haben
      if (normalized.match(/^haben$|credit/i)) {
        mapping.credit.push(header);
      }
      // Saldo
      if (normalized.match(/saldo|balance|betrag/i)) {
        mapping.balance.push(header);
      }
      // Zwischengesellschaft
      if (normalized.match(/zwischengesellschaft|intercompany|is_intercompany/i)) {
        mapping.isIntercompany.push(header);
      }
      // Unternehmen
      if (normalized.match(/unternehmen|company|firma/i)) {
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

      const sheetName = importDataDto.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new BadRequestException(`Arbeitsblatt "${sheetName}" nicht gefunden. Verfügbare Blätter: ${workbook.SheetNames.join(', ')}`);
      }

      // Erste Zeile für Spaltenzuordnung
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      if (!rawData || rawData.length === 0) {
        throw new BadRequestException('Excel-Datei enthält keine Daten');
      }

      // Spaltenzuordnung ermitteln
      const headers = Object.keys(rawData[0] || {});
      if (headers.length === 0) {
        throw new BadRequestException('Excel-Datei enthält keine Spaltenüberschriften');
      }

      const columnMapping = this.findColumnMapping(headers);
      
      // Validierung: Mindestens Kontonummer muss vorhanden sein
      if (columnMapping.accountNumber.length === 0) {
        throw new BadRequestException(
          `Keine Kontonummer-Spalte gefunden. Erwartete Spaltennamen: Kontonummer, AccountNumber, Account_Number, Konto`
        );
      }

      // Mappe alle Zeilen
      const data: ImportRow[] = [];
      const errors: string[] = [];
      
      rawData.forEach((row, index) => {
        try {
          const mappedRow = this.mapExcelRow(row, columnMapping);
          data.push(mappedRow);
        } catch (error) {
          errors.push(`Zeile ${index + 2}: ${error.message}`);
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
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Fehler beim Lesen der Excel-Datei: ${error.message}`);
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
          } catch (error) {
            parseErrors.push(`Zeile ${rowIndex + 1}: ${error.message}`);
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

    // Fallback: Erstelle eine einfache Excel-Vorlage
    const templateData = [
      {
        Unternehmen: 'Mutterunternehmen H',
        Kontonummer: '1000',
        Kontoname: 'Kasse',
        Soll: 1000,
        Haben: 0,
        Saldo: 1000,
        Zwischengesellschaft: false,
      },
      {
        Unternehmen: 'Mutterunternehmen H',
        Kontonummer: '2000',
        Kontoname: 'Bank',
        Soll: 5000,
        Haben: 0,
        Saldo: 5000,
        Zwischengesellschaft: false,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bilanzdaten');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}
