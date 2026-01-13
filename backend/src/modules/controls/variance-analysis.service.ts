import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../consolidation/audit-log.service';
import {
  VarianceAnalysis,
  VarianceType,
  VarianceSignificance,
  VarianceExplanationCategory,
} from '../../entities/variance-analysis.entity';

// Materiality Thresholds
export interface MaterialityThresholds {
  id: string;
  financialStatementId: string;
  basisType: string;
  basisAmount: number;
  planningMateriality: number;
  performanceMateriality: number;
  trivialThreshold: number;
  planningPercentage: number;
  performancePercentage: number;
  trivialPercentage: number;
  qualitativeFactors?: Record<string, unknown>;
  notes?: string;
  approvedByUserId?: string;
  approvedAt?: Date;
}

// Variance Summary
export interface VarianceSummary {
  totalItems: number;
  materialCount: number;
  significantCount: number;
  minorCount: number;
  immaterialCount: number;
  explainedCount: number;
  unexplainedCount: number;
  reviewedCount: number;
  totalAbsoluteVariance: number;
  byCategory: {
    category: string;
    count: number;
    totalVariance: number;
  }[];
}

// Analysis Level
export enum AnalysisLevel {
  TOTAL = 'total',
  COMPANY = 'company',
  ACCOUNT = 'account',
  LINE_ITEM = 'line_item',
}

@Injectable()
export class VarianceAnalysisService {
  constructor(
    private supabaseService: SupabaseService,
    @Optional() @Inject(forwardRef(() => AuditLogService))
    private auditLogService: AuditLogService,
  ) {}

  // ==================== MATERIALITY THRESHOLDS ====================

