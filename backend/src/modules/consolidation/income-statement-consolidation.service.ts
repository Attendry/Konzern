import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IntercompanyTransactionService } from './intercompany-transaction.service';
import { CapitalConsolidationService } from './capital-consolidation.service';
import { DependencyIdentificationService } from '../company/dependency-identification.service';

export interface IncomeStatementPosition {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  amount: number;
  companyId?: string;
  companyName?: string;
  isIntercompany?: boolean;
}

export interface ConsolidatedIncomeStatement {
  fiscalYear: number;
  periodStart: Date;
  periodEnd: Date;
  revenue: {
    total: number;
    intercompanyEliminated: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  costOfSales: {
    total: number;
    intercompanyEliminated: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  operatingExpenses: {
    total: number;
    intercompanyEliminated: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  financialResult: {
    total: number;
    intercompanyEliminated: number; // Zinsen zwischen Konzernunternehmen
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  extraordinaryResult: {
    total: number;
    intercompanyEliminated: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  incomeBeforeTax: number;
  incomeTax: {
    total: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  netIncome: {
    total: number;
    parentCompany: number;
    minorityInterests: number;
    consolidated: number;
  };
  eliminations: {
    intercompanyRevenue: number;
    intercompanyExpenses: number;
    intercompanyProfits: number;
    intercompanyInterest: number;
    total: number;
  };
  consolidationSummary: {
    companiesIncluded: number;
    eliminationsApplied: number;
  };
}

@Injectable()
export class IncomeStatementConsolidationService {
  constructor(
    private supabaseService: SupabaseService,
    private intercompanyService: IntercompanyTransactionService,
    private capitalConsolidationService: CapitalConsolidationService,
    private dependencyService: DependencyIdentificationService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Führt die vollständige GuV-Konsolidierung durch nach HGB § 301
   */
  async consolidateIncomeStatement(
    financialStatementId: string,
  ): Promise<ConsolidatedIncomeStatement> {
    // 1. Lade Financial Statement
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

    const parentCompanyId = financialStatement.company_id;

    // 2. Bestimme Konsolidierungskreis
    const consolidationCircle =
      await this.dependencyService.determineConsolidationCircle(
        parentCompanyId,
      );

    if (!consolidationCircle.consolidationRequired) {
      throw new BadRequestException(
        'Keine Konsolidierung erforderlich für dieses Unternehmen',
      );
    }

    const allCompanyIds = [
      consolidationCircle.parentCompany.id,
      ...consolidationCircle.subsidiaries.map((s) => s.id),
    ];

    // 3. Lade alle Financial Statements des Konsolidierungskreises
    const { data: allFinancialStatements, error: fsAllError } =
      await this.supabase
        .from('financial_statements')
        .select('*, companies(*)')
        .in('company_id', allCompanyIds)
        .eq('fiscal_year', financialStatement.fiscal_year);

    if (fsAllError) {
      throw new BadRequestException(
        `Fehler beim Laden der Financial Statements: ${fsAllError.message}`,
      );
    }

    const financialStatementIds = (allFinancialStatements || []).map(
      (fs) => fs.id,
    );

    // 4. Lade alle Income Statement Balances
    // Fallback: Verwende Account Balances mit revenue/expense accounts
    const { data: accountBalances, error: balanceError } = await this.supabase
      .from('account_balances')
      .select(
        `
        *,
        accounts!inner(*),
        financial_statements!inner(*, companies(*))
      `,
      )
      .in('financial_statement_id', financialStatementIds)
      .in('accounts.account_type', ['revenue', 'expense']);

    if (balanceError) {
      throw new BadRequestException(
        `Fehler beim Laden der Account Balances: ${balanceError.message}`,
      );
    }

    // 5. Gruppiere nach Account Type
    const revenuePositions: IncomeStatementPosition[] = [];
    const expensePositions: IncomeStatementPosition[] = [];
    const financialIncomePositions: IncomeStatementPosition[] = [];
    const financialExpensePositions: IncomeStatementPosition[] = [];

    for (const balance of accountBalances || []) {
      const account = balance.accounts;
      const fs = balance.financial_statements;
      if (!account) continue;

      const position: IncomeStatementPosition = {
        accountId: account.id,
        accountNumber: account.account_number,
        accountName: account.name,
        accountType: account.account_type,
        amount: parseFloat(balance.balance || '0'),
        companyId: fs?.company_id,
        companyName: fs?.companies?.name,
        isIntercompany: balance.is_intercompany || false,
      };

      if (account.account_type === 'revenue') {
        // Unterscheide zwischen Umsatzerlösen und sonstigen Erträgen
        if (
          account.account_number.match(/^4[0-9]{3}/) ||
          account.name.toLowerCase().match(/umsatz|erlös|verkauf/i)
        ) {
          revenuePositions.push(position);
        } else {
          financialIncomePositions.push(position);
        }
      } else if (account.account_type === 'expense') {
        // Unterscheide zwischen Aufwendungen und sonstigen Aufwendungen
        if (
          account.account_number.match(/^5[0-9]{3}/) ||
          account.account_number.match(/^6[0-9]{3}/) ||
          account.name
            .toLowerCase()
            .match(/aufwand|kosten|material|lohn|miete/i)
        ) {
          expensePositions.push(position);
        } else {
          financialExpensePositions.push(position);
        }
      }
    }

    // 6. Eliminiere Zwischenumsätze
    const revenueElimination = await this.eliminateIntercompanyRevenue(
      financialStatementId,
      revenuePositions,
    );

    // 7. Eliminiere Zwischenaufwendungen
    const expenseElimination = await this.eliminateIntercompanyExpenses(
      financialStatementId,
      expensePositions,
    );

    // 8. Eliminiere Zwischengewinne in GuV
    const profitElimination =
      await this.eliminateIntercompanyProfits(financialStatementId);

    // 9. Eliminiere Zinsen zwischen Konzernunternehmen
    const interestElimination = await this.eliminateIntercompanyInterest(
      financialStatementId,
      financialIncomePositions,
      financialExpensePositions,
    );

    // 10. Berechne konsolidierte Werte
    const totalRevenue = revenuePositions.reduce((sum, p) => sum + p.amount, 0);
    const totalCostOfSales = expensePositions
      .filter((p) => p.accountNumber.match(/^5[0-9]{3}/))
      .reduce((sum, p) => sum + p.amount, 0);
    const totalOperatingExpenses = expensePositions
      .filter((p) => !p.accountNumber.match(/^5[0-9]{3}/))
      .reduce((sum, p) => sum + p.amount, 0);
    const totalFinancialIncome = financialIncomePositions.reduce(
      (sum, p) => sum + p.amount,
      0,
    );
    const totalFinancialExpense = financialExpensePositions.reduce(
      (sum, p) => sum + p.amount,
      0,
    );

    const consolidatedRevenue =
      totalRevenue - revenueElimination.totalEliminated;
    const consolidatedCostOfSales =
      totalCostOfSales - expenseElimination.totalEliminated;
    const consolidatedOperatingExpenses =
      totalOperatingExpenses - expenseElimination.totalEliminated;
    const consolidatedFinancialResult =
      totalFinancialIncome -
      totalFinancialExpense -
      interestElimination.totalEliminated;

    const incomeBeforeTax =
      consolidatedRevenue -
      consolidatedCostOfSales -
      consolidatedOperatingExpenses +
      consolidatedFinancialResult;

    // 11. Steuern (vereinfacht - sollte aus separaten Konten kommen)
    const { data: taxBalances } = await this.supabase
      .from('account_balances')
      .select('balance, accounts!inner(*)')
      .in('financial_statement_id', financialStatementIds)
      .or(
        'accounts.account_number.ilike.%steuer%,accounts.name.ilike.%steuer%',
      );

    const totalTax = (taxBalances || []).reduce(
      (sum, b) => sum + Math.abs(parseFloat(b.balance || '0')),
      0,
    );

    const netIncomeBeforeAllocation = incomeBeforeTax - totalTax;

    // 12. Aufteilung auf Mutter/Minderheiten
    const allocationResult = await this.allocateNetIncome(
      financialStatementId,
      parentCompanyId,
      netIncomeBeforeAllocation,
      consolidationCircle.subsidiaries,
    );

    return {
      fiscalYear: financialStatement.fiscal_year,
      periodStart: new Date(financialStatement.period_start),
      periodEnd: new Date(financialStatement.period_end),
      revenue: {
        total: totalRevenue,
        intercompanyEliminated: revenueElimination.totalEliminated,
        consolidated: consolidatedRevenue,
        positions: revenuePositions,
      },
      costOfSales: {
        total: totalCostOfSales,
        intercompanyEliminated: expenseElimination.totalEliminated,
        consolidated: consolidatedCostOfSales,
        positions: expensePositions.filter((p) =>
          p.accountNumber.match(/^5[0-9]{3}/),
        ),
      },
      operatingExpenses: {
        total: totalOperatingExpenses,
        intercompanyEliminated: expenseElimination.totalEliminated,
        consolidated: consolidatedOperatingExpenses,
        positions: expensePositions.filter(
          (p) => !p.accountNumber.match(/^5[0-9]{3}/),
        ),
      },
      financialResult: {
        total: totalFinancialIncome - totalFinancialExpense,
        intercompanyEliminated: interestElimination.totalEliminated,
        consolidated: consolidatedFinancialResult,
        positions: [...financialIncomePositions, ...financialExpensePositions],
      },
      extraordinaryResult: {
        total: 0,
        intercompanyEliminated: 0,
        consolidated: 0,
        positions: [],
      },
      incomeBeforeTax,
      incomeTax: {
        total: totalTax,
        consolidated: totalTax,
        positions: (taxBalances || []).map((b: any) => ({
          accountId: (b.accounts as any)?.id || '',
          accountNumber: (b.accounts as any)?.account_number || '',
          accountName: (b.accounts as any)?.name || '',
          accountType: 'income_tax',
          amount: Math.abs(parseFloat(b.balance || '0')),
        })),
      },
      netIncome: {
        total: netIncomeBeforeAllocation,
        parentCompany: allocationResult.parentCompanyIncome,
        minorityInterests: allocationResult.minorityInterests,
        consolidated: netIncomeBeforeAllocation,
      },
      eliminations: {
        intercompanyRevenue: revenueElimination.totalEliminated,
        intercompanyExpenses: expenseElimination.totalEliminated,
        intercompanyProfits: profitElimination.totalEliminated,
        intercompanyInterest: interestElimination.totalEliminated,
        total:
          revenueElimination.totalEliminated +
          expenseElimination.totalEliminated +
          profitElimination.totalEliminated +
          interestElimination.totalEliminated,
      },
      consolidationSummary: {
        companiesIncluded: allCompanyIds.length,
        eliminationsApplied:
          revenueElimination.entries.length +
          expenseElimination.entries.length +
          profitElimination.entries.length +
          interestElimination.entries.length,
      },
    };
  }

  /**
   * Eliminiert Zwischenumsätze nach HGB § 301
   */
  private async eliminateIntercompanyRevenue(
    financialStatementId: string,
    revenuePositions: IncomeStatementPosition[],
  ): Promise<{ totalEliminated: number; entries: any[] }> {
    const entries: any[] = [];
    let totalEliminated = 0;

    // Finde alle intercompany revenue positions
    const intercompanyRevenues = revenuePositions.filter(
      (p) => p.isIntercompany,
    );

    for (const revenue of intercompanyRevenues) {
      const eliminationAmount = revenue.amount;
      totalEliminated += eliminationAmount;

      // Erstelle Consolidation Entry
      const { error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          account_id: revenue.accountId,
          adjustment_type: 'elimination',
          amount: -eliminationAmount, // Negativ, da Eliminierung
          description: `Eliminierung Zwischenumsatz: ${revenue.accountName} (${revenue.companyName})`,
        });

      if (!error) {
        entries.push({
          accountId: revenue.accountId,
          amount: -eliminationAmount,
          description: `Eliminierung Zwischenumsatz: ${revenue.accountName}`,
        });
      }
    }

    return { totalEliminated, entries };
  }

  /**
   * Eliminiert Zwischenaufwendungen nach HGB § 301
   */
  private async eliminateIntercompanyExpenses(
    financialStatementId: string,
    expensePositions: IncomeStatementPosition[],
  ): Promise<{ totalEliminated: number; entries: any[] }> {
    const entries: any[] = [];
    let totalEliminated = 0;

    // Finde alle intercompany expense positions
    const intercompanyExpenses = expensePositions.filter(
      (p) => p.isIntercompany,
    );

    for (const expense of intercompanyExpenses) {
      const eliminationAmount = expense.amount;
      totalEliminated += eliminationAmount;

      // Erstelle Consolidation Entry
      const { error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          account_id: expense.accountId,
          adjustment_type: 'elimination',
          amount: eliminationAmount, // Positiv, da Aufwand negativ ist
          description: `Eliminierung Zwischenaufwand: ${expense.accountName} (${expense.companyName})`,
        });

      if (!error) {
        entries.push({
          accountId: expense.accountId,
          amount: eliminationAmount,
          description: `Eliminierung Zwischenaufwand: ${expense.accountName}`,
        });
      }
    }

    return { totalEliminated, entries };
  }

  /**
   * Eliminiert Zwischengewinne in GuV nach HGB § 301
   * (Gewinne aus Lieferungen/Leistungen zwischen Konzernunternehmen)
   */
  private async eliminateIntercompanyProfits(
    financialStatementId: string,
  ): Promise<{ totalEliminated: number; entries: any[] }> {
    const entries: any[] = [];
    let totalEliminated = 0;

    // Erkenne Zwischengesellschaftsgeschäfte
    const detectionResult =
      await this.intercompanyService.detectIntercompanyTransactions(
        financialStatementId,
      );

    // Finde Lieferungen/Leistungen mit Gewinn
    const deliveryTransactions = detectionResult.transactions.filter(
      (t) => t.transactionType === 'delivery',
    );

    for (const transaction of deliveryTransactions) {
      // Vereinfachte Annahme: 10% Gewinnmarge (in Produktion sollte dies aus Daten kommen)
      const estimatedProfit = transaction.amount * 0.1;
      totalEliminated += estimatedProfit;

      // Erstelle Consolidation Entry
      const { error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          account_id: transaction.accountId,
          adjustment_type: 'elimination',
          amount: -estimatedProfit,
          description: `Eliminierung Zwischengewinn aus Lieferung: ${transaction.accountName}`,
        });

      if (!error) {
        entries.push({
          accountId: transaction.accountId,
          amount: -estimatedProfit,
          description: `Eliminierung Zwischengewinn: ${transaction.accountName}`,
        });
      }
    }

    return { totalEliminated, entries };
  }

  /**
   * Eliminiert Zinsen zwischen Konzernunternehmen nach HGB § 301
   */
  private async eliminateIntercompanyInterest(
    financialStatementId: string,
    financialIncomePositions: IncomeStatementPosition[],
    financialExpensePositions: IncomeStatementPosition[],
  ): Promise<{ totalEliminated: number; entries: any[] }> {
    const entries: any[] = [];
    let totalEliminated = 0;

    // Finde intercompany Zinserträge
    const intercompanyInterestIncome = financialIncomePositions.filter(
      (p) =>
        p.isIntercompany && p.accountName.toLowerCase().match(/zins|interest/i),
    );

    // Finde intercompany Zinsaufwendungen
    const intercompanyInterestExpense = financialExpensePositions.filter(
      (p) =>
        p.isIntercompany && p.accountName.toLowerCase().match(/zins|interest/i),
    );

    // Eliminiere Zinserträge
    for (const income of intercompanyInterestIncome) {
      totalEliminated += income.amount;

      const { error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          account_id: income.accountId,
          adjustment_type: 'elimination',
          amount: -income.amount,
          description: `Eliminierung Zwischenzinsertrag: ${income.accountName}`,
        });

      if (!error) {
        entries.push({
          accountId: income.accountId,
          amount: -income.amount,
          description: `Eliminierung Zwischenzinsertrag: ${income.accountName}`,
        });
      }
    }

    // Eliminiere Zinsaufwendungen
    for (const expense of intercompanyInterestExpense) {
      totalEliminated += expense.amount;

      const { error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          account_id: expense.accountId,
          adjustment_type: 'elimination',
          amount: expense.amount,
          description: `Eliminierung Zwischenzinsaufwand: ${expense.accountName}`,
        });

      if (!error) {
        entries.push({
          accountId: expense.accountId,
          amount: expense.amount,
          description: `Eliminierung Zwischenzinsaufwand: ${expense.accountName}`,
        });
      }
    }

    return { totalEliminated, entries };
  }

  /**
   * Teilt Jahresüberschuss auf Mutter/Minderheiten auf nach HGB § 301
   */
  private async allocateNetIncome(
    financialStatementId: string,
    parentCompanyId: string,
    netIncome: number,
    subsidiaries: any[],
  ): Promise<{
    parentCompanyIncome: number;
    minorityInterests: number;
  }> {
    let totalMinorityInterests = 0;

    // Für jede Tochtergesellschaft: Berechne Minderheitsanteile
    for (const subsidiary of subsidiaries) {
      // Lade Beteiligungsquote
      const { data: participation } = await this.supabase
        .from('participations')
        .select('participation_percentage')
        .eq('parent_company_id', parentCompanyId)
        .eq('subsidiary_company_id', subsidiary.id)
        .single();

      if (participation) {
        const participationPercentage = parseFloat(
          participation.participation_percentage || '0',
        );
        const minorityPercentage = 100 - participationPercentage;

        // Vereinfachte Annahme: Net Income der Tochter proportional
        // In Produktion sollte dies aus der GuV der Tochter kommen
        const subsidiaryNetIncome =
          netIncome * (minorityPercentage / 100) * 0.3; // 30% Anteil am Gesamtergebnis (vereinfacht)
        totalMinorityInterests += subsidiaryNetIncome;
      }
    }

    const parentCompanyIncome = netIncome - totalMinorityInterests;

    return {
      parentCompanyIncome,
      minorityInterests: totalMinorityInterests,
    };
  }

  /**
   * Validiert die konsolidierte GuV
   */
  async validateConsolidatedIncomeStatement(
    financialStatementId: string,
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const incomeStatement =
      await this.consolidateIncomeStatement(financialStatementId);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Prüfe: Net Income sollte gleich Parent + Minderheiten sein
    const netIncomeCheck =
      Math.abs(
        incomeStatement.netIncome.consolidated -
          (incomeStatement.netIncome.parentCompany +
            incomeStatement.netIncome.minorityInterests),
      ) < 0.01;

    if (!netIncomeCheck) {
      errors.push(
        'Net Income Aufteilung stimmt nicht: Parent + Minderheiten ≠ Gesamt',
      );
    }

    // Prüfe: Eliminierungen sollten konsistent sein
    if (incomeStatement.eliminations.total < 0) {
      warnings.push('Negative Eliminierungen erkannt - bitte prüfen');
    }

    // Prüfe: Revenue sollte nach Eliminierung kleiner sein
    if (incomeStatement.revenue.consolidated > incomeStatement.revenue.total) {
      errors.push('Konsolidierter Umsatz ist größer als Gesamtumsatz');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
