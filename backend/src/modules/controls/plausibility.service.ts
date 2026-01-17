import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../consolidation/audit-log.service';
import {
  PlausibilityRule,
  PlausibilityRuleCategory,
  PlausibilityRuleSeverity,
} from '../../entities/plausibility-rule.entity';
import {
  PlausibilityCheck,
  PlausibilityCheckStatus,
} from '../../entities/plausibility-check.entity';

// Check Run Status
export enum CheckRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Check Run
export interface PlausibilityCheckRun {
  id: string;
  financialStatementId: string;
  startedAt: Date;
  completedAt?: Date;
  executedByUserId?: string;
  status: CheckRunStatus;
  totalRules: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  categoriesChecked: string[];
  errorMessage?: string;
}

// Check Summary
export interface PlausibilityCheckSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  acknowledged: number;
  waived: number;
  byCategory: {
    category: PlausibilityRuleCategory;
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  }[];
  bySeverity: {
    severity: PlausibilityRuleSeverity;
    total: number;
    passed: number;
    failed: number;
  }[];
}

// Balance Sheet Data for Checks
export interface BalanceSheetData {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  minorityInterests: number;
  accountBalances: {
    accountNumber: string;
    accountName: string;
    balance: number;
    priorYearBalance?: number;
  }[];
}

// Income Statement Data for Checks
export interface IncomeStatementData {
  totalRevenue: number;
  totalExpenses: number;
  operatingResult: number;
  netIncome: number;
  consolidatedNetIncome: number;
  minorityShare: number;
  lineItems: {
    code: string;
    name: string;
    amount: number;
    priorYearAmount?: number;
  }[];
}

// Consolidation Data for Checks
export interface ConsolidationData {
  intercompanyReceivables: number;
  intercompanyPayables: number;
  intercompanyRevenue: number;
  intercompanyExpenses: number;
  unreconciledIcBalance: number;
  capitalConsolidationEntries: number;
  debtConsolidationEntries: number;
  goodwillAmount: number;
  minorityInterestAmount: number;
}

@Injectable()
export class PlausibilityService {
  constructor(
    private supabaseService: SupabaseService,
    @Optional()
    @Inject(forwardRef(() => AuditLogService))
    private auditLogService: AuditLogService,
  ) {}

  // ==================== RULES MANAGEMENT ====================

  /**
   * Get all active plausibility rules
   */
  async getActiveRules(
    category?: PlausibilityRuleCategory,
  ): Promise<PlausibilityRule[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('plausibility_rules')
      .select('*')
      .eq('is_active', true)
      .order('execution_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch plausibility rules: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single rule by ID
   */
  async getRule(ruleId: string): Promise<PlausibilityRule | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('plausibility_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch plausibility rule: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new plausibility rule
   */
  async createRule(
    rule: Partial<PlausibilityRule>,
    userId?: string,
  ): Promise<PlausibilityRule> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('plausibility_rules')
      .insert({
        ...rule,
        created_by_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create plausibility rule: ${error.message}`);
    }

    // Log the action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'create' as any,
        entityType: 'system' as any,
        entityId: data.id,
        entityName: data.name,
        afterState: data,
        description: `Created plausibility rule: ${data.code}`,
      });
    }

    return data;
  }

  /**
   * Update a plausibility rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<PlausibilityRule>,
    userId?: string,
  ): Promise<PlausibilityRule> {
    const supabase = this.supabaseService.getClient();

    const { data: existing } = await supabase
      .from('plausibility_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    const { data, error } = await supabase
      .from('plausibility_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update plausibility rule: ${error.message}`);
    }

    // Log the action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'update' as any,
        entityType: 'system' as any,
        entityId: data.id,
        entityName: data.name,
        beforeState: existing,
        afterState: data,
        description: `Updated plausibility rule: ${data.code}`,
      });
    }

