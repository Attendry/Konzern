import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import {
  DeferredTax,
  DeferredTaxSource,
  DeferredTaxStatus,
  DeferredTaxSummary,
  TemporaryDifferenceType,
} from '../../entities/deferred-tax.entity';
import {
  AdjustmentType,
  EntrySource,
  EntryStatus,
  HgbReference,
} from '../../entities/consolidation-entry.entity';

// Default corporate tax rate in Germany (Körperschaftsteuer + Solidaritätszuschlag + Gewerbesteuer)
const DEFAULT_TAX_RATE = 30.0; // ~30% combined tax rate

interface CreateDeferredTaxDto {
  financialStatementId: string;
  companyId: string;
  differenceType: TemporaryDifferenceType;
  source: DeferredTaxSource;
  description: string;
  temporaryDifferenceAmount: number;
  taxRate?: number;
  affectsEquity?: boolean;
  expectedReversalYear?: number;
  originatingEntryId?: string;
  hgbNote?: string;
}

interface UpdateDeferredTaxDto {
  temporaryDifferenceAmount?: number;
  taxRate?: number;
  description?: string;
  expectedReversalYear?: number;
  status?: DeferredTaxStatus;
  hgbNote?: string;
}

@Injectable()
export class DeferredTaxService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Calculate deferred taxes for all consolidation entries in a financial statement
   */
  async calculateDeferredTaxes(
    financialStatementId: string,
    taxRate: number = DEFAULT_TAX_RATE,
  ): Promise<{ deferredTaxes: DeferredTax[]; summary: DeferredTaxSummary }> {
    console.log(
      `[DeferredTaxService] Calculating deferred taxes for statement: ${financialStatementId}`,
    );

    // Get all approved consolidation entries that create temporary differences
    const { data: entries, error } = await this.supabase
      .from('consolidation_entries')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .eq('status', 'approved')
      .in('adjustment_type', [
        AdjustmentType.CAPITAL_CONSOLIDATION,
        AdjustmentType.DEBT_CONSOLIDATION,
        AdjustmentType.INTERCOMPANY_PROFIT,
        AdjustmentType.INCOME_EXPENSE,
        AdjustmentType.CURRENCY_TRANSLATION,
      ]);

    if (error) {
      SupabaseErrorHandler.handle(error, 'Consolidation Entries', 'fetch');
    }

    const deferredTaxes: DeferredTax[] = [];

    for (const entry of entries || []) {
      // Determine if this creates a deductible or taxable difference
      const differenceType = this.determineDifferenceType(
        entry.adjustment_type,
        entry.amount,
      );

      // Determine source
      const source = this.mapAdjustmentTypeToSource(entry.adjustment_type);

      // Calculate deferred tax amount
      const deferredTaxAmount = Math.abs(entry.amount) * (taxRate / 100);

      // Check if deferred tax already exists for this entry
      const { data: existing } = await this.supabase
        .from('deferred_taxes')
        .select('*')
        .eq('originating_entry_id', entry.id)
        .single();

      if (existing) {
        // Update existing deferred tax
        const priorYearAmount = existing.deferred_tax_amount;
        const changeAmount = deferredTaxAmount - priorYearAmount;

        const { data: updated, error: updateError } = await this.supabase
          .from('deferred_taxes')
          .update({
            temporary_difference_amount: Math.abs(entry.amount),
            deferred_tax_amount: deferredTaxAmount,
            prior_year_amount: priorYearAmount,
            change_amount: changeAmount,
            tax_rate: taxRate,
            updated_at: SupabaseMapper.getCurrentTimestamp(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating deferred tax:', updateError);
          continue;
        }

        deferredTaxes.push(this.mapToDeferredTax(updated));
      } else {
        // Create new deferred tax
        const { data: created, error: createError } = await this.supabase
          .from('deferred_taxes')
          .insert({
            financial_statement_id: financialStatementId,
            company_id: entry.affected_company_ids?.[0] || null,
            difference_type: differenceType,
            source: source,
            description: `Latente Steuern aus: ${entry.description || entry.adjustment_type}`,
            temporary_difference_amount: Math.abs(entry.amount),
            tax_rate: taxRate,
            deferred_tax_amount: deferredTaxAmount,
            affects_equity:
              entry.adjustment_type === AdjustmentType.CURRENCY_TRANSLATION,
            originating_entry_id: entry.id,
            hgb_note: 'Gemäß § 306 HGB',
            created_at: SupabaseMapper.getCurrentTimestamp(),
            updated_at: SupabaseMapper.getCurrentTimestamp(),
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating deferred tax:', createError);
          continue;
        }

        deferredTaxes.push(this.mapToDeferredTax(created));
      }
    }

    // Create consolidation entries for deferred taxes
    await this.createDeferredTaxEntries(financialStatementId, deferredTaxes);

    // Calculate summary
    const summary = this.calculateSummary(deferredTaxes);

    return { deferredTaxes, summary };
  }

  /**
   * Get all deferred taxes for a financial statement
   */
  async getDeferredTaxes(financialStatementId: string): Promise<DeferredTax[]> {
    const { data, error } = await this.supabase
      .from('deferred_taxes')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .order('created_at', { ascending: false });

    if (error) {
      SupabaseErrorHandler.handle(error, 'Deferred Taxes', 'fetch');
    }

    return (data || []).map(this.mapToDeferredTax);
  }

  /**
   * Get deferred tax summary for a financial statement
   */
  async getDeferredTaxSummary(
    financialStatementId: string,
  ): Promise<DeferredTaxSummary> {
    const deferredTaxes = await this.getDeferredTaxes(financialStatementId);
    return this.calculateSummary(deferredTaxes);
  }

  /**
   * Create a manual deferred tax entry
   */
  async createDeferredTax(dto: CreateDeferredTaxDto): Promise<DeferredTax> {
    const taxRate = dto.taxRate || DEFAULT_TAX_RATE;
    const deferredTaxAmount =
      Math.abs(dto.temporaryDifferenceAmount) * (taxRate / 100);

    const { data, error } = await this.supabase
      .from('deferred_taxes')
      .insert({
        financial_statement_id: dto.financialStatementId,
        company_id: dto.companyId,
        difference_type: dto.differenceType,
        source: dto.source,
        description: dto.description,
        temporary_difference_amount: dto.temporaryDifferenceAmount,
        tax_rate: taxRate,
        deferred_tax_amount: deferredTaxAmount,
        affects_equity: dto.affectsEquity || false,
        expected_reversal_year: dto.expectedReversalYear,
        originating_entry_id: dto.originatingEntryId,
        hgb_note: dto.hgbNote || 'Manuelle Erfassung gemäß § 306 HGB',
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Deferred Tax', 'create');
    }

    return this.mapToDeferredTax(data);
  }

  /**
   * Update a deferred tax entry
   */
  async updateDeferredTax(
    id: string,
    dto: UpdateDeferredTaxDto,
  ): Promise<DeferredTax> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('deferred_taxes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(`Latente Steuer mit ID ${id} nicht gefunden`);
    }

    const updateData: any = {
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    };

    if (dto.temporaryDifferenceAmount !== undefined) {
      updateData.temporary_difference_amount = dto.temporaryDifferenceAmount;
      const taxRate = dto.taxRate || existing.tax_rate;
      updateData.deferred_tax_amount =
        Math.abs(dto.temporaryDifferenceAmount) * (taxRate / 100);
    }

    if (dto.taxRate !== undefined) {
      updateData.tax_rate = dto.taxRate;
      const amount =
        dto.temporaryDifferenceAmount || existing.temporary_difference_amount;
      updateData.deferred_tax_amount = Math.abs(amount) * (dto.taxRate / 100);
    }

    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.expectedReversalYear !== undefined)
      updateData.expected_reversal_year = dto.expectedReversalYear;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.hgbNote !== undefined) updateData.hgb_note = dto.hgbNote;

    const { data, error } = await this.supabase
      .from('deferred_taxes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Deferred Tax', 'update');
    }

    return this.mapToDeferredTax(data);
  }

  /**
   * Delete a deferred tax entry
   */
  async deleteDeferredTax(id: string): Promise<void> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('deferred_taxes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException(`Latente Steuer mit ID ${id} nicht gefunden`);
    }

    // Also delete associated consolidation entry if exists
    if (existing.deferred_tax_entry_id) {
      await this.supabase
        .from('consolidation_entries')
        .delete()
        .eq('id', existing.deferred_tax_entry_id);
    }

    const { error } = await this.supabase
      .from('deferred_taxes')
      .delete()
      .eq('id', id);

    if (error) {
      SupabaseErrorHandler.handle(error, 'Deferred Tax', 'delete');
    }
  }

  /**
   * Create consolidation entries for deferred taxes
   */
  private async createDeferredTaxEntries(
    financialStatementId: string,
    deferredTaxes: DeferredTax[],
  ): Promise<void> {
    for (const dt of deferredTaxes) {
      // Skip if already has an entry
      if (dt.deferredTaxEntryId) continue;

      const isAsset = dt.differenceType === TemporaryDifferenceType.DEDUCTIBLE;

      const { data: entry, error } = await this.supabase
        .from('consolidation_entries')
        .insert({
          financial_statement_id: financialStatementId,
          adjustment_type: AdjustmentType.DEFERRED_TAX,
          amount: isAsset ? dt.deferredTaxAmount : -dt.deferredTaxAmount,
          description: `Latente Steuern (${isAsset ? 'Aktiv' : 'Passiv'}): ${dt.description}`,
          source: EntrySource.AUTOMATIC,
          status: EntryStatus.APPROVED,
          hgb_reference: HgbReference.SECTION_306,
          created_at: SupabaseMapper.getCurrentTimestamp(),
          updated_at: SupabaseMapper.getCurrentTimestamp(),
        })
        .select()
        .single();

      if (!error && entry) {
        // Update deferred tax with entry reference
        await this.supabase
          .from('deferred_taxes')
          .update({ deferred_tax_entry_id: entry.id })
          .eq('id', dt.id);
      }
    }
  }

  /**
   * Determine if a temporary difference is deductible or taxable
   */
  private determineDifferenceType(
    adjustmentType: string,
    amount: number,
  ): TemporaryDifferenceType {
    // Negative consolidation adjustments typically create deferred tax assets
    // Positive consolidation adjustments typically create deferred tax liabilities
    switch (adjustmentType) {
      case AdjustmentType.INTERCOMPANY_PROFIT:
        // Eliminating IC profits creates temporary difference that reverses when goods are sold
        return amount < 0
          ? TemporaryDifferenceType.DEDUCTIBLE
          : TemporaryDifferenceType.TAXABLE;

      case AdjustmentType.CAPITAL_CONSOLIDATION:
        // Hidden reserves create taxable differences, hidden liabilities create deductible
        return amount > 0
          ? TemporaryDifferenceType.TAXABLE
          : TemporaryDifferenceType.DEDUCTIBLE;

      case AdjustmentType.DEBT_CONSOLIDATION:
        // Usually creates temporary differences based on direction
        return amount > 0
          ? TemporaryDifferenceType.TAXABLE
          : TemporaryDifferenceType.DEDUCTIBLE;

      default:
        return amount > 0
          ? TemporaryDifferenceType.TAXABLE
          : TemporaryDifferenceType.DEDUCTIBLE;
    }
  }

  /**
   * Map adjustment type to deferred tax source
   */
  private mapAdjustmentTypeToSource(adjustmentType: string): DeferredTaxSource {
    switch (adjustmentType) {
      case AdjustmentType.CAPITAL_CONSOLIDATION:
        return DeferredTaxSource.CAPITAL_CONSOLIDATION;
      case AdjustmentType.DEBT_CONSOLIDATION:
        return DeferredTaxSource.DEBT_CONSOLIDATION;
      case AdjustmentType.INTERCOMPANY_PROFIT:
        return DeferredTaxSource.INTERCOMPANY_PROFIT;
      case AdjustmentType.INCOME_EXPENSE:
        return DeferredTaxSource.INCOME_EXPENSE;
      default:
        return DeferredTaxSource.OTHER;
    }
  }

  /**
   * Calculate summary of deferred tax positions
   */
  private calculateSummary(deferredTaxes: DeferredTax[]): DeferredTaxSummary {
    const activeTaxes = deferredTaxes.filter(
      (dt) => dt.status === DeferredTaxStatus.ACTIVE,
    );

    const assets = activeTaxes.filter(
      (dt) => dt.differenceType === TemporaryDifferenceType.DEDUCTIBLE,
    );
    const liabilities = activeTaxes.filter(
      (dt) => dt.differenceType === TemporaryDifferenceType.TAXABLE,
    );

    const totalAssets = assets.reduce(
      (sum, dt) => sum + Number(dt.deferredTaxAmount),
      0,
    );
    const totalLiabilities = liabilities.reduce(
      (sum, dt) => sum + Number(dt.deferredTaxAmount),
      0,
    );

    // Group by source
    const bySource: DeferredTaxSummary['bySource'] = [];
    const sources = Object.values(DeferredTaxSource);

    for (const source of sources) {
      const sourceTaxes = activeTaxes.filter((dt) => dt.source === source);
      if (sourceTaxes.length > 0) {
        bySource.push({
          source,
          assets: sourceTaxes
            .filter(
              (dt) => dt.differenceType === TemporaryDifferenceType.DEDUCTIBLE,
            )
            .reduce((sum, dt) => sum + Number(dt.deferredTaxAmount), 0),
          liabilities: sourceTaxes
            .filter(
              (dt) => dt.differenceType === TemporaryDifferenceType.TAXABLE,
            )
            .reduce((sum, dt) => sum + Number(dt.deferredTaxAmount), 0),
        });
      }
    }

    return {
      totalDeferredTaxAssets: totalAssets,
      totalDeferredTaxLiabilities: totalLiabilities,
      netDeferredTax: totalAssets - totalLiabilities,
      changeFromPriorYear: activeTaxes.reduce(
        (sum, dt) => sum + Number(dt.changeAmount || 0),
        0,
      ),
      bySource,
    };
  }

  /**
   * Map database row to DeferredTax entity
   */
  private mapToDeferredTax(data: any): DeferredTax {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      financialStatement: null as any,
      companyId: data.company_id,
      company: null as any,
      differenceType: data.difference_type,
      source: data.source,
      description: data.description,
      temporaryDifferenceAmount: Number(data.temporary_difference_amount),
      taxRate: Number(data.tax_rate),
      deferredTaxAmount: Number(data.deferred_tax_amount),
      priorYearAmount: data.prior_year_amount
        ? Number(data.prior_year_amount)
        : null,
      changeAmount: data.change_amount ? Number(data.change_amount) : null,
      affectsEquity: data.affects_equity,
      expectedReversalYear: data.expected_reversal_year,
      originatingEntryId: data.originating_entry_id,
      originatingEntry: null,
      deferredTaxEntryId: data.deferred_tax_entry_id,
      deferredTaxEntry: null,
      status: data.status,
      hgbNote: data.hgb_note,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
