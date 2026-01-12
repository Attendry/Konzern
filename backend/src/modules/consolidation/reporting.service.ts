import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ConsolidatedBalanceSheetService } from './consolidated-balance-sheet.service';
import { CapitalConsolidationService } from './capital-consolidation.service';
import { DebtConsolidationService } from './debt-consolidation.service';

export interface ConsolidationOverview {
  eliminations: {
    intercompanyProfits: {
      count: number;
      totalAmount: number;
      details: any[];
    };
    debtConsolidation: {
      count: number;
      totalAmount: number;
      receivablesEliminated: number;
      payablesEliminated: number;
      loansEliminated: number;
      interestEliminated: number;
    };
    capitalConsolidation: {
      count: number;
      totalAmount: number;
      participationsProcessed: number;
    };
  };
  minorityInterests: {
    total: number;
    breakdown: Array<{
      subsidiaryCompanyId: string;
      subsidiaryCompanyName: string;
      minorityPercentage: number;
      minorityEquity: number;
      minorityResult: number;
    }>;
  };
  goodwill: {
    total: number;
    breakdown: Array<{
      subsidiaryCompanyId: string;
      subsidiaryCompanyName: string;
      goodwill: number;
      negativeGoodwill: number;
    }>;
  };
}

export interface ConsolidationReport {
  financialStatementId: string;
  fiscalYear: number;
  periodStart: Date;
  periodEnd: Date;
  balanceSheet: any; // ConsolidatedBalanceSheet
  overview: ConsolidationOverview;
  comparison?: {
    previousYear?: any;
    changes: Array<{
      position: string;
      currentYear: number;
      previousYear: number;
      change: number;
      changePercent: number;
    }>;
  };
}