  /**
   * Get or calculate materiality thresholds for a financial statement
   */
  async getMaterialityThresholds(financialStatementId: string): Promise<MaterialityThresholds | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('materiality_thresholds')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch materiality thresholds: ${error.message}`);
    }

    return this.mapMaterialityThresholds(data);
  }

  /**
   * Create or update materiality thresholds
   */
  async setMaterialityThresholds(
    financialStatementId: string,
    thresholds: Partial<MaterialityThresholds>,
    userId?: string,
  ): Promise<MaterialityThresholds> {
    const supabase = this.supabaseService.getClient();

    // Check if thresholds already exist
    const existing = await this.getMaterialityThresholds(financialStatementId);

    const dbData = {
      financial_statement_id: financialStatementId,
      basis_type: thresholds.basisType,
      basis_amount: thresholds.basisAmount,
      planning_materiality: thresholds.planningMateriality,
      performance_materiality: thresholds.performanceMateriality,
      trivial_threshold: thresholds.trivialThreshold,
      planning_percentage: thresholds.planningPercentage,
      performance_percentage: thresholds.performancePercentage,
      trivial_percentage: thresholds.trivialPercentage,
      qualitative_factors: thresholds.qualitativeFactors,
      notes: thresholds.notes,
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('materiality_thresholds')
        .update(dbData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update materiality thresholds: ${error.message}`);
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from('materiality_thresholds')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create materiality thresholds: ${error.message}`);
      }
      result = data;
    }

    // Log the action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: existing ? 'update' as any : 'create' as any,
        entityType: 'financial_statement' as any,
        entityId: financialStatementId,
        financialStatementId,
        beforeState: existing,
        afterState: result,
        description: `${existing ? 'Updated' : 'Set'} materiality thresholds`,
      });
    }

    return this.mapMaterialityThresholds(result);
  }

  /**
   * Approve materiality thresholds
   */
  async approveMaterialityThresholds(
    financialStatementId: string,
    userId: string,
  ): Promise<MaterialityThresholds> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('materiality_thresholds')
      .update({
        approved_by_user_id: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('financial_statement_id', financialStatementId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to approve materiality thresholds: ${error.message}`);
    }

    return this.mapMaterialityThresholds(data);
  }

  /**
   * Calculate suggested materiality based on financial data
   */
  async calculateSuggestedMateriality(
    financialStatementId: string,
  ): Promise<{
    basisType: string;
    basisAmount: number;
    suggestedPlanning: number;
    suggestedPerformance: number;
    suggestedTrivial: number;
  }> {
    const supabase = this.supabaseService.getClient();

    // Get account balances to calculate basis
    const { data: balances } = await supabase
      .from('account_balances')
      .select(`
        *,
        account:accounts(*)
      `)
      .eq('financial_statement_id', financialStatementId);

    let totalAssets = 0;
    let totalRevenue = 0;
    let totalEquity = 0;

    for (const balance of balances || []) {
      const account = balance.account as any;
      const amount = Math.abs(Number(balance.amount) || 0);

      if (account) {
        if (account.account_type === 'asset') {
          totalAssets += amount;
        } else if (account.account_type === 'equity') {
          totalEquity += amount;
        } else if (account.account_type === 'revenue') {
          totalRevenue += amount;
        }
      }
    }

    // Determine basis (typically total assets for German companies)
    let basisType = 'total_assets';
    let basisAmount = totalAssets;

    if (totalRevenue > totalAssets) {
      basisType = 'total_revenue';
      basisAmount = totalRevenue;
    }

    // Standard materiality percentages (can be adjusted)
    // Planning materiality: 0.5% - 2% of basis
    // Performance materiality: 50% - 75% of planning
    // Trivial threshold: 3% - 5% of planning
    const planningPercentage = 0.01; // 1%
    const performancePercentage = 0.0075; // 0.75%
    const trivialPercentage = 0.0005; // 0.05%

    return {
      basisType,
      basisAmount,
      suggestedPlanning: basisAmount * planningPercentage,
      suggestedPerformance: basisAmount * performancePercentage,
      suggestedTrivial: basisAmount * trivialPercentage,
    };
  }

  // ==================== VARIANCE ANALYSIS ====================

  /**
   * Run variance analysis for a financial statement
   */
  async runVarianceAnalysis(
    currentFinancialStatementId: string,
    priorFinancialStatementId: string,
    level: AnalysisLevel = AnalysisLevel.ACCOUNT,
    userId?: string,
  ): Promise<VarianceAnalysis[]> {
    const supabase = this.supabaseService.getClient();

    // Get materiality thresholds
    const materiality = await this.getMaterialityThresholds(currentFinancialStatementId);
    const planningMateriality = materiality?.planningMateriality || 0;
    const performanceMateriality = materiality?.performanceMateriality || 0;
    const trivialThreshold = materiality?.trivialThreshold || 0;

    // Get current period data
    const { data: currentBalances } = await supabase
      .from('account_balances')
      .select(`
        *,
        account:accounts(*),
        company:companies(*)
      `)
      .eq('financial_statement_id', currentFinancialStatementId);

    // Get current financial statement for year
    const { data: currentFs } = await supabase
      .from('financial_statements')
      .select('*')
      .eq('id', currentFinancialStatementId)
      .single();

    // Get prior period data
    const { data: priorBalances } = await supabase
      .from('account_balances')
      .select(`
        *,
        account:accounts(*),
        company:companies(*)
      `)
      .eq('financial_statement_id', priorFinancialStatementId);

    // Get prior financial statement for year
    const { data: priorFs } = await supabase
      .from('financial_statements')
      .select('*')
      .eq('id', priorFinancialStatementId)
      .single();

    // Create a map for prior balances by account and company
    const priorMap = new Map<string, number>();
    for (const balance of priorBalances || []) {
      const key = level === AnalysisLevel.COMPANY
        ? `${balance.company_id}_${(balance.account as any)?.account_number}`
        : (balance.account as any)?.account_number;
      priorMap.set(key, Number(balance.amount) || 0);
    }

    // Aggregate current balances based on level
    const aggregatedData = new Map<string, {
      currentValue: number;
      priorValue: number;
      accountNumber?: string;
      accountName?: string;
      companyId?: string;
    }>();

    for (const balance of currentBalances || []) {
      const account = balance.account as any;
      const company = balance.company as any;
      const currentAmount = Number(balance.amount) || 0;

      let key: string;
      let accountNumber: string | undefined;
      let accountName: string | undefined;
      let companyId: string | undefined;

      switch (level) {
        case AnalysisLevel.TOTAL:
          key = 'total';
          break;
        case AnalysisLevel.COMPANY:
          key = `company_${balance.company_id}`;
          companyId = balance.company_id;
          break;
        case AnalysisLevel.ACCOUNT:
        default:
          key = account?.account_number || balance.account_id;
          accountNumber = account?.account_number;
          accountName = account?.name;
          break;
      }

      const existing = aggregatedData.get(key) || {
        currentValue: 0,
        priorValue: 0,
        accountNumber,
        accountName,
        companyId,
      };

      existing.currentValue += currentAmount;

      // Get prior value
      const priorKey = level === AnalysisLevel.COMPANY
        ? `${balance.company_id}_${account?.account_number}`
        : account?.account_number;
      existing.priorValue += priorMap.get(priorKey) || 0;

      aggregatedData.set(key, existing);
    }

    // Delete existing variance analyses for this financial statement
    await supabase
      .from('variance_analyses')
      .delete()
      .eq('financial_statement_id', currentFinancialStatementId);

    // Create variance analyses
    const analyses: VarianceAnalysis[] = [];

    for (const [key, data] of aggregatedData) {
      const absoluteVariance = data.currentValue - data.priorValue;
      const percentageVariance = data.priorValue !== 0
        ? (absoluteVariance / Math.abs(data.priorValue)) * 100
        : (data.currentValue !== 0 ? 100 : 0);

      // Determine significance
      let significance: VarianceSignificance;
      let isMaterial = false;

      const absVariance = Math.abs(absoluteVariance);
      if (absVariance >= planningMateriality) {
        significance = VarianceSignificance.MATERIAL;
        isMaterial = true;
      } else if (absVariance >= performanceMateriality) {
        significance = VarianceSignificance.SIGNIFICANT;
      } else if (absVariance >= trivialThreshold) {
        significance = VarianceSignificance.MINOR;
      } else {
        significance = VarianceSignificance.IMMATERIAL;
      }

      const { data: analysis, error } = await supabase
        .from('variance_analyses')
        .insert({
          financial_statement_id: currentFinancialStatementId,
          prior_financial_statement_id: priorFinancialStatementId,
          company_id: data.companyId,
          variance_type: VarianceType.BOTH,
          analysis_level: level,
          account_number: data.accountNumber,
          account_name: data.accountName,
          current_period_value: data.currentValue,
          current_period_year: currentFs?.fiscal_year,
          prior_period_value: data.priorValue,
          prior_period_year: priorFs?.fiscal_year,
          absolute_variance: absoluteVariance,
          percentage_variance: percentageVariance,
          threshold_absolute: planningMateriality,
          threshold_percentage: 10, // 10% as default percentage threshold
          significance,
          is_material: isMaterial,
        })
        .select()
        .single();

      if (error) {
        console.error(`Failed to create variance analysis: ${error.message}`);
        continue;
      }

      analyses.push(analysis);
    }

    // Log the action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'calculate' as any,
        entityType: 'financial_statement' as any,
        entityId: currentFinancialStatementId,
        financialStatementId: currentFinancialStatementId,
        afterState: { count: analyses.length, level },
        description: `Ran variance analysis: ${analyses.length} items analyzed`,
      });
    }

    return analyses;
  }

  /**
   * Get variance analyses for a financial statement
   */
  async getVarianceAnalyses(
    financialStatementId: string,
    materialOnly?: boolean,
    unexplainedOnly?: boolean,
  ): Promise<VarianceAnalysis[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('variance_analyses')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .order('absolute_variance', { ascending: false });

    if (materialOnly) {
      query = query.eq('is_material', true);
    }

    if (unexplainedOnly) {
      query = query.is('explanation', null);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch variance analyses: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get variance summary
   */
  async getVarianceSummary(financialStatementId: string): Promise<VarianceSummary> {
    const analyses = await this.getVarianceAnalyses(financialStatementId);

    const summary: VarianceSummary = {
      totalItems: analyses.length,
      materialCount: 0,
      significantCount: 0,
      minorCount: 0,
      immaterialCount: 0,
      explainedCount: 0,
      unexplainedCount: 0,
      reviewedCount: 0,
      totalAbsoluteVariance: 0,
      byCategory: [],
    };

    const categoryMap = new Map<string, { count: number; totalVariance: number }>();

    for (const analysis of analyses) {
      // Count by significance
      switch (analysis.significance) {
        case VarianceSignificance.MATERIAL:
          summary.materialCount++;
          break;
        case VarianceSignificance.SIGNIFICANT:
          summary.significantCount++;
          break;
        case VarianceSignificance.MINOR:
          summary.minorCount++;
          break;
        case VarianceSignificance.IMMATERIAL:
          summary.immaterialCount++;
          break;
      }

      // Count explained vs unexplained
      if (analysis.explanation) {
        summary.explainedCount++;
      } else {
        summary.unexplainedCount++;
      }

      // Count reviewed
      if (analysis.reviewedAt) {
        summary.reviewedCount++;
      }

      // Total variance
      summary.totalAbsoluteVariance += Math.abs(Number(analysis.absoluteVariance) || 0);

      // By category
      const category = analysis.explanationCategory || 'uncategorized';
      const catStats = categoryMap.get(category) || { count: 0, totalVariance: 0 };
      catStats.count++;
      catStats.totalVariance += Math.abs(Number(analysis.absoluteVariance) || 0);
      categoryMap.set(category, catStats);
    }

    summary.byCategory = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      ...stats,
    }));

    return summary;
  }

  /**
   * Add explanation to a variance analysis
   */
  async explainVariance(
    varianceId: string,
    explanation: string,
    category: VarianceExplanationCategory,
    userId: string,
  ): Promise<VarianceAnalysis> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('variance_analyses')
      .update({
        explanation,
        explanation_category: category,
        explained_by_user_id: userId,
        explained_at: new Date().toISOString(),
      })
      .eq('id', varianceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to explain variance: ${error.message}`);
    }

    return data;
  }

  /**
   * Review a variance analysis
   */
  async reviewVariance(
    varianceId: string,
    userId: string,
    comment?: string,
  ): Promise<VarianceAnalysis> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('variance_analyses')
      .update({
        reviewed_by_user_id: userId,
        reviewed_at: new Date().toISOString(),
        review_comment: comment,
      })
      .eq('id', varianceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to review variance: ${error.message}`);
    }

    return data;
  }

  // ==================== HELPER METHODS ====================

  private mapMaterialityThresholds(data: any): MaterialityThresholds {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      basisType: data.basis_type,
      basisAmount: Number(data.basis_amount),
      planningMateriality: Number(data.planning_materiality),
      performanceMateriality: Number(data.performance_materiality),
      trivialThreshold: Number(data.trivial_threshold),
      planningPercentage: Number(data.planning_percentage),
      performancePercentage: Number(data.performance_percentage),
      trivialPercentage: Number(data.trivial_percentage),
      qualitativeFactors: data.qualitative_factors,
      notes: data.notes,
      approvedByUserId: data.approved_by_user_id,
      approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
    };
  }
}
