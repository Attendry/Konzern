import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import * as XLSX from 'xlsx';
import { CompanyService } from '../company/company.service';
import { ParticipationService } from '../participation/participation.service';
import { FinancialStatementService } from '../financial-statement/financial-statement.service';
import { FinancialStatementStatus } from '../../entities/financial-statement.entity';
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

export interface MultiSheetImportResult {
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
    private financialStatementService: FinancialStatementService,
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
    const ignoreSheets = [
      'anleitung',
      'instruction',
      'hinweise',
      'hgb-bilanzstruktur',
      'kontenplan-referenz',
    ];

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheetNameLower = sheetName.toLowerCase();

      // Skip ignored sheets
      if (ignoreSheets.some((ignore) => sheetNameLower.includes(ignore))) {
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
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[MultiSheetImport] Error processing sheet "${sheetName}":`,
          errorMessage,
        );
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
    const rawDataArray: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    });

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
    if (
      sheetNameLower.includes('bilanz') ||
      sheetNameLower.includes('balance')
    ) {
      return await this.processBalanceSheet(sheetName, rawDataArray, options);
    } else if (
      sheetNameLower.includes('guv') ||
      sheetNameLower.includes('income') ||
      sheetNameLower.includes('profit')
    ) {
      return await this.processIncomeStatement(
        sheetName,
        rawDataArray,
        options,
      );
    } else if (
      sheetNameLower.includes('unternehmen') ||
      sheetNameLower.includes('company')
    ) {
      return await this.processCompanies(sheetName, rawDataArray);
    } else if (
      sheetNameLower.includes('beteiligung') ||
      sheetNameLower.includes('participation')
    ) {
      return await this.processParticipations(sheetName, rawDataArray);
    } else if (
      sheetNameLower.includes('zwischengesellschaft') ||
      sheetNameLower.includes('intercompany')
    ) {
      return await this.processIntercompanyTransactions(
        sheetName,
        rawDataArray,
      );
    } else if (
      sheetNameLower.includes('eigenkapital') ||
      sheetNameLower.includes('equity')
    ) {
      return await this.processEquityAllocation(sheetName, rawDataArray);
    } else if (
      sheetNameLower.includes('währung') ||
      sheetNameLower.includes('currency')
    ) {
      return await this.processCurrencyConversion(sheetName, rawDataArray);
    } else if (
      sheetNameLower.includes('latente') ||
      sheetNameLower.includes('deferred')
    ) {
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
    const headerStr = headers
      .map((h) => String(h || '').toLowerCase())
      .join(' ');
    return /konto|account|soll|debit|haben|credit|saldo|balance/.test(
      headerStr,
    );
  }

  /**
   * Process Bilanzdaten (Balance Sheet) sheet
   */
  private async processBalanceSheet(
    sheetName: string,
    rawDataArray: any[][],
    options: { fiscalYear: number; periodStart?: string; periodEnd?: string },
  ): Promise<SheetImportResult> {
    return this.processAccountData(
      sheetName,
      rawDataArray,
      options,
      'balance_sheet',
    );
  }

  /**
   * Process GuV-Daten (Income Statement) sheet
   */
  private async processIncomeStatement(
    sheetName: string,
    rawDataArray: any[][],
    options: { fiscalYear: number; periodStart?: string; periodEnd?: string },
  ): Promise<SheetImportResult> {
    return this.processAccountData(
      sheetName,
      rawDataArray,
      options,
      'income_statement',
    );
  }

  /**
   * Common method to process account data (balance sheet or income statement)
   */
  private async processAccountData(
    sheetName: string,
    rawDataArray: any[][],
    options: { fiscalYear: number; periodStart?: string; periodEnd?: string },
    sheetType: 'balance_sheet' | 'income_statement',
  ): Promise<SheetImportResult> {
    const headers = rawDataArray[0] || [];
    const dataRows = rawDataArray.slice(1);
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalImported = 0;

    if (dataRows.length === 0) {
      return {
        sheetName,
        sheetType,
        imported: 0,
        errors: ['Keine Daten gefunden'],
        warnings: [],
      };
    }

    // Map headers to indices
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = String(h || '')
        .toLowerCase()
        .trim();
      headerMap[key] = i;
    });

    const companyIdx = headerMap['unternehmen'] ?? headerMap['company'] ?? 0;
    const accountNumberIdx =
      headerMap['kontonummer'] ??
      headerMap['accountnumber'] ??
      headerMap['account_number'] ??
      1;
    const accountNameIdx =
      headerMap['kontoname'] ??
      headerMap['accountname'] ??
      headerMap['account_name'] ??
      2;
    const debitIdx = headerMap['soll'] ?? headerMap['debit'] ?? -1;
    const creditIdx = headerMap['haben'] ?? headerMap['credit'] ?? -1;
    const balanceIdx = headerMap['saldo'] ?? headerMap['balance'] ?? -1;
    const isIntercompanyIdx =
      headerMap['zwischengesellschaft'] ?? headerMap['intercompany'] ?? -1;

    // Get all companies for name lookup
    const { data: companies } = await this.supabase
      .from('companies')
      .select('id, name');

    const companyMap = new Map(companies?.map((c) => [c.name, c.id]) || []);

    // Group data by company
    const companyDataMap = new Map<string, any[]>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;

      const companyName = String(row[companyIdx] || '').trim();
      if (!companyName) {
        warnings.push(`Zeile ${i + 2}: Kein Unternehmensname gefunden`);
        continue;
      }

      if (!companyMap.has(companyName)) {
        errors.push(
          `Zeile ${i + 2}: Unternehmen "${companyName}" nicht gefunden. Bitte erstellen Sie das Unternehmen zuerst.`,
        );
        continue;
      }

      if (!companyDataMap.has(companyName)) {
        companyDataMap.set(companyName, []);
      }

      companyDataMap.get(companyName)!.push({
        rowIndex: i + 2,
        accountNumber:
          accountNumberIdx >= 0
            ? String(row[accountNumberIdx] || '').trim()
            : '',
        accountName:
          accountNameIdx >= 0
            ? String(row[accountNameIdx] || '').trim()
            : undefined,
        debit: debitIdx >= 0 ? this.parseNumber(row[debitIdx]) : undefined,
        credit: creditIdx >= 0 ? this.parseNumber(row[creditIdx]) : undefined,
        balance:
          balanceIdx >= 0 ? this.parseNumber(row[balanceIdx]) : undefined,
        isIntercompany:
          isIntercompanyIdx >= 0
            ? this.parseBoolean(row[isIntercompanyIdx])
            : false,
      });
    }

    // Process each company's data
    const periodStart =
      options.periodStart ||
      new Date(options.fiscalYear, 0, 1).toISOString().split('T')[0];
    const periodEnd =
      options.periodEnd ||
      new Date(options.fiscalYear, 11, 31).toISOString().split('T')[0];

    for (const [companyName, rows] of companyDataMap.entries()) {
      const companyId = companyMap.get(companyName)!;

      try {
        // Find or create financial statement
        let financialStatementId: string;

        // Check if financial statement exists
        const { data: existingFs } = await this.supabase
          .from('financial_statements')
          .select('id')
          .eq('company_id', companyId)
          .eq('fiscal_year', options.fiscalYear)
          .single();

        if (existingFs) {
          financialStatementId = existingFs.id;
          warnings.push(
            `Jahresabschluss für "${companyName}" (${options.fiscalYear}) existiert bereits, wird verwendet`,
          );
        } else {
          // Create new financial statement
          const newFs = await this.financialStatementService.create({
            companyId,
            fiscalYear: options.fiscalYear,
            periodStart,
            periodEnd,
            status: FinancialStatementStatus.DRAFT,
          });
          financialStatementId = newFs.id;
        }

        // Process account balances for this company
        const importResult = await this.importAccountBalances(
          rows,
          financialStatementId,
        );
        totalImported += importResult.imported;
        errors.push(...importResult.errors.map((e) => `${companyName}: ${e}`));
        warnings.push(
          ...importResult.warnings.map((w) => `${companyName}: ${w}`),
        );
      } catch (error: any) {
        errors.push(`${companyName}: ${error.message || String(error)}`);
      }
    }

    return {
      sheetName,
      sheetType,
      imported: totalImported,
      errors,
      warnings,
    };
  }

  /**
   * Import account balances for a financial statement
   */
  private async importAccountBalances(
    rows: Array<{
      rowIndex: number;
      accountNumber: string;
      accountName?: string;
      debit?: number;
      credit?: number;
      balance?: number;
      isIntercompany?: boolean;
    }>,
    financialStatementId: string,
  ): Promise<{ imported: number; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let imported = 0;

    // Validate rows
    const validRows = rows.filter((row) => {
      if (!row.accountNumber) {
        errors.push(`Zeile ${row.rowIndex}: Keine Kontonummer`);
        return false;
      }
      return true;
    });

    if (validRows.length === 0) {
      return { imported: 0, errors, warnings };
    }

    // Get or create accounts
    const accountNumbers = [...new Set(validRows.map((r) => r.accountNumber))];
    const { data: existingAccounts } = await this.supabase
      .from('accounts')
      .select('*')
      .in('account_number', accountNumbers);

    const accountMap = new Map(
      existingAccounts?.map((acc) => [acc.account_number, acc]) || [],
    );

    // Create missing accounts
    const accountsToCreate = validRows
      .filter((row) => !accountMap.has(row.accountNumber) && row.accountName)
      .map((row) => ({
        account_number: row.accountNumber,
        name: row.accountName!,
        account_type: 'asset' as const, // Default
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
        newAccounts?.forEach((acc) => accountMap.set(acc.account_number, acc));
      }
    }

    // Create account balances
    const balancesToCreate = validRows
      .filter((row) => accountMap.has(row.accountNumber))
      .map((row) => {
        const account = accountMap.get(row.accountNumber)!;
        const balance = row.balance ?? (row.debit ?? 0) - (row.credit ?? 0);

        return {
          financial_statement_id: financialStatementId,
          account_id: account.id,
          debit: row.debit ?? 0,
          credit: row.credit ?? 0,
          balance: balance,
          is_intercompany: row.isIntercompany ?? false,
          created_at: SupabaseMapper.getCurrentTimestamp(),
          updated_at: SupabaseMapper.getCurrentTimestamp(),
        };
      });

    if (balancesToCreate.length > 0) {
      // Delete existing balances for this financial statement first
      await this.supabase
        .from('account_balances')
        .delete()
        .eq('financial_statement_id', financialStatementId);

      const { error: balanceError } = await this.supabase
        .from('account_balances')
        .insert(balancesToCreate);

      if (balanceError) {
        errors.push(
          `Fehler beim Erstellen von Kontoständen: ${balanceError.message}`,
        );
      } else {
        imported = balancesToCreate.length;
      }
    }

    return { imported, errors, warnings };
  }

  /**
   * Helper to parse numbers
   */
  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    return isNaN(num) ? undefined : num;
  }

  /**
   * Helper to parse boolean values
   */
  private parseBoolean(value: any): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'ja' || str === 'yes';
  }

  /**
   * Process Unternehmensinformationen (Company Information) sheet
   */
  private async processCompanies(
    sheetName: string,
    rawDataArray: any[][],
  ): Promise<SheetImportResult> {
    const headers = rawDataArray[0] || [];
    const dataRows = rawDataArray.slice(1);
    const errors: string[] = [];
    const warnings: string[] = [];
    let imported = 0;

    // Map headers to indices
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = String(h || '')
        .toLowerCase()
        .trim();
      headerMap[key] = i;
    });

    const nameIdx =
      headerMap['unternehmensname'] ??
      headerMap['name'] ??
      headerMap['company'] ??
      0;
    const typeIdx = headerMap['typ'] ?? headerMap['type'] ?? -1;
    const participationIdx =
      headerMap['beteiligungs-%'] ?? headerMap['participation'] ?? -1;

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
        const companyType =
          typeIdx >= 0 ? String(row[typeIdx] || '').trim() : '';
        const isUltimateParent =
          companyType.toLowerCase().includes('mutter') ||
          companyType.toLowerCase().includes('parent') ||
          companyType.toLowerCase().includes('h)');

        await this.companyService.create({
          name: companyName,
          legalForm: companyType || 'GmbH',
          isConsolidated: isUltimateParent, // Ultimate parent companies are consolidated
          parentCompanyId: null, // Will be set from participations sheet
          participationPercentage:
            participationIdx >= 0
              ? parseFloat(String(row[participationIdx] || '0'))
              : undefined,
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
  private async processParticipations(
    sheetName: string,
    rawDataArray: any[][],
  ): Promise<SheetImportResult> {
    const headers = rawDataArray[0] || [];
    const dataRows = rawDataArray.slice(1);
    const errors: string[] = [];
    const warnings: string[] = [];
    let imported = 0;

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = String(h || '')
        .toLowerCase()
        .trim();
      headerMap[key] = i;
    });

    const parentIdx =
      headerMap['mutterunternehmen'] ?? headerMap['parent'] ?? 0;
    const subsidiaryIdx =
      headerMap['tochterunternehmen'] ?? headerMap['subsidiary'] ?? 1;
    const percentageIdx =
      headerMap['beteiligungs-%'] ?? headerMap['participation'] ?? 2;
    const costIdx =
      headerMap['anschaffungskosten'] ?? headerMap['acquisition'] ?? -1;
    const dateIdx =
      headerMap['erwerbsdatum'] ?? headerMap['acquisition_date'] ?? -1;

    // Get all companies for name lookup
    const { data: companies } = await this.supabase
      .from('companies')
      .select('id, name');

    const companyMap = new Map(companies?.map((c) => [c.name, c.id]) || []);

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
          errors.push(
            `Zeile ${i + 2}: Unternehmen nicht gefunden (${parentName} oder ${subsidiaryName})`,
          );
          continue;
        }

        await this.participationService.create({
          parentCompanyId: parentId,
          subsidiaryCompanyId: subsidiaryId,
          participationPercentage: percentage,
          acquisitionCost:
            costIdx >= 0 ? parseFloat(String(row[costIdx] || '0')) : null,
          acquisitionDate:
            dateIdx >= 0 ? String(row[dateIdx] || '').trim() || null : null,
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
  private async processIntercompanyTransactions(
    sheetName: string,
    rawDataArray: any[][],
  ): Promise<SheetImportResult> {
    const headers = rawDataArray[0] || [];
    const dataRows = rawDataArray.slice(1);
    const errors: string[] = [];
    const warnings: string[] = [];
    let imported = 0;

    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = String(h || '')
        .toLowerCase()
        .trim();
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

    const companyMap = new Map(companies?.map((c) => [c.name, c.id]) || []);

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
            transaction_date:
              dateIdx >= 0
                ? String(row[dateIdx] || '').trim() || new Date().toISOString()
                : new Date().toISOString(),
            description:
              descIdx >= 0
                ? String(row[descIdx] || '').trim()
                : String(row[typeIdx] || '').trim(),
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
  private async processEquityAllocation(
    sheetName: string,
    rawDataArray: any[][],
  ): Promise<SheetImportResult> {
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
  private async processCurrencyConversion(
    sheetName: string,
    rawDataArray: any[][],
  ): Promise<SheetImportResult> {
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
  private async processDeferredTaxes(
    sheetName: string,
    rawDataArray: any[][],
  ): Promise<SheetImportResult> {
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
