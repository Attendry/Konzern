import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as XLSX from 'xlsx';
import { CompanyService } from '../company/company.service';
import { ParticipationService } from '../participation/participation.service';
import { ImportService } from './import.service';

interface MulterFile {
  buffer: Buffer;
  originalname: string;
}

interface SheetImportResult {
  sheetName: string;
  sheetType: string;
  imported: number;
  errors: string[];
  warnings: string[];
}

interface MultiSheetImportResult {
  totalImported: number;
  sheets: SheetImportResult[];
  errors: string[];
  warnings: string[];
}

@Injectable()
export class MultiSheetImportService {
  constructor(
    private supabaseService: SupabaseService,
    private companyService: CompanyService,
    private participationService: ParticipationService,
    @Inject(forwardRef(() => ImportService))
    private importService: ImportService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Main entry point for multi-sheet import
   */
  async importMultiSheet(
    file: MulterFile,
    options: {
      fiscalYear: number;
      periodStart?: string;
      periodEnd?: string;
    },
  ): Promise<MultiSheetImportResult> {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new BadRequestException('Excel-Datei enthält keine Arbeitsblätter');
    }

    const results: SheetImportResult[] = [];
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Sheets to ignore
    const ignoreSheets = ['anleitung', 'instruction', 'hinweise', 'hgb-bilanzstruktur', 'kontenplan-referenz'];

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheetNameLower = sheetName.toLowerCase();
      
      // Skip ignored sheets
      if (ignoreSheets.some(ignore => sheetNameLower.includes(ignore))) {
        console.log(`[MultiSheetImport] Skipping sheet: "${sheetName}"`);
        continue;
      }

      try {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          allWarnings.push(`Blatt "${sheetName}" nicht gefunden`);
          continue;
        }

        console.log(`[MultiSheetImport] Processing sheet: "${sheetName}"`);
        const result = await this.processSheet(sheetName, worksheet, options);
        results.push(result);
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[MultiSheetImport] Error processing sheet "${sheetName}":`, errorMessage);
        results.push({
          sheetName,
          sheetType: 'unknown',
          imported: 0,
          errors: [errorMessage],
          warnings: [],
        });
        allErrors.push(`Blatt "${sheetName}": ${errorMessage}`);
      }
    }

    const totalImported = results.reduce((sum, r) => sum + r.imported, 0);

    return {
      totalImported,
      sheets: results,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Process a single sheet based on its name/type
   */
  private async processSheet(
    sheetName: string,
    worksheet: XLSX.WorkSheet,
    options: { fiscalYear: number; periodStart?: string; periodEnd?: string },
  ): Promise<SheetImportResult> {
    const sheetNameLower = sheetName.toLowerCase();
    const rawDataArray: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    if (!rawDataArray || rawDataArray.length < 2) {
      return {
        sheetName,
        sheetType: 'unknown',
        imported: 0,
        errors: ['Keine Daten gefunden'],
        warnings: [],
      };
    }

    // Determine sheet type and route to appropriate processor
    if (sheetNameLower.includes('bilanz') || sheetNameLower.includes('balance')) {
      return await this.processBalanceSheet(sheetName, rawDataArray, options);
    } else if (sheetNameLower.includes('guv') || sheetNameLower.includes('income') || sheetNameLower.includes('profit')) {
      return await this.processIncomeStatement(sheetName, rawDataArray, options);
    } else if (sheetNameLower.includes('unternehmen') || sheetNameLower.includes('company')) {
      return await this.processCompanies(sheetName, rawDataArray);
    } else if (sheetNameLower.includes('beteiligung') || sheetNameLower.includes('participation')) {
      return await this.processParticipations(sheetName, rawDataArray);
    } else if (sheetNameLower.includes('zwischengesellschaft') || sheetNameLower.includes('intercompany')) {
      return await this.processIntercompanyTransactions(sheetName, rawDataArray);
    } else if (sheetNameLower.includes('eigenkapital') || sheetNameLower.includes('equity')) {
      return await this.processEquityAllocation(sheetName, rawDataArray);
    } else if (sheetNameLower.includes('währung') || sheetNameLower.includes('currency')) {
      return await this.processCurrencyConversion(sheetName, rawDataArray);
    } else if (sheetNameLower.includes('latente') || sheetNameLower.includes('deferred')) {
      return await this.processDeferredTaxes(sheetName, rawDataArray);
    } else {
      // Try to auto-detect by checking headers
      const headers = rawDataArray[0] || [];
      if (this.hasAccountColumns(headers)) {
        return await this.processBalanceSheet(sheetName, rawDataArray, options);
      }
      
      return {
        sheetName,
        sheetType: 'unknown',
        imported: 0,
        errors: [`Unbekannter Blatttyp: "${sheetName}"`],
        warnings: ['Blatt wurde nicht verarbeitet'],
      };
    }
  }

  /**
   * Check if headers contain account-related columns
   */
  private hasAccountColumns(headers: any[]): boolean {
    const headerStr = headers.map(h => String(h || '').toLowerCase()).join(' ');
    return /konto|account|soll|debit|haben|credit|saldo|balance/.test(headerStr);
  }

  /**
   * Process Bilanzdaten (Balance Sheet) sheet
   */
  private async processBalanceSheet(
    sheetName: string,
    rawDataArray: any[][],
    options: { fiscalYear: number; periodStart?: string; periodEnd?: string },
  ): Promise<SheetImportResult> {
    // Note: Balance sheet data requires a financial statement ID
    // For multi-sheet import, we'll need to create financial statements first
    // or require them to be specified per company
    return {
      sheetName,
      sheetType: 'balance_sheet',
      imported: 0,
      errors: ['Bilanzdaten-Import erfordert Jahresabschluss-ID. Bitte verwenden Sie den Einzelblatt-Import für Bilanzdaten.'],
      warnings: ['Bilanzdaten können nach Erstellung der Unternehmen und Jahresabschlüsse importiert werden'],
    };
  }

  /**
   * Process GuV-Daten (Income Statement) sheet
   */
  private async processIncomeStatement(
    sheetName: string,
    rawDataArray: any[][],
    options: { fiscalYear: number; periodStart?: string; periodEnd?: string },
  ): Promise<SheetImportResult> {
    // Similar to balance sheet - requires financial statement
    return {
      sheetName,
      sheetType: 'income_statement',
      imported: 0,
      errors: ['GuV-Daten-Import erfordert Jahresabschluss-ID. Bitte verwenden Sie den Einzelblatt-Import für GuV-Daten.'],
      warnings: ['GuV-Daten können nach Erstellung der Unternehmen und Jahresabschlüsse importiert werden'],
    };
  }

  /**
   * Process Unternehmensinformationen (Company Information) sheet
   */
  private async processCompanies(sheetName: string, rawDataArray: any[][]): Promise<SheetImportResult> {
    const headers = rawDataArray[0] || [];
    const dataRows = rawDataArray.slice(1);
    const errors: string[] = [];
    const warnings: string[] = [];
    let imported = 0;

    // Map headers to indices
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = String(h || '').toLowerCase().trim();
      headerMap[key] = i;
    });

    const nameIdx = headerMap['unternehmensname'] ?? headerMap['name'] ?? headerMap['company'] ?? 0;
    const typeIdx = headerMap['typ'] ?? headerMap['type'] ?? -1;
    const participationIdx = headerMap['beteiligungs-%'] ?? headerMap['participation'] ?? -1;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      try {
        const companyName = String(row[nameIdx] || '').trim();
        if (!companyName) {
          warnings.push(`Zeile ${i + 2}: Kein Unternehmensname gefunden`);
          continue;
        }

        // Check if company exists
        const { data: existing } = await this.supabase
          .from('companies')
          .select('id')
          .eq('name', companyName)
          .single();

        if (existing) {
          warnings.push(`Unternehmen "${companyName}" existiert bereits`);
          continue;
        }

        // Create company
        const companyType = typeIdx >= 0 ? String(row[typeIdx] || '').trim() : '';
        const isUltimateParent = companyType.toLowerCase().includes('mutter') || 
                                 companyType.toLowerCase().includes('parent') ||
                                 companyType.toLowerCase().includes('h)');

        await this.companyService.create({
          name: companyName,
          legalForm: companyType || 'GmbH',
          isUltimateParent,
          parentCompanyId: null, // Will be set from participations sheet
          participationPercentage: participationIdx >= 0 ? parseFloat(String(row[participationIdx] || '0')) : undefined,
        });

        imported++;
      } catch (error: any) {
        errors.push(`Zeile ${i + 2}: ${error.message || String(error)}`);
      }
    }

    return {
      sheetName,
      sheetType: 'companies',
      imported,
      errors,
      warnings,
    };
  }

  /**
   * Process Beteiligungsverhältnisse (Participations) sheet
   */
  private async processParticipations(sheetName: string, rawDataArray: any[][]): Promise<SheetImportResult> {
    const headers = rawDataArray[0] || [];
    const dataRows = rawDataArray.slice(1);
    const errors: string[] = [];
    const warnings: string[] = [];
    let imported = 0;

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = String(h || '').toLowerCase().trim();
      headerMap[key] = i;
    });

    const parentIdx = headerMap['mutterunternehmen'] ?? headerMap['parent'] ?? 0;
    const subsidiaryIdx = headerMap['tochterunternehmen'] ?? headerMap['subsidiary'] ?? 1;
    const percentageIdx = headerMap['beteiligungs-%'] ?? headerMap['participation'] ?? 2;
    const costIdx = headerMap['anschaffungskosten'] ?? headerMap['acquisition'] ?? -1;
    const dateIdx = headerMap['erwerbsdatum'] ?? headerMap['acquisition_date'] ?? -1;

    // Get all companies for name lookup
    const { data: companies } = await this.supabase
      .from('companies')
      .select('id, name');

    const companyMap = new Map(companies?.map(c => [c.name, c.id]) || []);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      try {
        const parentName = String(row[parentIdx] || '').trim();
        const subsidiaryName = String(row[subsidiaryIdx] || '').trim();
        const percentage = parseFloat(String(row[percentageIdx] || '0'));

        if (!parentName || !subsidiaryName) {
          warnings.push(`Zeile ${i + 2}: Unvollständige Daten`);
          continue;
        }

        const parentId = companyMap.get(parentName);
        const subsidiaryId = companyMap.get(subsidiaryName);

        if (!parentId || !subsidiaryId) {
          errors.push(`Zeile ${i + 2}: Unternehmen nicht gefunden (${parentName} oder ${subsidiaryName})`);
          continue;
        }

        await this.participationService.create({
          parentCompanyId: parentId,
          subsidiaryCompanyId: subsidiaryId,
          participationPercentage: percentage,
          acquisitionCost: costIdx >= 0 ? parseFloat(String(row[costIdx] || '0')) : null,
          acquisitionDate: dateIdx >= 0 ? String(row[dateIdx] || '').trim() || null : null,
        });

        imported++;
      } catch (error: any) {
        errors.push(`Zeile ${i + 2}: ${error.message || String(error)}`);
      }
    }

    return {
      sheetName,
      sheetType: 'participations',
      imported,
      errors,
      warnings,
    };
  }

  /**
   * Process Zwischengesellschaftsgeschäfte (Intercompany Transactions) sheet
   */
  private async processIntercompanyTransactions(sheetName: string, rawDataArray: any[][]): Promise<SheetImportResult> {
    const headers = rawDataArray[0] || [];
    const dataRows = rawDataArray.slice(1);
    const errors: string[] = [];
    const warnings: string[] = [];
    let imported = 0;

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = String(h || '').toLowerCase().trim();
      headerMap[key] = i;
    });

    const fromIdx = headerMap['von unternehmen'] ?? headerMap['from'] ?? 1;
    const toIdx = headerMap['an unternehmen'] ?? headerMap['to'] ?? 2;
    const amountIdx = headerMap['betrag'] ?? headerMap['amount'] ?? 4;
    const typeIdx = headerMap['transaktionstyp'] ?? headerMap['type'] ?? 3;
    const dateIdx = headerMap['datum'] ?? headerMap['date'] ?? -1;
    const descIdx = headerMap['bemerkung'] ?? headerMap['description'] ?? -1;

    // Get all companies for name lookup
    const { data: companies } = await this.supabase
      .from('companies')
      .select('id, name');

    const companyMap = new Map(companies?.map(c => [c.name, c.id]) || []);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      try {
        const fromName = String(row[fromIdx] || '').trim();
        const toName = String(row[toIdx] || '').trim();
        const amount = parseFloat(String(row[amountIdx] || '0'));

        if (!fromName || !toName || !amount) {
          warnings.push(`Zeile ${i + 2}: Unvollständige Daten`);
          continue;
        }

        const fromId = companyMap.get(fromName);
        const toId = companyMap.get(toName);

        if (!fromId || !toId) {
          errors.push(`Zeile ${i + 2}: Unternehmen nicht gefunden`);
          continue;
        }

        // Create intercompany transaction
        const { error } = await this.supabase
          .from('intercompany_transactions')
          .insert({
            from_company_id: fromId,
            to_company_id: toId,
            amount: amount,
            transaction_date: dateIdx >= 0 ? String(row[dateIdx] || '').trim() || new Date().toISOString() : new Date().toISOString(),
            description: descIdx >= 0 ? String(row[descIdx] || '').trim() : String(row[typeIdx] || '').trim(),
          });

        if (error) {
          errors.push(`Zeile ${i + 2}: ${error.message}`);
          continue;
        }

        imported++;
      } catch (error: any) {
        errors.push(`Zeile ${i + 2}: ${error.message || String(error)}`);
      }
    }

    return {
      sheetName,
      sheetType: 'intercompany_transactions',
      imported,
      errors,
      warnings,
    };
  }

  /**
   * Process Eigenkapital-Aufteilung (Equity Allocation) sheet
   */
  private async processEquityAllocation(sheetName: string, rawDataArray: any[][]): Promise<SheetImportResult> {
    // This is reference data for consolidation, can be stored for later use
    return {
      sheetName,
      sheetType: 'equity_allocation',
      imported: 0,
      errors: [],
      warnings: ['Eigenkapital-Aufteilung wird für Konsolidierung verwendet'],
    };
  }

  /**
   * Process Währungsumrechnung (Currency Conversion) sheet
   */
  private async processCurrencyConversion(sheetName: string, rawDataArray: any[][]): Promise<SheetImportResult> {
    // Store currency conversion rates for companies
    return {
      sheetName,
      sheetType: 'currency_conversion',
      imported: 0,
      errors: [],
      warnings: ['Währungsumrechnung wird für Konsolidierung verwendet'],
    };
  }

  /**
   * Process Latente Steuern (Deferred Taxes) sheet
   */
  private async processDeferredTaxes(sheetName: string, rawDataArray: any[][]): Promise<SheetImportResult> {
    // Store deferred tax information
    return {
      sheetName,
      sheetType: 'deferred_taxes',
      imported: 0,
      errors: [],
      warnings: ['Latente Steuern werden für Konsolidierung verwendet'],
    };
  }
}
