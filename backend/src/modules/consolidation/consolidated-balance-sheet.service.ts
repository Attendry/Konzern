import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CapitalConsolidationService } from './capital-consolidation.service';
import { DependencyIdentificationService } from '../company/dependency-identification.service';

export interface BalanceSheetPosition {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity';
  balance: number;
  companyId?: string;
  companyName?: string;
}

export interface ConsolidatedBalanceSheet {
  fiscalYear: number;
  periodStart: Date;
  periodEnd: Date;
  assets: {
    fixedAssets: BalanceSheetPosition[]; // Anlagevermögen
    currentAssets: BalanceSheetPosition[]; // Umlaufvermögen
    deferredTaxAssets: BalanceSheetPosition[]; // Aktive Rechnungsabgrenzungsposten
    goodwill: number; // Geschäfts- oder Firmenwert
    totalAssets: number;
  };
  liabilities: {
    equity: {
      parentCompany: BalanceSheetPosition[]; // Eigenkapital Mutterunternehmen
      minorityInterests: number; // Minderheitsanteile
      totalEquity: number;
    };
    provisions: BalanceSheetPosition[]; // Rückstellungen
    liabilities: BalanceSheetPosition[]; // Verbindlichkeiten
    deferredTaxLiabilities: BalanceSheetPosition[]; // Passive Rechnungsabgrenzungsposten
    totalLiabilities: number;
  };
  balanceValidation: {
    isBalanced: boolean;
    difference: number;
    errors: string[];
    warnings: string[];
  };
  consolidationSummary: {
    companiesIncluded: number;
    eliminationsApplied: number;
    totalEliminationAmount: number;
  };
}

