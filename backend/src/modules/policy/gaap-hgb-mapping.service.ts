import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../consolidation/audit-log.service';
import {
  GaapHgbMapping,
  GaapStandard,
  GaapAdjustmentType,
} from '../../entities/gaap-hgb-mapping.entity';

// GAAP Adjustment
export interface GaapAdjustment {
  id: string;
  financialStatementId: string;
  companyId: string;
  mappingId: string;
  sourceGaap: GaapStandard;
  sourceAmount: number;
  sourceAccount?: string;
  adjustmentAmount: number;
  adjustmentDescription?: string;
  targetAmount: number;
  targetAccount?: string;
  deferredTaxImpact: number;
  consolidationEntryId?: string;
  isReviewed: boolean;
  reviewedByUserId?: string;
  reviewedAt?: Date;
}

// Adjustment Summary
export interface AdjustmentSummary {
  totalAdjustments: number;
  reviewedCount: number;
  pendingReviewCount: number;
  totalAdjustmentAmount: number;
  totalDeferredTaxImpact: number;
  bySourceGaap: {
    gaap: GaapStandard;
    count: number;
    totalAmount: number;
  }[];
  byAdjustmentType: {
    type: GaapAdjustmentType;
    count: number;
    totalAmount: number;
  }[];
}

// Mapping Summary
export interface MappingSummary {
  totalMappings: number;
  activeMappings: number;
  materialMappings: number;
  bySourceGaap: {
    gaap: GaapStandard;
    count: number;
  }[];
  byAdjustmentType: {
    type: GaapAdjustmentType;
    count: number;
  }[];
}

@Injectable()
export class GaapHgbMappingService {
  constructor(
    private supabaseService: SupabaseService,
    @Optional() @Inject(forwardRef(() => AuditLogService))
    private auditLogService: AuditLogService,
  ) {}

  // ==================== MAPPINGS MANAGEMENT ====================

