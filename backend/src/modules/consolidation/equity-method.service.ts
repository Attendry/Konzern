import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import {
  AdjustmentType,
  EntrySource,
  EntryStatus,
  HgbReference,
  ConsolidationEntry,
} from '../../entities/consolidation-entry.entity';

// At-Equity result interface
export interface EquityMethodResult {
  participationId: string;
  subsidiaryName: string;
  participationPercentage: number;
  // Opening balance
  openingCarryingValue: number;
  // Movements
  shareOfProfit: number;
  dividendsReceived: number;
  goodwillAmortization: number;
  otherAdjustments: number;
  // Closing balance
  closingCarryingValue: number;
  // Related entries
  entries: ConsolidationEntry[];
}

// Input for equity method calculation
interface EquityMethodInput {
  participationId: string;
  subsidiaryCompanyId: string;
  subsidiaryName: string;
  participationPercentage: number;
  acquisitionCost: number;
  goodwill: number;
  goodwillUsefulLife: number; // years
  openingCarryingValue?: number;
  subsidiaryNetIncome: number;
  dividendsReceived: number;
  otherComprehensiveIncome?: number;
}

@Injectable()
export class EquityMethodService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Calculate at-equity valuation for all equity-method investments
   * (§ 312 HGB - Bewertung nach der Equity-Methode)
   */
  async calculateEquityMethod(
    financialStatementId: string,
    parentCompanyId: string,
  ): Promise<{ results: EquityMethodResult[]; summary: any }> {
    console.log(
      `[EquityMethodService] Calculating equity method for parent: ${parentCompanyId}`,
    );

    // Get all participations that should be accounted for using equity method
    const { data: participations, error: partError } = await this.supabase
      .from('participations')
      .select(
        `
        *,
        subsidiary:companies!participations_subsidiary_company_id_fkey(*)
      `,
      )
      .eq('parent_company_id', parentCompanyId)
      .eq('is_active', true)
      .gte('participation_percentage', 20) // 20% or more but not consolidated
      .lt('participation_percentage', 50); // Less than 50% (not a subsidiary)

    if (partError) {
      SupabaseErrorHandler.handle(partError, 'Participations', 'fetch');
    }

    // Also check for explicitly marked equity-method companies
    const { data: equityCompanies, error: compError } = await this.supabase
      .from('companies')
      .select('*')
      .eq('consolidation_type', 'equity');

    if (compError) {
      console.error('Error fetching equity companies:', compError);
    }

    const results: EquityMethodResult[] = [];
    const entries: ConsolidationEntry[] = [];

    for (const participation of participations || []) {
      if (!participation.subsidiary) continue;

      // Check if company is excluded from full consolidation
      const isEquityMethod =
        participation.subsidiary.consolidation_type === 'equity' ||
        (participation.participation_percentage >= 20 &&
          participation.participation_percentage < 50);

      if (!isEquityMethod) continue;

      // Get subsidiary's financial statement for the same period
      const { data: subsidiarFS, error: fsError } = await this.supabase
        .from('financial_statements')
        .select('*')
        .eq('company_id', participation.subsidiary_company_id)
        .order('fiscal_year', { ascending: false })
        .limit(1)
        .single();

      if (fsError || !subsidiarFS) {
        console.warn(
          `No financial statement found for subsidiary ${participation.subsidiary.name}`,
        );
        continue;
      }

      // Calculate equity method result
      const result = await this.calculateSingleEquityMethod(
        financialStatementId,
        {
          participationId: participation.id,
          subsidiaryCompanyId: participation.subsidiary_company_id,
          subsidiaryName: participation.subsidiary.name,
          participationPercentage: Number(
            participation.participation_percentage,
          ),
          acquisitionCost: Number(participation.acquisition_cost || 0),
          goodwill: Number(participation.goodwill || 0),
          goodwillUsefulLife: 10, // Default 10 years per HGB
          subsidiaryNetIncome: await this.getSubsidiaryNetIncome(
            subsidiarFS.id,
          ),
          dividendsReceived: await this.getDividendsReceived(
            parentCompanyId,
            participation.subsidiary_company_id,
          ),
          otherComprehensiveIncome: 0,
        },
      );

      results.push(result);
      entries.push(...result.entries);
    }

    // Calculate summary
    const summary = {
      totalAssociates: results.length,
      totalCarryingValue: results.reduce(
        (sum, r) => sum + r.closingCarryingValue,
        0,
      ),
      totalShareOfProfit: results.reduce((sum, r) => sum + r.shareOfProfit, 0),
      totalDividends: results.reduce((sum, r) => sum + r.dividendsReceived, 0),
      totalGoodwillAmortization: results.reduce(
        (sum, r) => sum + r.goodwillAmortization,
        0,
      ),
    };

    return { results, summary };
  }

  /**
   * Calculate equity method for a single investment
   */
  private async calculateSingleEquityMethod(
    financialStatementId: string,
    input: EquityMethodInput,
  ): Promise<EquityMethodResult> {
    const entries: ConsolidationEntry[] = [];

    // Calculate share of profit/loss
    const shareOfProfit =
      input.subsidiaryNetIncome * (input.participationPercentage / 100);

    // Calculate goodwill amortization (§ 309 Abs. 1 HGB)
    const goodwillAmortization =
      input.goodwill > 0 ? input.goodwill / input.goodwillUsefulLife : 0;

    // Calculate opening carrying value (if not provided, use acquisition cost)
    const openingCarryingValue =
      input.openingCarryingValue ?? input.acquisitionCost;

    // Calculate closing carrying value
    const closingCarryingValue =
      openingCarryingValue +
      shareOfProfit -
      input.dividendsReceived -
      goodwillAmortization +
      (input.otherComprehensiveIncome || 0);

    // Create consolidation entry for share of profit/loss
    if (shareOfProfit !== 0) {
      const { data: profitEntry, error: profitError } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          adjustment_type: AdjustmentType.OTHER,
          amount: shareOfProfit,
          description: `At-Equity Ergebnisanteil: ${input.subsidiaryName} (${input.participationPercentage}% × ${input.subsidiaryNetIncome.toFixed(2)})`,
          source: EntrySource.AUTOMATIC,
          status: EntryStatus.APPROVED,
          hgb_reference: HgbReference.SECTION_312,
          affected_company_ids: [input.subsidiaryCompanyId],
          created_at: SupabaseMapper.getCurrentTimestamp(),
          updated_at: SupabaseMapper.getCurrentTimestamp(),
        })
        .select()
        .single();

      if (!profitError && profitEntry) {
        entries.push(SupabaseMapper.toConsolidationEntry(profitEntry));
      }
    }

    // Create entry for dividend elimination (already received as income, avoid double counting)
    if (input.dividendsReceived > 0) {
      const { data: divEntry, error: divError } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          adjustment_type: AdjustmentType.ELIMINATION,
          amount: -input.dividendsReceived,
          description: `At-Equity Dividendenbereinigung: ${input.subsidiaryName} - Erhaltene Dividenden bereits im Ergebnis enthalten`,
          source: EntrySource.AUTOMATIC,
          status: EntryStatus.APPROVED,
          hgb_reference: HgbReference.SECTION_312,
          affected_company_ids: [input.subsidiaryCompanyId],
          created_at: SupabaseMapper.getCurrentTimestamp(),
          updated_at: SupabaseMapper.getCurrentTimestamp(),
        })
        .select()
        .single();

      if (!divError && divEntry) {
        entries.push(SupabaseMapper.toConsolidationEntry(divEntry));
      }
    }

    // Create entry for goodwill amortization
    if (goodwillAmortization > 0) {
      const { data: gwEntry, error: gwError } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          adjustment_type: AdjustmentType.OTHER,
          amount: -goodwillAmortization,
          description: `At-Equity Firmenwertabschreibung: ${input.subsidiaryName} (${input.goodwill.toFixed(2)} / ${input.goodwillUsefulLife} Jahre)`,
          source: EntrySource.AUTOMATIC,
          status: EntryStatus.APPROVED,
          hgb_reference: HgbReference.SECTION_312,
          affected_company_ids: [input.subsidiaryCompanyId],
          created_at: SupabaseMapper.getCurrentTimestamp(),
          updated_at: SupabaseMapper.getCurrentTimestamp(),
        })
        .select()
        .single();

      if (!gwError && gwEntry) {
        entries.push(SupabaseMapper.toConsolidationEntry(gwEntry));
      }
    }

    // Update participation with new carrying value
    await this.supabase
      .from('participations')
      .update({
        // Store current carrying value in a note or separate field if needed
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .eq('id', input.participationId);

    return {
      participationId: input.participationId,
      subsidiaryName: input.subsidiaryName,
      participationPercentage: input.participationPercentage,
      openingCarryingValue,
      shareOfProfit,
      dividendsReceived: input.dividendsReceived,
      goodwillAmortization,
      otherAdjustments: input.otherComprehensiveIncome || 0,
      closingCarryingValue,
      entries,
    };
  }

  /**
   * Get subsidiary net income from financial statement
   */
  private async getSubsidiaryNetIncome(
    financialStatementId: string,
  ): Promise<number> {
    // Try to get from income statement balances
    const { data: balances, error } = await this.supabase
      .from('income_statement_balances')
      .select(
        `
        *,
        account:income_statement_accounts(*)
      `,
      )
      .eq('financial_statement_id', financialStatementId);

    if (error || !balances || balances.length === 0) {
      // Fallback: calculate from account balances
      const { data: accountBalances } = await this.supabase
        .from('account_balances')
        .select(
          `
          *,
          account:accounts(*)
        `,
        )
        .eq('financial_statement_id', financialStatementId);

      if (!accountBalances) return 0;

      // Sum revenue - expenses
      const revenue = accountBalances
        .filter((ab) => ab.account?.account_type === 'revenue')
        .reduce((sum, ab) => sum + Number(ab.balance || 0), 0);

      const expenses = accountBalances
        .filter((ab) => ab.account?.account_type === 'expense')
        .reduce((sum, ab) => sum + Number(ab.balance || 0), 0);

      return revenue - expenses;
    }

    // Calculate net income from income statement
    return balances.reduce((sum, b) => {
      const amount = Number(b.amount || 0);
      return b.account?.is_income ? sum + amount : sum - amount;
    }, 0);
  }

  /**
   * Get dividends received from subsidiary
   */
  private async getDividendsReceived(
    parentCompanyId: string,
    subsidiaryCompanyId: string,
  ): Promise<number> {
    // Look for dividend transactions in intercompany transactions
    const { data: transactions } = await this.supabase
      .from('intercompany_transactions')
      .select('*')
      .eq('from_company_id', subsidiaryCompanyId)
      .eq('to_company_id', parentCompanyId)
      .eq('transaction_type', 'dividend');

    if (!transactions || transactions.length === 0) return 0;

    return transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }

  /**
   * Get equity method summary for notes disclosure
   */
  async getEquityMethodDisclosure(
    financialStatementId: string,
    parentCompanyId: string,
  ): Promise<any> {
    const { results, summary } = await this.calculateEquityMethod(
      financialStatementId,
      parentCompanyId,
    );

    return {
      associates: results.map((r) => ({
        name: r.subsidiaryName,
        ownershipPercentage: r.participationPercentage,
        carryingValue: r.closingCarryingValue,
        shareOfProfit: r.shareOfProfit,
      })),
      totals: {
        carryingValue: summary.totalCarryingValue,
        shareOfProfit: summary.totalShareOfProfit,
      },
      hgbReference: '§ 312 HGB',
      methodology:
        'Die Beteiligungen an assoziierten Unternehmen werden nach der Equity-Methode bewertet. Der Unterschiedsbetrag zwischen Anschaffungskosten und anteiligem Eigenkapital wurde als Geschäfts- oder Firmenwert aktiviert und wird planmäßig abgeschrieben.',
    };
  }
}
