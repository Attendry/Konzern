import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import { AdjustmentType, EntrySource, EntryStatus, HgbReference, ConsolidationEntry } from '../../entities/consolidation-entry.entity';

// Proportional consolidation result
export interface ProportionalConsolidationResult {
  companyId: string;
  companyName: string;
  participationPercentage: number;
  // Original amounts
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalRevenue: number;
  totalExpenses: number;
  // Proportional amounts (quota)
  proportionalAssets: number;
  proportionalLiabilities: number;
  proportionalEquity: number;
  proportionalRevenue: number;
  proportionalExpenses: number;
  // IC eliminations (proportional)
  icEliminationsAssets: number;
  icEliminationsLiabilities: number;
  icEliminationsRevenue: number;
  icEliminationsExpenses: number;
  // Entries created
  entries: ConsolidationEntry[];
}

@Injectable()
export class ProportionalConsolidationService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Perform proportional consolidation for joint ventures
   * (§ 310 HGB - Quotenkonsolidierung für Gemeinschaftsunternehmen)
   */
  async consolidateProportionally(
    financialStatementId: string,
    parentCompanyId: string,
  ): Promise<{ results: ProportionalConsolidationResult[]; summary: any }> {
    console.log(`[ProportionalConsolidationService] Consolidating proportionally for parent: ${parentCompanyId}`);

    // Get all proportionally consolidated companies (joint ventures)
    const { data: jointVentures, error: jvError } = await this.supabase
      .from('companies')
      .select(`
        *,
        participations:participations!participations_subsidiary_company_id_fkey(*)
      `)
      .eq('consolidation_type', 'proportional');

    if (jvError) {
      SupabaseErrorHandler.handle(jvError, 'Joint Ventures', 'fetch');
    }

    const results: ProportionalConsolidationResult[] = [];

    for (const jv of jointVentures || []) {
      // Find participation from parent
      const participation = jv.participations?.find(
        (p: any) => p.parent_company_id === parentCompanyId && p.is_active,
      );

      if (!participation) {
        console.warn(`No active participation found for joint venture ${jv.name}`);
        continue;
      }

      // Get joint venture's financial statement
      const { data: jvFS, error: fsError } = await this.supabase
        .from('financial_statements')
        .select('*')
        .eq('company_id', jv.id)
        .order('fiscal_year', { ascending: false })
        .limit(1)
        .single();

      if (fsError || !jvFS) {
        console.warn(`No financial statement found for joint venture ${jv.name}`);
        continue;
      }

      const result = await this.consolidateSingleJointVenture(
        financialStatementId,
        jvFS.id,
        jv.id,
        jv.name,
        Number(participation.participation_percentage),
        parentCompanyId,
      );

      results.push(result);
    }

    // Calculate summary
    const summary = {
      totalJointVentures: results.length,
      totalProportionalAssets: results.reduce((sum, r) => sum + r.proportionalAssets, 0),
      totalProportionalLiabilities: results.reduce((sum, r) => sum + r.proportionalLiabilities, 0),
      totalProportionalRevenue: results.reduce((sum, r) => sum + r.proportionalRevenue, 0),
      totalProportionalExpenses: results.reduce((sum, r) => sum + r.proportionalExpenses, 0),
      totalICEliminations: results.reduce((sum, r) => 
        sum + r.icEliminationsAssets + r.icEliminationsLiabilities + r.icEliminationsRevenue + r.icEliminationsExpenses, 0),
    };

    return { results, summary };
  }

  /**
   * Consolidate a single joint venture proportionally
   */
  private async consolidateSingleJointVenture(
    parentFinancialStatementId: string,
    jvFinancialStatementId: string,
    jvCompanyId: string,
    jvCompanyName: string,
    participationPercentage: number,
    parentCompanyId: string,
  ): Promise<ProportionalConsolidationResult> {
    const entries: ConsolidationEntry[] = [];
    const quota = participationPercentage / 100;

    // Get account balances for joint venture
    const { data: balances, error: balError } = await this.supabase
      .from('account_balances')
      .select(`
        *,
        account:accounts(*)
      `)
      .eq('financial_statement_id', jvFinancialStatementId);

    if (balError) {
      SupabaseErrorHandler.handle(balError, 'Account Balances', 'fetch');
    }

    // Calculate totals by type
    const totals = {
      assets: 0,
      liabilities: 0,
      equity: 0,
      revenue: 0,
      expenses: 0,
    };

    for (const balance of balances || []) {
      const amount = Number(balance.balance || 0);
      switch (balance.account?.account_type) {
        case 'asset':
          totals.assets += amount;
          break;
        case 'liability':
          totals.liabilities += amount;
          break;
        case 'equity':
          totals.equity += amount;
          break;
        case 'revenue':
          totals.revenue += amount;
          break;
        case 'expense':
          totals.expenses += amount;
          break;
      }
    }

    // Calculate proportional amounts
    const proportional = {
      assets: totals.assets * quota,
      liabilities: totals.liabilities * quota,
      equity: totals.equity * quota,
      revenue: totals.revenue * quota,
      expenses: totals.expenses * quota,
    };

    // Get intercompany balances that need to be eliminated (proportionally)
    const { data: icTransactions } = await this.supabase
      .from('intercompany_transactions')
      .select('*')
      .or(`from_company_id.eq.${jvCompanyId},to_company_id.eq.${jvCompanyId}`);

    const icEliminations = {
      assets: 0,
      liabilities: 0,
      revenue: 0,
      expenses: 0,
    };

    // Process IC transactions and create proportional elimination entries
    for (const ic of icTransactions || []) {
      const isFromJV = ic.from_company_id === jvCompanyId;
      const isWithParent = ic.from_company_id === parentCompanyId || ic.to_company_id === parentCompanyId;
      
      if (!isWithParent) continue; // Only eliminate transactions with parent

      const icAmount = Number(ic.amount || 0);
      const proportionalIcAmount = icAmount * quota;

      // Create elimination entry
      const { data: elimEntry, error: elimError } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: parentFinancialStatementId,
          adjustment_type: AdjustmentType.ELIMINATION,
          amount: -proportionalIcAmount,
          description: `Quotenkonsolidierung IC-Eliminierung: ${jvCompanyName} (${participationPercentage}% von ${icAmount.toFixed(2)})`,
          source: EntrySource.AUTOMATIC,
          status: EntryStatus.APPROVED,
          hgb_reference: HgbReference.OTHER,
          affected_company_ids: [jvCompanyId, parentCompanyId],
          created_at: SupabaseMapper.getCurrentTimestamp(),
          updated_at: SupabaseMapper.getCurrentTimestamp(),
        })
        .select()
        .single();

      if (!elimError && elimEntry) {
        entries.push(SupabaseMapper.toConsolidationEntry(elimEntry));
      }

      // Track eliminations by type
      switch (ic.transaction_type) {
        case 'receivable':
        case 'payable':
          if (isFromJV) {
            icEliminations.assets += proportionalIcAmount;
          } else {
            icEliminations.liabilities += proportionalIcAmount;
          }
          break;
        case 'revenue':
        case 'delivery':
          icEliminations.revenue += proportionalIcAmount;
          icEliminations.expenses += proportionalIcAmount;
          break;
      }
    }

    // Create proportional consolidation adjustment entry
    const netProportionalAmount = proportional.assets - proportional.liabilities + proportional.revenue - proportional.expenses;
    
    if (netProportionalAmount !== 0) {
      const { data: propEntry, error: propError } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: parentFinancialStatementId,
          adjustment_type: AdjustmentType.OTHER,
          amount: netProportionalAmount,
          description: `Quotenkonsolidierung: ${jvCompanyName} - Anteilige Einbeziehung (${participationPercentage}%)`,
          source: EntrySource.AUTOMATIC,
          status: EntryStatus.APPROVED,
          hgb_reference: HgbReference.OTHER,
          affected_company_ids: [jvCompanyId],
          created_at: SupabaseMapper.getCurrentTimestamp(),
          updated_at: SupabaseMapper.getCurrentTimestamp(),
        })
        .select()
        .single();

      if (!propError && propEntry) {
        entries.push(SupabaseMapper.toConsolidationEntry(propEntry));
      }
    }

    return {
      companyId: jvCompanyId,
      companyName: jvCompanyName,
      participationPercentage,
      totalAssets: totals.assets,
      totalLiabilities: totals.liabilities,
      totalEquity: totals.equity,
      totalRevenue: totals.revenue,
      totalExpenses: totals.expenses,
      proportionalAssets: proportional.assets,
      proportionalLiabilities: proportional.liabilities,
      proportionalEquity: proportional.equity,
      proportionalRevenue: proportional.revenue,
      proportionalExpenses: proportional.expenses,
      icEliminationsAssets: icEliminations.assets,
      icEliminationsLiabilities: icEliminations.liabilities,
      icEliminationsRevenue: icEliminations.revenue,
      icEliminationsExpenses: icEliminations.expenses,
      entries,
    };
  }

  /**
   * Get proportional consolidation disclosure for notes
   */
  async getProportionalDisclosure(
    financialStatementId: string,
    parentCompanyId: string,
  ): Promise<any> {
    const { results, summary } = await this.consolidateProportionally(
      financialStatementId,
      parentCompanyId,
    );

    return {
      jointVentures: results.map(r => ({
        name: r.companyName,
        participationPercentage: r.participationPercentage,
        proportionalAssets: r.proportionalAssets,
        proportionalLiabilities: r.proportionalLiabilities,
        proportionalRevenue: r.proportionalRevenue,
        proportionalExpenses: r.proportionalExpenses,
      })),
      totals: {
        assets: summary.totalProportionalAssets,
        liabilities: summary.totalProportionalLiabilities,
        revenue: summary.totalProportionalRevenue,
        expenses: summary.totalProportionalExpenses,
        icEliminations: summary.totalICEliminations,
      },
      hgbReference: '§ 310 HGB',
      methodology: 'Gemeinschaftsunternehmen werden entsprechend dem Anteil am Kapital (Quotenkonsolidierung) in den Konzernabschluss einbezogen. Konzerninterne Geschäftsvorfälle werden anteilig eliminiert.',
    };
  }
}
