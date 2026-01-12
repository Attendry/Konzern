import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdjustmentType, EntrySource, EntryStatus, HgbReference } from '../../entities/consolidation-entry.entity';

/**
 * First Consolidation (Erstkonsolidierung) according to HGB § 301
 * 
 * This service handles the initial consolidation of a subsidiary including:
 * - Purchase Price Allocation (Kaufpreisallokation)
 * - Goodwill calculation (Geschäfts- oder Firmenwert)
 * - Hidden reserves/liabilities (Stille Reserven/Lasten)
 * - Minority interests at acquisition
 */

export interface FirstConsolidationInput {
  parentCompanyId: string;
  subsidiaryCompanyId: string;
  acquisitionDate: string;
  participationPercentage: number;
  acquisitionCost: number;
  // Equity components at acquisition date
  subscribedCapital: number;
  capitalReserves: number;
  revenueReserves: number;
  retainedEarnings: number;
  // Hidden reserves/liabilities (optional)
  hiddenReserves?: number;
  hiddenLiabilities?: number;
  // Financial statement for booking
  financialStatementId: string;
  // User creating this
  userId?: string;
}

export interface FirstConsolidationResult {
  participationId: string;
  goodwill: number;
  negativeGoodwill: number;
  minorityInterestAtAcquisition: number;
  hiddenReserves: number;
  hiddenLiabilities: number;
  consolidationEntries: any[];
  summary: {
    equityAtAcquisition: number;
    adjustedEquity: number;
    parentShare: number;
    minorityShare: number;
    difference: number;
  };
}

export interface DeconsolidationInput {
  participationId: string;
  disposalDate: string;
  disposalProceeds: number;
  financialStatementId: string;
  userId?: string;
}

export interface DeconsolidationResult {
  disposalGainLoss: number;
  consolidationEntries: any[];
  summary: {
    bookValue: number;
    disposalProceeds: number;
    cumulativeGoodwillWriteOff: number;
    cumulativeTranslationDifference: number;
    minorityInterestReleased: number;
  };
}