  /**
   * Get all GAAP-HGB mappings
   */
  async getMappings(
    sourceGaap?: GaapStandard,
    adjustmentType?: GaapAdjustmentType,
    activeOnly: boolean = true,
  ): Promise<GaapHgbMapping[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('gaap_hgb_mappings')
      .select(`
        *,
        policy:accounting_policies(*)
      `)
      .order('source_gaap', { ascending: true })
      .order('code', { ascending: true });

    if (sourceGaap) {
      query = query.eq('source_gaap', sourceGaap);
    }

    if (adjustmentType) {
      query = query.eq('adjustment_type', adjustmentType);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch mappings: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get material mappings
   */
  async getMaterialMappings(): Promise<GaapHgbMapping[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('gaap_hgb_mappings')
      .select('*')
      .eq('is_active', true)
      .eq('is_material', true)
      .order('source_gaap', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch material mappings: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single mapping by ID
   */
  async getMapping(mappingId: string): Promise<GaapHgbMapping | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('gaap_hgb_mappings')
      .select(`
        *,
        policy:accounting_policies(*)
      `)
      .eq('id', mappingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch mapping: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new GAAP-HGB mapping
   */
  async createMapping(
    mapping: Partial<GaapHgbMapping>,
    userId?: string,
  ): Promise<GaapHgbMapping> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('gaap_hgb_mappings')
      .insert({
        ...mapping,
        created_by_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create mapping: ${error.message}`);
    }

    // Log action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'create' as any,
        entityType: 'system' as any,
        entityId: data.id,
        entityName: data.name,
        afterState: data,
        description: `Created GAAP-HGB mapping: ${data.code}`,
      });
    }

    return data;
  }

  /**
   * Update a GAAP-HGB mapping
   */
  async updateMapping(
    mappingId: string,
    updates: Partial<GaapHgbMapping>,
    userId?: string,
  ): Promise<GaapHgbMapping> {
    const supabase = this.supabaseService.getClient();

    const existing = await this.getMapping(mappingId);
    if (!existing) {
      throw new Error('Mapping not found');
    }

    const { data, error } = await supabase
      .from('gaap_hgb_mappings')
      .update(updates)
      .eq('id', mappingId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update mapping: ${error.message}`);
    }

    // Log action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'update' as any,
        entityType: 'system' as any,
        entityId: data.id,
        entityName: data.name,
        beforeState: existing,
        afterState: data,
        description: `Updated GAAP-HGB mapping: ${data.code}`,
      });
    }

    return data;
  }

  /**
   * Get mapping summary
   */
  async getMappingSummary(): Promise<MappingSummary> {
    const mappings = await this.getMappings(undefined, undefined, false);

    const summary: MappingSummary = {
      totalMappings: mappings.length,
      activeMappings: 0,
      materialMappings: 0,
      bySourceGaap: [],
      byAdjustmentType: [],
    };

    const gaapMap = new Map<GaapStandard, number>();
    const typeMap = new Map<GaapAdjustmentType, number>();

    for (const mapping of mappings) {
      if (mapping.isActive) summary.activeMappings++;
      if (mapping.isMaterial) summary.materialMappings++;

      const gaapCount = gaapMap.get(mapping.sourceGaap) || 0;
      gaapMap.set(mapping.sourceGaap, gaapCount + 1);

      const typeCount = typeMap.get(mapping.adjustmentType) || 0;
      typeMap.set(mapping.adjustmentType, typeCount + 1);
    }

    summary.bySourceGaap = Array.from(gaapMap.entries()).map(([gaap, count]) => ({
      gaap,
      count,
    }));

    summary.byAdjustmentType = Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    return summary;
  }

  // ==================== ADJUSTMENTS ====================

  /**
   * Get adjustments for a financial statement
   */
  async getAdjustments(
    financialStatementId: string,
    companyId?: string,
    sourceGaap?: GaapStandard,
  ): Promise<GaapAdjustment[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('gaap_adjustments')
      .select(`
        *,
        mapping:gaap_hgb_mappings(*)
      `)
      .eq('financial_statement_id', financialStatementId)
      .order('created_at', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (sourceGaap) {
      query = query.eq('source_gaap', sourceGaap);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch adjustments: ${error.message}`);
    }

    return (data || []).map(this.mapAdjustment);
  }

  /**
   * Get a single adjustment by ID
   */
  async getAdjustment(adjustmentId: string): Promise<GaapAdjustment | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('gaap_adjustments')
      .select(`
        *,
        mapping:gaap_hgb_mappings(*)
      `)
      .eq('id', adjustmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch adjustment: ${error.message}`);
    }

    return this.mapAdjustment(data);
  }

  /**
   * Create a GAAP adjustment
   */
  async createAdjustment(
    adjustment: Partial<GaapAdjustment>,
    userId?: string,
  ): Promise<GaapAdjustment> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('gaap_adjustments')
      .insert({
        financial_statement_id: adjustment.financialStatementId,
        company_id: adjustment.companyId,
        mapping_id: adjustment.mappingId,
        source_gaap: adjustment.sourceGaap,
        source_amount: adjustment.sourceAmount,
        source_account: adjustment.sourceAccount,
        adjustment_amount: adjustment.adjustmentAmount,
        adjustment_description: adjustment.adjustmentDescription,
        target_amount: adjustment.targetAmount,
        target_account: adjustment.targetAccount,
        deferred_tax_impact: adjustment.deferredTaxImpact || 0,
        consolidation_entry_id: adjustment.consolidationEntryId,
        created_by_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create adjustment: ${error.message}`);
    }

    // Log action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'create' as any,
        entityType: 'financial_statement' as any,
        entityId: adjustment.financialStatementId,
        financialStatementId: adjustment.financialStatementId,
        companyId: adjustment.companyId,
        afterState: data,
        description: `Created GAAP adjustment: ${adjustment.sourceGaap} → HGB`,
      });
    }

    return this.mapAdjustment(data);
  }

  /**
   * Apply a mapping to create an adjustment
   */
  async applyMapping(
    mappingId: string,
    financialStatementId: string,
    companyId: string,
    sourceAmount: number,
    sourceAccount?: string,
    userId?: string,
  ): Promise<GaapAdjustment> {
    const mapping = await this.getMapping(mappingId);
    if (!mapping) {
      throw new Error('Mapping not found');
    }

    // Calculate adjustment based on mapping configuration
    const config = mapping.adjustmentConfig;
    let adjustmentAmount = 0;
    let targetAmount = sourceAmount;

    // Simple adjustment logic - can be extended based on config.type
    switch (config.type) {
      case 'percentage':
        adjustmentAmount = sourceAmount * (Number(config.parameters?.percentage) || 0) / 100;
        targetAmount = sourceAmount + adjustmentAmount;
        break;
      case 'fixed':
        adjustmentAmount = Number(config.parameters?.amount) || 0;
        targetAmount = sourceAmount + adjustmentAmount;
        break;
      case 'reversal':
        adjustmentAmount = -sourceAmount;
        targetAmount = 0;
        break;
      case 'reclassification':
        adjustmentAmount = 0;
        targetAmount = sourceAmount;
        break;
      default:
        // No adjustment
        break;
    }

    // Calculate deferred tax impact
    let deferredTaxImpact = 0;
    if (mapping.affectsDeferredTax && adjustmentAmount !== 0) {
      const taxRate = Number(config.deferredTaxRate) || 30;
      deferredTaxImpact = adjustmentAmount * taxRate / 100;
    }

    return this.createAdjustment({
      financialStatementId,
      companyId,
      mappingId,
      sourceGaap: mapping.sourceGaap,
      sourceAmount,
      sourceAccount,
      adjustmentAmount,
      adjustmentDescription: `${mapping.name}: ${mapping.description}`,
      targetAmount,
      targetAccount: mapping.targetAccounts?.[0],
      deferredTaxImpact,
    }, userId);
  }

  /**
   * Review an adjustment
   */
  async reviewAdjustment(
    adjustmentId: string,
    userId: string,
  ): Promise<GaapAdjustment> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('gaap_adjustments')
      .update({
        is_reviewed: true,
        reviewed_by_user_id: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', adjustmentId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to review adjustment: ${error.message}`);
    }

    return this.mapAdjustment(data);
  }