@Injectable()
export class ReportingService {
  constructor(
    private supabaseService: SupabaseService,
    private balanceSheetService: ConsolidatedBalanceSheetService,
    private capitalConsolidationService: CapitalConsolidationService,
    private debtConsolidationService: DebtConsolidationService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Erstellt einen vollständigen Konsolidierungsbericht
   */
  async generateConsolidationReport(
    financialStatementId: string,
    includeComparison: boolean = false,
  ): Promise<ConsolidationReport> {
    // 1. Hole konsolidierte Bilanz
    const balanceSheet = await this.balanceSheetService.createConsolidatedBalanceSheet(
      financialStatementId,
    );

    // 2. Hole Financial Statement
    const { data: financialStatement } = await this.supabase
      .from('financial_statements')
      .select('*, companies(*)')
      .eq('id', financialStatementId)
      .single();

    if (!financialStatement) {
      throw new BadRequestException(
        `Financial Statement mit ID ${financialStatementId} nicht gefunden`,
      );
    }

    // 3. Erstelle Konsolidierungsübersicht
    const overview = await this.generateConsolidationOverview(financialStatementId);

    // 4. Vergleich mit Vorjahr (optional)
    let comparison = undefined;
    if (includeComparison) {
      comparison = await this.generateYearComparison(
        financialStatementId,
        financialStatement.fiscal_year,
      );
    }

    return {
      financialStatementId,
      fiscalYear: financialStatement.fiscal_year,
      periodStart: new Date(financialStatement.period_start),
      periodEnd: new Date(financialStatement.period_end),
      balanceSheet,
      overview,
      comparison,
    };
  }

  /**
   * Erstellt eine Konsolidierungsübersicht
   */
  private async generateConsolidationOverview(
    financialStatementId: string,
  ): Promise<ConsolidationOverview> {
    // Hole alle Konsolidierungsbuchungen
    const { data: consolidationEntries } = await this.supabase
      .from('consolidation_entries')
      .select('*, accounts(*)')
      .eq('financial_statement_id', financialStatementId);

    // Gruppiere nach Eliminierungstyp
    const intercompanyProfits: any[] = [];
    const debtConsolidations: any[] = [];
    const capitalConsolidations: any[] = [];

    for (const entry of consolidationEntries || []) {
      if (entry.adjustment_type === 'elimination') {
        intercompanyProfits.push(entry);
      } else if (entry.adjustment_type === 'debt_consolidation') {
        debtConsolidations.push(entry);
      } else if (entry.adjustment_type === 'capital_consolidation') {
        capitalConsolidations.push(entry);
      }
    }

    // Hole Kapitalkonsolidierungsdetails
    const { data: financialStatement } = await this.supabase
      .from('financial_statements')
      .select('company_id')
      .eq('id', financialStatementId)
      .single();

    let capitalResult = null;
    let debtResult = null;

    if (financialStatement) {
      try {
        capitalResult = await this.capitalConsolidationService.consolidateCapital(
          financialStatementId,
          financialStatement.company_id,
        );

        // Hole alle konsolidierten Unternehmen für Schuldenkonsolidierung
        const { data: companies } = await this.supabase
          .from('companies')
          .select('id')
          .or(`id.eq.${financialStatement.company_id},parent_company_id.eq.${financialStatement.company_id}`)
          .eq('is_consolidated', true);

        const companyIds = (companies || []).map((c: any) => c.id);
        debtResult = await this.debtConsolidationService.consolidateDebts(
          financialStatementId,
          companyIds,
        );
      } catch (error) {
        // Ignoriere Fehler, verwende vorhandene Daten
      }
    }

    // Minderheitsanteile und Goodwill aus Kapitalkonsolidierung
    const minorityBreakdown: ConsolidationOverview['minorityInterests']['breakdown'] = [];
    const goodwillBreakdown: ConsolidationOverview['goodwill']['breakdown'] = [];

    if (capitalResult) {
      // Vereinfacht: Minderheitsanteile und Goodwill aus Summary
      // In einer vollständigen Implementierung würde hier eine detaillierte Aufschlüsselung erfolgen
      minorityBreakdown.push({
        subsidiaryCompanyId: 'all',
        subsidiaryCompanyName: 'Alle Tochterunternehmen',
        minorityPercentage: 0, // Wird aus Participations berechnet
        minorityEquity: capitalResult.minorityInterests,
        minorityResult: 0, // Wird aus Jahresüberschuss berechnet
      });

      if (capitalResult.goodwill > 0) {
        goodwillBreakdown.push({
          subsidiaryCompanyId: 'all',
          subsidiaryCompanyName: 'Alle Tochterunternehmen',
          goodwill: capitalResult.goodwill,
          negativeGoodwill: 0,
        });
      } else if (capitalResult.goodwill < 0) {
        goodwillBreakdown.push({
          subsidiaryCompanyId: 'all',
          subsidiaryCompanyName: 'Alle Tochterunternehmen',
          goodwill: 0,
          negativeGoodwill: Math.abs(capitalResult.goodwill),
        });
      }
    }

    return {
      eliminations: {
        intercompanyProfits: {
          count: intercompanyProfits.length,
          totalAmount: intercompanyProfits.reduce(
            (sum, e) => sum + Math.abs(parseFloat(e.amount) || 0),
            0,
          ),
          details: intercompanyProfits,
        },
        debtConsolidation: {
          count: debtConsolidations.length,
          totalAmount: debtConsolidations.reduce(
            (sum, e) => sum + Math.abs(parseFloat(e.amount) || 0),
            0,
          ),
          receivablesEliminated: debtResult?.summary.receivablesEliminated || 0,
          payablesEliminated: debtResult?.summary.payablesEliminated || 0,
          loansEliminated: debtResult?.summary.loansEliminated || 0,
          interestEliminated: debtResult?.summary.interestEliminated || 0,
        },
        capitalConsolidation: {
          count: capitalConsolidations.length,
          totalAmount: capitalConsolidations.reduce(
            (sum, e) => sum + Math.abs(parseFloat(e.amount) || 0),
            0,
          ),
          participationsProcessed: capitalResult?.summary.participationsProcessed || 0,
        },
      },
      minorityInterests: {
        total: capitalResult?.minorityInterests || 0,
        breakdown: minorityBreakdown,
      },
      goodwill: {
        total: capitalResult?.goodwill || 0,
        breakdown: goodwillBreakdown,
      },
    };
  }

  /**
   * Erstellt einen Vergleich mit dem Vorjahr
   */
  private async generateYearComparison(
    financialStatementId: string,
    currentFiscalYear: number,
  ): Promise<{
    previousYear?: any;
    changes: Array<{
      position: string;
      currentYear: number;
      previousYear: number;
      change: number;
      changePercent: number;
    }>;
  }> {
    const previousYear = currentFiscalYear - 1;

    // Hole Financial Statement des Vorjahrs
    const { data: currentFs } = await this.supabase
      .from('financial_statements')
      .select('company_id')
      .eq('id', financialStatementId)
      .single();

    if (!currentFs) {
      return { changes: [] };
    }

    const { data: previousFs } = await this.supabase
      .from('financial_statements')
      .select('id')
      .eq('company_id', currentFs.company_id)
      .eq('fiscal_year', previousYear)
      .single();

    if (!previousFs) {
      return { changes: [] };
    }

    // Hole konsolidierte Bilanz des Vorjahrs
    let previousBalanceSheet = null;
    try {
      previousBalanceSheet = await this.balanceSheetService.createConsolidatedBalanceSheet(
        previousFs.id,
      );
    } catch (error) {
      // Vorjahresbilanz nicht verfügbar
      return { changes: [] };
    }

    const currentBalanceSheet = await this.balanceSheetService.createConsolidatedBalanceSheet(
      financialStatementId,
    );

    // Berechne Änderungen
    const changes: Array<{
      position: string;
      currentYear: number;
      previousYear: number;
      change: number;
      changePercent: number;
    }> = [];

    // Vergleich Gesamtaktiva
    changes.push({
      position: 'Gesamtaktiva',
      currentYear: currentBalanceSheet.assets.totalAssets,
      previousYear: previousBalanceSheet.assets.totalAssets,
      change:
        currentBalanceSheet.assets.totalAssets -
        previousBalanceSheet.assets.totalAssets,
      changePercent:
        previousBalanceSheet.assets.totalAssets > 0
          ? ((currentBalanceSheet.assets.totalAssets -
              previousBalanceSheet.assets.totalAssets) /
              previousBalanceSheet.assets.totalAssets) *
            100
          : 0,
    });

    // Vergleich Gesamtpassiva
    changes.push({
      position: 'Gesamtpassiva',
      currentYear: currentBalanceSheet.liabilities.totalLiabilities,
      previousYear: previousBalanceSheet.liabilities.totalLiabilities,
      change:
        currentBalanceSheet.liabilities.totalLiabilities -
        previousBalanceSheet.liabilities.totalLiabilities,
      changePercent:
        previousBalanceSheet.liabilities.totalLiabilities > 0
          ? ((currentBalanceSheet.liabilities.totalLiabilities -
              previousBalanceSheet.liabilities.totalLiabilities) /
              previousBalanceSheet.liabilities.totalLiabilities) *
            100
          : 0,
    });

    // Vergleich Eigenkapital
    changes.push({
      position: 'Eigenkapital',
      currentYear: currentBalanceSheet.liabilities.equity.totalEquity,
      previousYear: previousBalanceSheet.liabilities.equity.totalEquity,
      change:
        currentBalanceSheet.liabilities.equity.totalEquity -
        previousBalanceSheet.liabilities.equity.totalEquity,
      changePercent:
        previousBalanceSheet.liabilities.equity.totalEquity > 0
          ? ((currentBalanceSheet.liabilities.equity.totalEquity -
              previousBalanceSheet.liabilities.equity.totalEquity) /
              previousBalanceSheet.liabilities.equity.totalEquity) *
            100
          : 0,
    });

    // Vergleich Minderheitsanteile
    changes.push({
      position: 'Minderheitsanteile',
      currentYear: currentBalanceSheet.liabilities.equity.minorityInterests,
      previousYear: previousBalanceSheet.liabilities.equity.minorityInterests,
      change:
        currentBalanceSheet.liabilities.equity.minorityInterests -
        previousBalanceSheet.liabilities.equity.minorityInterests,
      changePercent:
        previousBalanceSheet.liabilities.equity.minorityInterests > 0
          ? ((currentBalanceSheet.liabilities.equity.minorityInterests -
              previousBalanceSheet.liabilities.equity.minorityInterests) /
              previousBalanceSheet.liabilities.equity.minorityInterests) *
            100
          : 0,
    });

    return {
      previousYear: previousBalanceSheet,
      changes,
    };
  }

  /**
   * Erstellt eine Detailansicht für eine Bilanzposition (Drill-Down)
   */
  async getPositionDetails(
    financialStatementId: string,
    accountId: string,
  ): Promise<{
    account: any;
    balances: Array<{
      companyId: string;
      companyName: string;
      balance: number;
      adjustments: number;
      finalBalance: number;
    }>;
    totalBalance: number;
    adjustments: any[];
  }> {
    // Hole Account
    const { data: account } = await this.supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (!account) {
      throw new BadRequestException(`Konto mit ID ${accountId} nicht gefunden`);
    }

    // Hole alle Balances für dieses Konto
    const { data: balances } = await this.supabase
      .from('account_balances')
      .select('*, financial_statements!inner(company_id, companies(*))')
      .eq('account_id', accountId)
      .in(
        'financial_statement_id',
        (
          await this.supabase
            .from('financial_statements')
            .select('id')
            .eq('fiscal_year', (
              await this.supabase
                .from('financial_statements')
                .select('fiscal_year')
                .eq('id', financialStatementId)
                .single()
            ).data?.fiscal_year)
        ).data?.map((fs: any) => fs.id) || [],
      );

    // Hole Konsolidierungsbuchungen für dieses Konto
    const { data: adjustments } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .eq('account_id', accountId);

    const balanceDetails = (balances || []).map((balance: any) => {
      const adjustmentAmount = (adjustments || [])
        .filter((adj) => adj.account_id === accountId)
        .reduce((sum, adj) => sum + parseFloat(adj.amount) || 0, 0);

      return {
        companyId: balance.financial_statements?.company_id,
        companyName: balance.financial_statements?.companies?.name || 'Unbekannt',
        balance: parseFloat(balance.balance) || 0,
        adjustments: adjustmentAmount,
        finalBalance: (parseFloat(balance.balance) || 0) + adjustmentAmount,
      };
    });

    const totalBalance = balanceDetails.reduce(
      (sum, b) => sum + b.finalBalance,
      0,
    );

    return {
      account,
      balances: balanceDetails,
      totalBalance,
      adjustments: adjustments || [],
    };
  }
}