@Injectable()
export class FirstConsolidationService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Perform first consolidation (Erstkonsolidierung) according to HGB § 301
   */
  async performFirstConsolidation(input: FirstConsolidationInput): Promise<FirstConsolidationResult> {
    // Validate input
    if (input.participationPercentage <= 0 || input.participationPercentage > 100) {
      throw new BadRequestException('Beteiligungsquote muss zwischen 0 und 100% liegen');
    }

    // Calculate total equity at acquisition
    const equityAtAcquisition = 
      input.subscribedCapital + 
      input.capitalReserves + 
      input.revenueReserves + 
      input.retainedEarnings;

    // Adjust for hidden reserves/liabilities
    const hiddenReserves = input.hiddenReserves || 0;
    const hiddenLiabilities = input.hiddenLiabilities || 0;
    const adjustedEquity = equityAtAcquisition + hiddenReserves - hiddenLiabilities;

    // Calculate parent's share of adjusted equity
    const parentShare = adjustedEquity * (input.participationPercentage / 100);
    
    // Calculate minority interest (if < 100% ownership)
    const minorityPercentage = 100 - input.participationPercentage;
    const minorityShare = adjustedEquity * (minorityPercentage / 100);

    // Calculate goodwill/negative goodwill
    // Goodwill = Acquisition Cost - Parent's Share of Adjusted Equity
    const difference = input.acquisitionCost - parentShare;
    const goodwill = difference > 0 ? difference : 0;
    const negativeGoodwill = difference < 0 ? Math.abs(difference) : 0;

    // Create or update participation record
    const { data: existingParticipation } = await this.supabase
      .from('participations')
      .select('id')
      .eq('parent_company_id', input.parentCompanyId)
      .eq('subsidiary_company_id', input.subsidiaryCompanyId)
      .single();

    let participationId: string;

    if (existingParticipation) {
      // Update existing participation
      const { data, error } = await this.supabase
        .from('participations')
        .update({
          participation_percentage: input.participationPercentage,
          acquisition_cost: input.acquisitionCost,
          acquisition_date: input.acquisitionDate,
          goodwill: goodwill,
          negative_goodwill: negativeGoodwill,
          hidden_reserves: hiddenReserves,
          hidden_liabilities: hiddenLiabilities,
          equity_at_acquisition: equityAtAcquisition,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingParticipation.id)
        .select()
        .single();

      if (error) throw new BadRequestException(`Fehler: ${error.message}`);
      participationId = data.id;
    } else {
      // Create new participation
      const { data, error } = await this.supabase
        .from('participations')
        .insert({
          parent_company_id: input.parentCompanyId,
          subsidiary_company_id: input.subsidiaryCompanyId,
          participation_percentage: input.participationPercentage,
          acquisition_cost: input.acquisitionCost,
          acquisition_date: input.acquisitionDate,
          goodwill: goodwill,
          negative_goodwill: negativeGoodwill,
          hidden_reserves: hiddenReserves,
          hidden_liabilities: hiddenLiabilities,
          equity_at_acquisition: equityAtAcquisition,
          is_direct: true,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new BadRequestException(`Fehler: ${error.message}`);
      participationId = data.id;
    }

    // Update subsidiary company with first consolidation date
    await this.supabase
      .from('companies')
      .update({
        first_consolidation_date: input.acquisitionDate,
        is_consolidated: true,
        consolidation_type: 'full',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.subsidiaryCompanyId);

    // Create ownership history entry
    await this.supabase
      .from('ownership_history')
      .insert({
        participation_id: participationId,
        change_type: 'initial',
        effective_date: input.acquisitionDate,
        percentage_before: 0,
        percentage_after: input.participationPercentage,
        percentage_change: input.participationPercentage,
        transaction_amount: input.acquisitionCost,
        goodwill_change: goodwill - negativeGoodwill,
        description: `Erstkonsolidierung: Erwerb von ${input.participationPercentage}% der Anteile`,
        created_at: new Date().toISOString(),
      });

    // Create consolidation entries
    const consolidationEntries: any[] = [];

    // Entry 1: Eliminate investment against equity (Aufrechnung)
    // Debit: Equity components of subsidiary
    // Credit: Investment in subsidiary
    const { data: entry1, error: entry1Error } = await this.supabase
      .from('consolidation_entries')
      .insert({
        financial_statement_id: input.financialStatementId,
        adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
        amount: parentShare,
        description: `Erstkonsolidierung ${input.subsidiaryCompanyId}: Aufrechnung Beteiligung gegen anteiliges Eigenkapital (${input.participationPercentage}%)`,
        source: EntrySource.MANUAL,
        status: EntryStatus.DRAFT,
        hgb_reference: HgbReference.SECTION_301,
        affected_company_ids: [input.parentCompanyId, input.subsidiaryCompanyId],
        created_by_user_id: input.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!entry1Error && entry1) consolidationEntries.push(entry1);

    // Entry 2: Goodwill (if positive)
    if (goodwill > 0) {
      const { data: entry2, error: entry2Error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: input.financialStatementId,
          adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
          amount: goodwill,
          description: `Erstkonsolidierung: Aktivierung Geschäfts- oder Firmenwert (Goodwill)`,
          source: EntrySource.MANUAL,
          status: EntryStatus.DRAFT,
          hgb_reference: HgbReference.SECTION_301,
          affected_company_ids: [input.parentCompanyId, input.subsidiaryCompanyId],
          created_by_user_id: input.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!entry2Error && entry2) consolidationEntries.push(entry2);
    }

    // Entry 3: Negative Goodwill (if negative)
    if (negativeGoodwill > 0) {
      const { data: entry3, error: entry3Error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: input.financialStatementId,
          adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
          amount: negativeGoodwill,
          description: `Erstkonsolidierung: Passivierung Unterschiedsbetrag (negativer Goodwill)`,
          source: EntrySource.MANUAL,
          status: EntryStatus.DRAFT,
          hgb_reference: HgbReference.SECTION_301,
          affected_company_ids: [input.parentCompanyId, input.subsidiaryCompanyId],
          created_by_user_id: input.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!entry3Error && entry3) consolidationEntries.push(entry3);
    }

    // Entry 4: Minority interests (if < 100% ownership)
    if (minorityShare > 0) {
      const { data: entry4, error: entry4Error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: input.financialStatementId,
          adjustment_type: AdjustmentType.MINORITY_INTEREST,
          amount: minorityShare,
          description: `Erstkonsolidierung: Ansatz Anteile anderer Gesellschafter (${minorityPercentage}%)`,
          source: EntrySource.MANUAL,
          status: EntryStatus.DRAFT,
          hgb_reference: HgbReference.SECTION_307,
          affected_company_ids: [input.subsidiaryCompanyId],
          created_by_user_id: input.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!entry4Error && entry4) consolidationEntries.push(entry4);
    }

    // Entry 5: Hidden reserves (if any)
    if (hiddenReserves > 0) {
      const { data: entry5, error: entry5Error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: input.financialStatementId,
          adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
          amount: hiddenReserves,
          description: `Erstkonsolidierung: Aufdeckung stille Reserven`,
          source: EntrySource.MANUAL,
          status: EntryStatus.DRAFT,
          hgb_reference: HgbReference.SECTION_301,
          affected_company_ids: [input.subsidiaryCompanyId],
          created_by_user_id: input.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!entry5Error && entry5) consolidationEntries.push(entry5);
    }

    return {
      participationId,
      goodwill,
      negativeGoodwill,
      minorityInterestAtAcquisition: minorityShare,
      hiddenReserves,
      hiddenLiabilities,
      consolidationEntries,
      summary: {
        equityAtAcquisition,
        adjustedEquity,
        parentShare,
        minorityShare,
        difference,
      },
    };
  }

  /**
   * Perform deconsolidation (Entkonsolidierung)
   */
  async performDeconsolidation(input: DeconsolidationInput): Promise<DeconsolidationResult> {
    // Get participation details
    const { data: participation, error: partError } = await this.supabase
      .from('participations')
      .select('*, subsidiary_company:companies!participations_subsidiary_company_id_fkey(*)')
      .eq('id', input.participationId)
      .single();

    if (partError || !participation) {
      throw new NotFoundException('Beteiligung nicht gefunden');
    }

    if (!participation.is_active) {
      throw new BadRequestException('Diese Beteiligung wurde bereits entkonsolidiert');
    }

    // Calculate book value of investment
    const acquisitionCost = parseFloat(participation.acquisition_cost) || 0;
    const goodwill = parseFloat(participation.goodwill) || 0;
    const negativeGoodwill = parseFloat(participation.negative_goodwill) || 0;
    
    // Get cumulative goodwill amortization (simplified - would need tracking)
    const cumulativeGoodwillWriteOff = 0; // TODO: Track goodwill amortization

    // Get cumulative translation difference
    const { data: translationDiffs } = await this.supabase
      .from('currency_translation_differences')
      .select('cumulative_difference')
      .eq('company_id', participation.subsidiary_company_id)
      .order('fiscal_year', { ascending: false })
      .limit(1)
      .single();

    const cumulativeTranslationDifference = translationDiffs 
      ? parseFloat(translationDiffs.cumulative_difference) || 0 
      : 0;

    // Calculate minority interest to be released
    const minorityPercentage = 100 - parseFloat(participation.participation_percentage);
    const equityAtAcquisition = parseFloat(participation.equity_at_acquisition) || 0;
    const minorityInterestReleased = equityAtAcquisition * (minorityPercentage / 100);

    // Calculate book value
    const bookValue = acquisitionCost + goodwill - negativeGoodwill - cumulativeGoodwillWriteOff;

    // Calculate disposal gain/loss
    const disposalGainLoss = input.disposalProceeds - bookValue + cumulativeTranslationDifference;

    // Update participation
    await this.supabase
      .from('participations')
      .update({
        is_active: false,
        disposal_date: input.disposalDate,
        disposal_proceeds: input.disposalProceeds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.participationId);

    // Update subsidiary company
    await this.supabase
      .from('companies')
      .update({
        deconsolidation_date: input.disposalDate,
        is_consolidated: false,
        consolidation_type: 'none',
        updated_at: new Date().toISOString(),
      })
      .eq('id', participation.subsidiary_company_id);

    // Create ownership history entry
    await this.supabase
      .from('ownership_history')
      .insert({
        participation_id: input.participationId,
        change_type: 'full_sale',
        effective_date: input.disposalDate,
        percentage_before: participation.participation_percentage,
        percentage_after: 0,
        percentage_change: -participation.participation_percentage,
        transaction_amount: input.disposalProceeds,
        goodwill_change: -goodwill,
        description: `Entkonsolidierung: Vollständige Veräußerung`,
        created_at: new Date().toISOString(),
      });

    // Create consolidation entries
    const consolidationEntries: any[] = [];

    // Entry 1: Derecognize goodwill
    if (goodwill > 0) {
      const { data: entry1 } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: input.financialStatementId,
          adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
          amount: -goodwill,
          description: `Entkonsolidierung: Ausbuchung Geschäfts- oder Firmenwert`,
          source: EntrySource.MANUAL,
          status: EntryStatus.DRAFT,
          hgb_reference: HgbReference.SECTION_301,
          affected_company_ids: [participation.parent_company_id, participation.subsidiary_company_id],
          created_by_user_id: input.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (entry1) consolidationEntries.push(entry1);
    }

    // Entry 2: Release minority interests
    if (minorityInterestReleased > 0) {
      const { data: entry2 } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: input.financialStatementId,
          adjustment_type: AdjustmentType.MINORITY_INTEREST,
          amount: -minorityInterestReleased,
          description: `Entkonsolidierung: Auflösung Anteile anderer Gesellschafter`,
          source: EntrySource.MANUAL,
          status: EntryStatus.DRAFT,
          hgb_reference: HgbReference.SECTION_307,
          affected_company_ids: [participation.subsidiary_company_id],
          created_by_user_id: input.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (entry2) consolidationEntries.push(entry2);
    }

    // Entry 3: Disposal gain/loss
    const { data: entry3 } = await this.supabase
      .from('consolidation_entries')
      .insert({
        financial_statement_id: input.financialStatementId,
        adjustment_type: AdjustmentType.CAPITAL_CONSOLIDATION,
        amount: disposalGainLoss,
        description: `Entkonsolidierung: ${disposalGainLoss >= 0 ? 'Entkonsolidierungsgewinn' : 'Entkonsolidierungsverlust'}`,
        source: EntrySource.MANUAL,
        status: EntryStatus.DRAFT,
        hgb_reference: HgbReference.SECTION_301,
        affected_company_ids: [participation.parent_company_id, participation.subsidiary_company_id],
        created_by_user_id: input.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (entry3) consolidationEntries.push(entry3);

    // Entry 4: Reclassify translation difference to P&L
    if (Math.abs(cumulativeTranslationDifference) > 0.01) {
      const { data: entry4 } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: input.financialStatementId,
          adjustment_type: AdjustmentType.CURRENCY_TRANSLATION,
          amount: -cumulativeTranslationDifference,
          description: `Entkonsolidierung: Umgliederung kumulierter Währungsdifferenzen in GuV`,
          source: EntrySource.MANUAL,
          status: EntryStatus.DRAFT,
          hgb_reference: HgbReference.SECTION_308A,
          affected_company_ids: [participation.subsidiary_company_id],
          created_by_user_id: input.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (entry4) consolidationEntries.push(entry4);
    }

    return {
      disposalGainLoss,
      consolidationEntries,
      summary: {
        bookValue,
        disposalProceeds: input.disposalProceeds,
        cumulativeGoodwillWriteOff,
        cumulativeTranslationDifference,
        minorityInterestReleased,
      },
    };
  }

  /**
   * Calculate minority interests for ongoing consolidation (§ 307 HGB)
   */
  async calculateMinorityInterests(
    financialStatementId: string,
    companyId: string,
  ): Promise<{
    minorityInterestEquity: number;
    minorityInterestProfit: number;
    details: any[];
  }> {
    // Get participation details
    const { data: participation } = await this.supabase
      .from('participations')
      .select('*')
      .eq('subsidiary_company_id', companyId)
      .eq('is_active', true)
      .single();

    if (!participation) {
      return { minorityInterestEquity: 0, minorityInterestProfit: 0, details: [] };
    }

    const minorityPercentage = 100 - parseFloat(participation.participation_percentage);
    if (minorityPercentage <= 0) {
      return { minorityInterestEquity: 0, minorityInterestProfit: 0, details: [] };
    }

    // Get current equity from account balances
    const { data: equityBalances } = await this.supabase
      .from('account_balances')
      .select('balance, accounts(account_type)')
      .eq('financial_statement_id', financialStatementId)
      .eq('accounts.account_type', 'equity');

    let totalEquity = 0;
    for (const bal of equityBalances || []) {
      totalEquity += parseFloat(bal.balance) || 0;
    }

    // Get current year profit from income statement
    const { data: incomeBalances } = await this.supabase
      .from('income_statement_balances')
      .select('balance')
      .eq('financial_statement_id', financialStatementId);

    let totalProfit = 0;
    for (const bal of incomeBalances || []) {
      totalProfit += parseFloat(bal.balance) || 0;
    }

    const minorityInterestEquity = totalEquity * (minorityPercentage / 100);
    const minorityInterestProfit = totalProfit * (minorityPercentage / 100);

    return {
      minorityInterestEquity,
      minorityInterestProfit,
      details: [{
        companyId,
        minorityPercentage,
        totalEquity,
        totalProfit,
        minorityInterestEquity,
        minorityInterestProfit,
      }],
    };
  }

  /**
   * Get first consolidation summary for a subsidiary
   */
  async getFirstConsolidationSummary(subsidiaryCompanyId: string): Promise<any> {
    const { data: participation } = await this.supabase
      .from('participations')
      .select(`
        *,
        parent_company:companies!participations_parent_company_id_fkey(id, name),
        subsidiary_company:companies!participations_subsidiary_company_id_fkey(id, name)
      `)
      .eq('subsidiary_company_id', subsidiaryCompanyId)
      .eq('is_active', true)
      .single();

    if (!participation) {
      return null;
    }

    const { data: history } = await this.supabase
      .from('ownership_history')
      .select('*')
      .eq('participation_id', participation.id)
      .order('effective_date', { ascending: true });

    return {
      participation,
      history: history || [],
    };
  }
}