  /**
   * Delete an adjustment
   */
  async deleteAdjustment(adjustmentId: string, userId?: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const adjustment = await this.getAdjustment(adjustmentId);
    if (!adjustment) {
      throw new Error('Adjustment not found');
    }

    const { error } = await supabase
      .from('gaap_adjustments')
      .delete()
      .eq('id', adjustmentId);

    if (error) {
      throw new Error(`Failed to delete adjustment: ${error.message}`);
    }

    // Log action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'delete' as any,
        entityType: 'financial_statement' as any,
        entityId: adjustment.financialStatementId,
        financialStatementId: adjustment.financialStatementId,
        companyId: adjustment.companyId,
        beforeState: adjustment,
        description: `Deleted GAAP adjustment`,
      });
    }
  }

  /**
   * Get adjustment summary for a financial statement
   */
  async getAdjustmentSummary(financialStatementId: string): Promise<AdjustmentSummary> {
    const adjustments = await this.getAdjustments(financialStatementId);

    const summary: AdjustmentSummary = {
      totalAdjustments: adjustments.length,
      reviewedCount: 0,
      pendingReviewCount: 0,
      totalAdjustmentAmount: 0,
      totalDeferredTaxImpact: 0,
      bySourceGaap: [],
      byAdjustmentType: [],
    };

    const gaapMap = new Map<GaapStandard, { count: number; totalAmount: number }>();
    const typeMap = new Map<GaapAdjustmentType, { count: number; totalAmount: number }>();

    for (const adjustment of adjustments) {
      if (adjustment.isReviewed) {
        summary.reviewedCount++;
      } else {
        summary.pendingReviewCount++;
      }

      summary.totalAdjustmentAmount += Math.abs(adjustment.adjustmentAmount);
      summary.totalDeferredTaxImpact += Math.abs(adjustment.deferredTaxImpact);

      const gaapStats = gaapMap.get(adjustment.sourceGaap) || { count: 0, totalAmount: 0 };
      gaapStats.count++;
      gaapStats.totalAmount += Math.abs(adjustment.adjustmentAmount);
      gaapMap.set(adjustment.sourceGaap, gaapStats);
    }

    summary.bySourceGaap = Array.from(gaapMap.entries()).map(([gaap, stats]) => ({
      gaap,
      count: stats.count,
      totalAmount: stats.totalAmount,
    }));

    return summary;
  }

  // ==================== HELPER METHODS ====================

  private mapAdjustment(data: any): GaapAdjustment {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      companyId: data.company_id,
      mappingId: data.mapping_id,
      sourceGaap: data.source_gaap,
      sourceAmount: Number(data.source_amount),
      sourceAccount: data.source_account,
      adjustmentAmount: Number(data.adjustment_amount),
      adjustmentDescription: data.adjustment_description,
      targetAmount: Number(data.target_amount),
      targetAccount: data.target_account,
      deferredTaxImpact: Number(data.deferred_tax_impact),
      consolidationEntryId: data.consolidation_entry_id,
      isReviewed: data.is_reviewed,
      reviewedByUserId: data.reviewed_by_user_id,
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
    };
  }
}