    return data;
  }

  /**
   * Delete a plausibility rule
   */
  async deleteRule(ruleId: string, userId?: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: existing } = await supabase
      .from('plausibility_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    const { error } = await supabase
      .from('plausibility_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      throw new Error(`Failed to delete plausibility rule: ${error.message}`);
    }

    // Log the action
    if (this.auditLogService && existing) {
      await this.auditLogService.log({
        userId,
        action: 'delete' as any,
        entityType: 'system' as any,
        entityId: ruleId,
        entityName: existing.name,
        beforeState: existing,
        description: `Deleted plausibility rule: ${existing.code}`,
      });
    }
  }

  // ==================== CHECK EXECUTION ====================

  /**
   * Run all plausibility checks for a financial statement
   */
  async runAllChecks(
    financialStatementId: string,
    userId?: string,
    categories?: PlausibilityRuleCategory[],
  ): Promise<PlausibilityCheckRun> {
    const supabase = this.supabaseService.getClient();

    // Create a check run record
    const { data: checkRun, error: runError } = await supabase
      .from('plausibility_check_runs')
      .insert({
        financial_statement_id: financialStatementId,
        executed_by_user_id: userId,
        status: 'running',
        categories_checked: categories || [],
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Failed to create check run: ${runError.message}`);
    }

    try {
      // Get active rules
      let rules = await this.getActiveRules();

      // Filter by categories if specified
      if (categories && categories.length > 0) {
        rules = rules.filter((rule) =>
          categories.includes(rule.category as PlausibilityRuleCategory),
        );
      }

      // Get financial statement data
      const balanceSheetData =
        await this.getBalanceSheetData(financialStatementId);
      const consolidationData =
        await this.getConsolidationData(financialStatementId);

      // Execute each rule
      const results = {
        passed: 0,
        failed: 0,
        warnings: 0,
        skipped: 0,
      };

      for (const rule of rules) {
        try {
          const check = await this.executeRule(
            rule,
            financialStatementId,
            balanceSheetData,
            consolidationData,
            userId,
          );

          switch (check.status) {
            case PlausibilityCheckStatus.PASSED:
              results.passed++;
              break;
            case PlausibilityCheckStatus.FAILED:
              results.failed++;
              break;
            case PlausibilityCheckStatus.WARNING:
              results.warnings++;
              break;
            case PlausibilityCheckStatus.SKIPPED:
              results.skipped++;
              break;
          }
        } catch (err) {
          results.skipped++;
          console.error(`Error executing rule ${rule.code}:`, err);
        }
      }

      // Update check run with results
      const { data: updatedRun, error: updateError } = await supabase
        .from('plausibility_check_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_rules: rules.length,
          passed_count: results.passed,
          failed_count: results.failed,
          warning_count: results.warnings,
          skipped_count: results.skipped,
        })
        .eq('id', checkRun.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update check run: ${updateError.message}`);
      }

      // Log the action
      if (this.auditLogService) {
        await this.auditLogService.log({
          userId,
          action: 'calculate' as any,
          entityType: 'financial_statement' as any,
          entityId: financialStatementId,
          financialStatementId,
          afterState: updatedRun,
          description: `Ran ${rules.length} plausibility checks: ${results.passed} passed, ${results.failed} failed, ${results.warnings} warnings`,
        });
      }

      return this.mapCheckRun(updatedRun);
    } catch (err) {
      // Mark run as failed
      await supabase
        .from('plausibility_check_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: err.message,
        })
        .eq('id', checkRun.id);

      throw err;
    }
  }

  /**
   * Execute a single rule
   */
  private async executeRule(
    rule: PlausibilityRule,
    financialStatementId: string,
    balanceSheetData: BalanceSheetData,
    consolidationData: ConsolidationData,
    userId?: string,
  ): Promise<PlausibilityCheck> {
    const supabase = this.supabaseService.getClient();

    let status: PlausibilityCheckStatus = PlausibilityCheckStatus.PASSED;
    let expectedValue: number | null = null;
    let actualValue: number | null = null;
    let differenceValue: number | null = null;
    let differencePercentage: number | null = null;
    let message: string | null = null;
    let details: string | null = null;
    const affectedAccounts: string[] | null = null;

    try {
      const ruleExpression = JSON.parse(rule.ruleExpression);

      switch (rule.category) {
        case PlausibilityRuleCategory.BALANCE_EQUATION:
          // Assets = Liabilities + Equity
          expectedValue = balanceSheetData.totalAssets;
          actualValue = balanceSheetData.totalLiabilitiesAndEquity;
          differenceValue = Math.abs(expectedValue - actualValue);

          if (differenceValue > (rule.toleranceAmount || 0.01)) {
            status =
              rule.severity === PlausibilityRuleSeverity.ERROR
                ? PlausibilityCheckStatus.FAILED
                : PlausibilityCheckStatus.WARNING;
            message = `Bilanzgleichung nicht erfüllt: Aktiva (${expectedValue.toLocaleString('de-DE')} EUR) ≠ Passiva (${actualValue.toLocaleString('de-DE')} EUR)`;
            details = `Differenz: ${differenceValue.toLocaleString('de-DE')} EUR`;
          } else {
            message = 'Bilanzgleichung erfüllt';
          }
          break;

        case PlausibilityRuleCategory.INTERCOMPANY_CONSISTENCY:
          // IC Receivables = IC Payables
          expectedValue = consolidationData.intercompanyReceivables;
          actualValue = consolidationData.intercompanyPayables;
          differenceValue = Math.abs(expectedValue - actualValue);

          const icTolerance = rule.thresholdAbsolute || 0.01;
          if (differenceValue > icTolerance) {
            status = PlausibilityCheckStatus.WARNING;
            message = `IC-Differenz: Forderungen (${expectedValue.toLocaleString('de-DE')} EUR) ≠ Verbindlichkeiten (${actualValue.toLocaleString('de-DE')} EUR)`;
            details = `Nicht abgestimmte IC-Differenz: ${differenceValue.toLocaleString('de-DE')} EUR`;
          } else {
            message = 'IC-Konten abgestimmt';
          }
          break;

        case PlausibilityRuleCategory.DEBT_CONSOLIDATION:
          // Check for unreconciled IC balances
          actualValue = consolidationData.unreconciledIcBalance;
          expectedValue = 0;
          differenceValue = actualValue;

          const debtTolerance = rule.thresholdAbsolute || 0.01;
          if (Math.abs(actualValue) > debtTolerance) {
            status = PlausibilityCheckStatus.WARNING;
            message = `Nicht eliminierte IC-Salden: ${actualValue.toLocaleString('de-DE')} EUR`;
            details = 'Schuldenkonsolidierung möglicherweise unvollständig';
          } else {
            message = 'Schuldenkonsolidierung vollständig';
          }
          break;

        case PlausibilityRuleCategory.INCOME_EXPENSE_CONSOLIDATION:
          // IC Revenue = IC Expenses
          expectedValue = consolidationData.intercompanyRevenue;
          actualValue = consolidationData.intercompanyExpenses;
          differenceValue = Math.abs(expectedValue - actualValue);

          const ieTolerance = rule.thresholdAbsolute || 0.01;
          if (differenceValue > ieTolerance) {
            status = PlausibilityCheckStatus.WARNING;
            message = `IC-Erträge (${expectedValue.toLocaleString('de-DE')} EUR) ≠ IC-Aufwendungen (${actualValue.toLocaleString('de-DE')} EUR)`;
            details = `Differenz: ${differenceValue.toLocaleString('de-DE')} EUR`;
          } else {
            message = 'IC-Erträge und -Aufwendungen abgestimmt';
          }
          break;

        case PlausibilityRuleCategory.MINORITY_INTEREST:
          // Minority interest should be > 0 if there are non-wholly-owned subsidiaries
          actualValue = balanceSheetData.minorityInterests;
          expectedValue = consolidationData.minorityInterestAmount;
          differenceValue = Math.abs((actualValue || 0) - (expectedValue || 0));

          if (differenceValue > (rule.toleranceAmount || 0.01)) {
            status = PlausibilityCheckStatus.WARNING;
            message = `Minderheitenanteile-Differenz: Bilanz (${(actualValue || 0).toLocaleString('de-DE')} EUR) vs. Berechnung (${(expectedValue || 0).toLocaleString('de-DE')} EUR)`;
          } else {
            message = 'Minderheitenanteile korrekt ausgewiesen';
          }
          break;

        case PlausibilityRuleCategory.CAPITAL_CONSOLIDATION:
          // Check goodwill treatment
          actualValue = consolidationData.goodwillAmount;
          if (actualValue && actualValue < 0) {
            status = PlausibilityCheckStatus.WARNING;
            message = `Negativer Geschäfts- oder Firmenwert: ${actualValue.toLocaleString('de-DE')} EUR - Prüfung erforderlich (§ 301 Abs. 3 HGB)`;
          } else {
            message = 'Geschäfts- oder Firmenwert positiv oder nicht vorhanden';
          }
          break;

        case PlausibilityRuleCategory.YEAR_OVER_YEAR:
          // Handled by variance analysis service
          status = PlausibilityCheckStatus.SKIPPED;
          message = 'Vorjahresvergleich wird durch Varianzanalyse durchgeführt';
          break;

        default:
          // Custom rule evaluation
          status = PlausibilityCheckStatus.SKIPPED;
          message = `Regeltyp "${rule.category}" nicht implementiert`;
          break;
      }
    } catch (err) {
      status = PlausibilityCheckStatus.SKIPPED;
      message = `Fehler bei Regelausführung: ${err.message}`;
    }

    // Calculate percentage difference if both values exist
    if (expectedValue !== null && actualValue !== null && expectedValue !== 0) {
      differencePercentage =
        ((actualValue - expectedValue) / Math.abs(expectedValue)) * 100;
    }

    // Save the check result
    const { data: check, error } = await supabase
      .from('plausibility_checks')
      .insert({
        financial_statement_id: financialStatementId,
        rule_id: rule.id,
        executed_by_user_id: userId,
        status,
        expected_value: expectedValue,
        actual_value: actualValue,
        difference_value: differenceValue,
        difference_percentage: differencePercentage,
        message,
        details,
        affected_accounts: affectedAccounts,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save plausibility check: ${error.message}`);
    }

    return check;
  }

  // ==================== CHECK RESULTS ====================

  /**
   * Get check results for a financial statement
   */
  async getCheckResults(
    financialStatementId: string,
    status?: PlausibilityCheckStatus,
  ): Promise<PlausibilityCheck[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('plausibility_checks')
      .select(
        `
        *,
        rule:plausibility_rules(*)
      `,
      )
      .eq('financial_statement_id', financialStatementId)
      .order('executed_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch plausibility checks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get check summary for a financial statement
   */
  async getCheckSummary(
    financialStatementId: string,
  ): Promise<PlausibilityCheckSummary> {
    const checks = await this.getCheckResults(financialStatementId);

    const summary: PlausibilityCheckSummary = {
      totalChecks: checks.length,
      passed: 0,
      failed: 0,
      warnings: 0,
      skipped: 0,
      acknowledged: 0,
      waived: 0,
      byCategory: [],
      bySeverity: [],
    };

    const categoryMap = new Map<
      string,
      { total: number; passed: number; failed: number; warnings: number }
    >();
    const severityMap = new Map<
      string,
      { total: number; passed: number; failed: number }
    >();

    for (const check of checks) {
      switch (check.status) {
        case PlausibilityCheckStatus.PASSED:
          summary.passed++;
          break;
        case PlausibilityCheckStatus.FAILED:
          summary.failed++;
          break;
        case PlausibilityCheckStatus.WARNING:
          summary.warnings++;
          break;
        case PlausibilityCheckStatus.SKIPPED:
          summary.skipped++;
          break;
        case PlausibilityCheckStatus.ACKNOWLEDGED:
          summary.acknowledged++;
          break;
        case PlausibilityCheckStatus.WAIVED:
          summary.waived++;
          break;
      }

      // Aggregate by category
      const rule = check.rule as any;
      if (rule) {
        const category = rule.category;
        const catStats = categoryMap.get(category) || {
          total: 0,
          passed: 0,
          failed: 0,
          warnings: 0,
        };
        catStats.total++;
        if (check.status === PlausibilityCheckStatus.PASSED) catStats.passed++;
        if (check.status === PlausibilityCheckStatus.FAILED) catStats.failed++;
        if (check.status === PlausibilityCheckStatus.WARNING)
          catStats.warnings++;
        categoryMap.set(category, catStats);

        const severity = rule.severity;
        const sevStats = severityMap.get(severity) || {
          total: 0,
          passed: 0,
          failed: 0,
        };
        sevStats.total++;
        if (check.status === PlausibilityCheckStatus.PASSED) sevStats.passed++;
        if (check.status === PlausibilityCheckStatus.FAILED) sevStats.failed++;
        severityMap.set(severity, sevStats);
      }
    }

    summary.byCategory = Array.from(categoryMap.entries()).map(
      ([category, stats]) => ({
        category: category as PlausibilityRuleCategory,
        ...stats,
      }),
    );

    summary.bySeverity = Array.from(severityMap.entries()).map(
      ([severity, stats]) => ({
        severity: severity as PlausibilityRuleSeverity,
        ...stats,
      }),
    );

    return summary;
  }

  /**
   * Acknowledge a check result
   */
  async acknowledgeCheck(
    checkId: string,
    userId: string,
    comment: string,
  ): Promise<PlausibilityCheck> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('plausibility_checks')
      .update({
        status: PlausibilityCheckStatus.ACKNOWLEDGED,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_user_id: userId,
        acknowledgment_comment: comment,
      })
      .eq('id', checkId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to acknowledge check: ${error.message}`);
    }

    return data;
  }

  /**
   * Waive a check result
   */
  async waiveCheck(
    checkId: string,
    userId: string,
    reason: string,
  ): Promise<PlausibilityCheck> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('plausibility_checks')
      .update({
        status: PlausibilityCheckStatus.WAIVED,
        waived_at: new Date().toISOString(),
        waived_by_user_id: userId,
        waiver_reason: reason,
      })
      .eq('id', checkId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to waive check: ${error.message}`);
    }

    return data;
  }

  /**
   * Get check runs for a financial statement
   */
  async getCheckRuns(
    financialStatementId: string,
  ): Promise<PlausibilityCheckRun[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('plausibility_check_runs')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .order('started_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch check runs: ${error.message}`);
    }

    return (data || []).map(this.mapCheckRun);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get balance sheet data for checks
   */
  private async getBalanceSheetData(
    financialStatementId: string,
  ): Promise<BalanceSheetData> {
    const supabase = this.supabaseService.getClient();

    // Get account balances
    const { data: balances } = await supabase
      .from('account_balances')
      .select(
        `
        *,
        account:accounts(*)
      `,
      )
      .eq('financial_statement_id', financialStatementId);

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let minorityInterests = 0;

    const accountBalances: BalanceSheetData['accountBalances'] = [];

    for (const balance of balances || []) {
      const account = balance.account as any;
      const amount = Number(balance.amount) || 0;

      if (account) {
        accountBalances.push({
          accountNumber: account.account_number,
          accountName: account.name,
          balance: amount,
        });

        // Classify by account type
        if (account.account_type === 'asset') {
          totalAssets += amount;
        } else if (account.account_type === 'liability') {
          totalLiabilities += amount;
        } else if (account.account_type === 'equity') {
          totalEquity += amount;
          // Check for minority interests
          if (
            account.account_number?.startsWith('32') ||
            account.name?.toLowerCase().includes('minderheit')
          ) {
            minorityInterests += amount;
          }
        }
      }
    }

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      minorityInterests,
      accountBalances,
    };
  }

  /**
   * Get consolidation data for checks
   */
  private async getConsolidationData(
    financialStatementId: string,
  ): Promise<ConsolidationData> {
    const supabase = this.supabaseService.getClient();

    // Get IC transactions
    const { data: icTransactions } = await supabase
      .from('intercompany_transactions')
      .select('*')
      .eq('financial_statement_id', financialStatementId);

    let intercompanyReceivables = 0;
    let intercompanyPayables = 0;
    let intercompanyRevenue = 0;
    let intercompanyExpenses = 0;

    for (const tx of icTransactions || []) {
      const amount = Number(tx.amount) || 0;

      switch (tx.transaction_type) {
        case 'receivable':
          intercompanyReceivables += amount;
          break;
        case 'payable':
          intercompanyPayables += amount;
          break;
        case 'revenue':
          intercompanyRevenue += amount;
          break;
        case 'expense':
          intercompanyExpenses += amount;
          break;
      }
    }

    // Get IC reconciliation status
    const { data: reconciliations } = await supabase
      .from('ic_reconciliations')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .eq('is_reconciled', false);

    let unreconciledIcBalance = 0;
    for (const rec of reconciliations || []) {
      unreconciledIcBalance += Number(rec.difference_amount) || 0;
    }

    // Get consolidation entries count
    const { count: capitalCount } = await supabase
      .from('consolidation_entries')
      .select('*', { count: 'exact', head: true })
      .eq('financial_statement_id', financialStatementId)
      .eq('entry_type', 'capital_consolidation');

    const { count: debtCount } = await supabase
      .from('consolidation_entries')
      .select('*', { count: 'exact', head: true })
      .eq('financial_statement_id', financialStatementId)
      .eq('entry_type', 'debt_consolidation');

    // Get goodwill and minority interest from consolidation entries
    const { data: entries } = await supabase
      .from('consolidation_entries')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .in('entry_type', ['capital_consolidation', 'minority_interest']);

    let goodwillAmount = 0;
    let minorityInterestAmount = 0;

    for (const entry of entries || []) {
      if (
        entry.description?.toLowerCase().includes('geschäftswert') ||
        entry.description?.toLowerCase().includes('goodwill') ||
        entry.description?.toLowerCase().includes('firmenwert')
      ) {
        goodwillAmount += Number(entry.amount) || 0;
      }
      if (
        entry.entry_type === 'minority_interest' ||
        entry.description?.toLowerCase().includes('minderheit')
      ) {
        minorityInterestAmount += Number(entry.amount) || 0;
      }
    }

    return {
      intercompanyReceivables,
      intercompanyPayables,
      intercompanyRevenue,
      intercompanyExpenses,
      unreconciledIcBalance,
      capitalConsolidationEntries: capitalCount || 0,
      debtConsolidationEntries: debtCount || 0,
      goodwillAmount,
      minorityInterestAmount,
    };
  }

  /**
   * Map database record to CheckRun interface
   */
  private mapCheckRun(data: any): PlausibilityCheckRun {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      executedByUserId: data.executed_by_user_id,
      status: data.status as CheckRunStatus,
      totalRules: data.total_rules || 0,
      passedCount: data.passed_count || 0,
      failedCount: data.failed_count || 0,
      warningCount: data.warning_count || 0,
      skippedCount: data.skipped_count || 0,
      categoriesChecked: data.categories_checked || [],
      errorMessage: data.error_message,
    };
  }
}