@Injectable()
export class ConsolidatedBalanceSheetService {
  constructor(
    private supabaseService: SupabaseService,
    private capitalConsolidationService: CapitalConsolidationService,
    private dependencyService: DependencyIdentificationService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Erstellt die konsolidierte Bilanz
   */
  async createConsolidatedBalanceSheet(
    financialStatementId: string,
  ): Promise<ConsolidatedBalanceSheet> {
    // 1. Hole Financial Statement
    const { data: financialStatement, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('*, companies(*)')
      .eq('id', financialStatementId)
      .single();

    if (fsError || !financialStatement) {
      throw new BadRequestException(
        `Financial Statement mit ID ${financialStatementId} nicht gefunden`,
      );
    }

    // 2. Bestimme Konsolidierungskreis
    const consolidationCircle = await this.dependencyService.determineConsolidationCircle(
      financialStatement.company_id,
    );

    if (!consolidationCircle.consolidationRequired) {
      throw new BadRequestException(
        'Keine konsolidierungspflichtigen Tochterunternehmen gefunden',
      );
    }

    const allCompanyIds = [
      consolidationCircle.parentCompany.id,
      ...consolidationCircle.subsidiaries.map((s) => s.id),
    ];

    // 3. Lade alle Einzelbilanzen der konsolidierten Unternehmen
    const { data: allFinancialStatements, error: allFsError } = await this.supabase
      .from('financial_statements')
      .select('*, companies(*)')
      .in('company_id', allCompanyIds)
      .eq('fiscal_year', financialStatement.fiscal_year);

    if (allFsError) {
      throw new BadRequestException(
        `Fehler beim Abrufen der Einzelbilanzen: ${allFsError.message}`,
      );
    }

    // 4. Lade alle Account Balances für alle Financial Statements
    const financialStatementIds = (allFinancialStatements || []).map((fs: any) => fs.id);
    
    const { data: allBalances, error: balanceError } = await this.supabase
      .from('account_balances')
      .select('*, accounts(*), financial_statements!inner(company_id, companies(*))')
      .in('financial_statement_id', financialStatementIds);

    if (balanceError) {
      throw new BadRequestException(
        `Fehler beim Abrufen der Bilanzpositionen: ${balanceError.message}`,
      );
    }

    // 5. Lade alle Konsolidierungsbuchungen
    // CRITICAL: Specify exact foreign key relationship to avoid "more than one relationship" error
    // consolidation_entries has multiple FKs to accounts (account_id, debit_account_id, credit_account_id)
    const { data: consolidationEntries, error: entriesError } = await this.supabase
      .from('consolidation_entries')
      .select(`
        *,
        account:accounts!consolidation_entries_account_id_fkey(*),
        debit_account:accounts!consolidation_entries_debit_account_id_fkey(*),
        credit_account:accounts!consolidation_entries_credit_account_id_fkey(*)
      `)
      .eq('financial_statement_id', financialStatementId);

    if (entriesError) {
      throw new BadRequestException(
        `Fehler beim Abrufen der Konsolidierungsbuchungen: ${entriesError.message}`,
      );
    }

    // 6. Erstelle Map für konsolidierte Positionen
    const consolidatedPositions = new Map<string, BalanceSheetPosition>();

    // 7. Addiere alle Positionen aus Einzelbilanzen
    for (const balance of allBalances || []) {
      const account = balance.accounts;
      const fs = balance.financial_statements;

      if (!account) continue;

      const accountId = account.id;
      const balanceValue = parseFloat(balance.balance) || 0;

      if (consolidatedPositions.has(accountId)) {
        // Addiere zu bestehender Position
        const existing = consolidatedPositions.get(accountId)!;
        existing.balance += balanceValue;
      } else {
        // Neue Position
        consolidatedPositions.set(accountId, {
          accountId,
          accountNumber: account.account_number,
          accountName: account.name,
          accountType: account.account_type as 'asset' | 'liability' | 'equity',
          balance: balanceValue,
          companyId: fs?.company_id,
          companyName: fs?.companies?.name,
        });
      }
    }

    // 8. Wende Konsolidierungsbuchungen an
    let totalEliminationAmount = 0;
    for (const entry of consolidationEntries || []) {
      // Use account_id (primary account) or fallback to debit_account_id if account_id is null
      const accountId = entry.account_id || entry.debit_account_id;
      const adjustmentAmount = parseFloat(entry.amount) || 0;
      
      // Get account info from the embedded relationship
      const account = entry.account || entry.debit_account;

      if (accountId && consolidatedPositions.has(accountId)) {
        const position = consolidatedPositions.get(accountId)!;
        position.balance += adjustmentAmount; // adjustmentAmount ist bereits negativ bei Eliminierungen
        totalEliminationAmount += Math.abs(adjustmentAmount);
      } else if (accountId && account) {
        // Neue Position durch Konsolidierungsbuchung (z.B. Goodwill)
        consolidatedPositions.set(accountId, {
          accountId,
          accountNumber: account.account_number || '',
          accountName: account.name || entry.description || 'Konsolidierung',
          accountType: account.account_type as 'asset' | 'liability' | 'equity',
          balance: adjustmentAmount,
        });
      }
    }

    // 9. Hole Minderheitsanteile aus Kapitalkonsolidierung
    const capitalResult = await this.capitalConsolidationService.consolidateCapital(
      financialStatementId,
      financialStatement.company_id,
    );

    // 10. Strukturiere Bilanz nach HGB
    const assets: BalanceSheetPosition[] = [];
    const liabilities: BalanceSheetPosition[] = [];
    const equity: BalanceSheetPosition[] = [];
    let goodwill = 0;

    for (const position of consolidatedPositions.values()) {
      if (position.accountType === 'asset') {
        assets.push(position);
        // Goodwill identifizieren (vereinfacht - sollte aus separatem Konto kommen)
        if (position.accountName.toLowerCase().match(/goodwill|firmenwert|geschäftswert/i)) {
          goodwill += position.balance;
        }
      } else if (position.accountType === 'liability') {
        liabilities.push(position);
      } else if (position.accountType === 'equity') {
        // Nur Eigenkapital des Mutterunternehmens (nicht der Tochterunternehmen)
        if (position.companyId === financialStatement.company_id) {
          equity.push(position);
        }
      }
    }

    // 11. Gruppiere Aktiva nach HGB-Struktur
    // Anlagevermögen: typischerweise Konten 0000-0999 oder spezifische Konten
    const fixedAssets = assets.filter((a) => {
      const accountNum = a.accountNumber;
      const accountName = a.accountName.toLowerCase();
      return (
        accountNum.match(/^0[0-9]{3}/) ||
        accountNum.match(/^1[0-4][0-9]{2}/) || // Konten 1000-1499
        accountName.match(/anlage|fixed|immobilien|sachanlage/i)
      );
    });

    // Umlaufvermögen: typischerweise Konten 1500-1999
    const currentAssets = assets.filter((a) => {
      const accountNum = a.accountNumber;
      const accountName = a.accountName.toLowerCase();
      return (
        (accountNum.match(/^1[5-9][0-9]{2}/) || accountNum.match(/^2[0-9]{3}/)) &&
        !accountName.match(/anlage|fixed|immobilien|sachanlage/i)
      );
    });

    // Aktive Rechnungsabgrenzungsposten
    const deferredTaxAssets = assets.filter((a) =>
      a.accountName.toLowerCase().match(/rechnungsabgrenzung|deferred|aktive rap/i),
    );

    // 12. Gruppiere Passiva nach HGB-Struktur
    const provisions = liabilities.filter((a) =>
      a.accountNumber.match(/^2[0-9]{3}/) || a.accountName.toLowerCase().match(/rückstellung|provision/i),
    );
    const otherLiabilities = liabilities.filter(
      (a) =>
        !a.accountNumber.match(/^2[0-9]{3}/) &&
        !a.accountName.toLowerCase().match(/rückstellung|provision/i),
    );
    const deferredTaxLiabilities = liabilities.filter((a) =>
      a.accountName.toLowerCase().match(/rechnungsabgrenzung|deferred/i),
    );

    // 13. Berechne Summen
    const totalFixedAssets = fixedAssets.reduce((sum, a) => sum + a.balance, 0);
    const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + a.balance, 0);
    const totalDeferredTaxAssets = deferredTaxAssets.reduce((sum, a) => sum + a.balance, 0);
    const totalAssets = totalFixedAssets + totalCurrentAssets + totalDeferredTaxAssets + goodwill;

    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);
    const totalProvisions = provisions.reduce((sum, p) => sum + p.balance, 0);
    const totalOtherLiabilities = otherLiabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalDeferredTaxLiabilities = deferredTaxLiabilities.reduce(
      (sum, d) => sum + d.balance,
      0,
    );
    const totalLiabilities =
      totalEquity +
      capitalResult.minorityInterests +
      totalProvisions +
      totalOtherLiabilities +
      totalDeferredTaxLiabilities;

    // 14. Validiere Bilanzgleichheit
    const difference = Math.abs(totalAssets - totalLiabilities);
    const isBalanced = difference < 0.01; // Toleranz für Rundungsfehler

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isBalanced) {
      errors.push(
        `Bilanzgleichheit verletzt: Aktiva (${totalAssets.toFixed(2)}) ≠ Passiva (${totalLiabilities.toFixed(2)}). Differenz: ${difference.toFixed(2)}`,
      );
    } else if (difference > 0) {
      warnings.push(
        `Geringe Bilanzabweichung: ${difference.toFixed(2)} (möglicher Rundungsfehler)`,
      );
    }

    return {
      fiscalYear: financialStatement.fiscal_year,
      periodStart: new Date(financialStatement.period_start),
      periodEnd: new Date(financialStatement.period_end),
      assets: {
        fixedAssets,
        currentAssets,
        deferredTaxAssets,
        goodwill,
        totalAssets,
      },
      liabilities: {
        equity: {
          parentCompany: equity,
          minorityInterests: capitalResult.minorityInterests,
          totalEquity: totalEquity + capitalResult.minorityInterests,
        },
        provisions,
        liabilities: otherLiabilities,
        deferredTaxLiabilities,
        totalLiabilities,
      },
      balanceValidation: {
        isBalanced,
        difference,
        errors,
        warnings,
      },
      consolidationSummary: {
        companiesIncluded: allCompanyIds.length,
        eliminationsApplied: consolidationEntries?.length || 0,
        totalEliminationAmount,
      },
    };
  }

  /**
   * Validiert die Bilanzgleichheit
   */
  async validateBalanceEquality(
    financialStatementId: string,
  ): Promise<{
    isValid: boolean;
    totalAssets: number;
    totalLiabilities: number;
    difference: number;
    errors: string[];
    warnings: string[];
  }> {
    const balanceSheet = await this.createConsolidatedBalanceSheet(financialStatementId);

    return {
      isValid: balanceSheet.balanceValidation.isBalanced,
      totalAssets: balanceSheet.assets.totalAssets,
      totalLiabilities: balanceSheet.liabilities.totalLiabilities,
      difference: balanceSheet.balanceValidation.difference,
      errors: balanceSheet.balanceValidation.errors,
      warnings: balanceSheet.balanceValidation.warnings,
    };
  }
}
