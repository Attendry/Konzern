import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type AdjustmentMethod =
  | 'pro_rata'
  | 'interim_statement'
  | 'estimate'
  | 'none';
export type AdjustmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'approved'
  | 'rejected';

export interface FiscalYearAdjustment {
  id: string;
  companyId: string;
  companyName?: string;
  financialStatementId?: string;
  groupFinancialStatementId?: string;
  subsidiaryFiscalYearEnd: Date;
  groupReportingDate: Date;
  differenceDays: number;
  differenceMonths: number;
  adjustmentMethod: AdjustmentMethod;
  isHgbCompliant: boolean;
  status: AdjustmentStatus;
  adjustmentEntries: any[];
  significantEvents: any[];
  justification?: string;
  hgbReference: string;
  createdByUserId?: string;
  approvedByUserId?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdjustmentDto {
  companyId: string;
  financialStatementId?: string;
  groupFinancialStatementId?: string;
  subsidiaryFiscalYearEnd: string;
  groupReportingDate: string;
  adjustmentMethod: AdjustmentMethod;
  justification?: string;
  significantEvents?: any[];
  createdByUserId?: string;
}

export interface UpdateAdjustmentDto {
  adjustmentMethod?: AdjustmentMethod;
  justification?: string;
  adjustmentEntries?: any[];
  significantEvents?: any[];
  status?: AdjustmentStatus;
}

export interface ValidationResult {
  isValid: boolean;
  differenceDays: number;
  differenceMonths: number;
  requiresAdjustment: boolean;
  hgbCompliant: boolean;
  message: string;
  recommendations: string[];
}

@Injectable()
export class FiscalYearAdjustmentService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Validate date difference according to HGB § 299
   * HGB allows max 3 months difference
   */
  async validateDateDifference(
    subsidiaryDate: Date,
    groupDate: Date,
  ): Promise<ValidationResult> {
    const diffTime = Math.abs(groupDate.getTime() - subsidiaryDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.round(diffDays / 30.44); // Average days per month

    const hgbCompliant = diffMonths <= 3;
    const requiresAdjustment = diffDays > 0;

    const recommendations: string[] = [];
    let message = '';

    if (!requiresAdjustment) {
      message =
        'Keine Stichtagsverschiebung erforderlich - Stichtage sind identisch';
    } else if (hgbCompliant) {
      message = `Stichtagsverschiebung von ${diffDays} Tagen (${diffMonths} Monate) ist HGB-konform`;
      recommendations.push(
        'Zeitanteilige Anpassung (pro rata temporis) empfohlen',
      );
      if (diffMonths <= 1) {
        recommendations.push(
          'Bei geringer Abweichung kann auf Anpassung verzichtet werden, wenn keine wesentlichen Ereignisse vorliegen',
        );
      }
    } else {
      message = `Stichtagsverschiebung von ${diffMonths} Monaten überschreitet die 3-Monate-Grenze nach § 299 Abs. 2 HGB`;
      recommendations.push('Zwischenabschluss erforderlich');
      recommendations.push(
        'Alternativ: Anpassung des Geschäftsjahres der Tochtergesellschaft',
      );
    }

    return {
      isValid: hgbCompliant,
      differenceDays: diffDays,
      differenceMonths: diffMonths,
      requiresAdjustment,
      hgbCompliant,
      message,
      recommendations,
    };
  }

  /**
   * Create a new fiscal year adjustment
   */
  async create(dto: CreateAdjustmentDto): Promise<FiscalYearAdjustment> {
    const subsidiaryDate = new Date(dto.subsidiaryFiscalYearEnd);
    const groupDate = new Date(dto.groupReportingDate);

    // Validate first
    const validation = await this.validateDateDifference(
      subsidiaryDate,
      groupDate,
    );

    const diffMonths = Math.round(
      Math.abs(groupDate.getTime() - subsidiaryDate.getTime()) /
        (1000 * 60 * 60 * 24 * 30.44),
    );

    const { data, error } = await this.supabase
      .from('fiscal_year_adjustments')
      .insert({
        company_id: dto.companyId,
        financial_statement_id: dto.financialStatementId,
        group_financial_statement_id: dto.groupFinancialStatementId,
        subsidiary_fiscal_year_end: dto.subsidiaryFiscalYearEnd,
        group_reporting_date: dto.groupReportingDate,
        difference_months: diffMonths,
        adjustment_method: dto.adjustmentMethod,
        justification: dto.justification,
        significant_events: dto.significantEvents || [],
        created_by_user_id: dto.createdByUserId,
        status: 'pending',
      })
      .select('*, companies(name)')
      .single();

    if (error) {
      throw new BadRequestException(
        `Stichtagsverschiebung konnte nicht erstellt werden: ${error.message}`,
      );
    }

    return this.mapToAdjustment(data);
  }

  /**
   * Get all adjustments for a company
   */
  async getByCompany(companyId: string): Promise<FiscalYearAdjustment[]> {
    const { data, error } = await this.supabase
      .from('fiscal_year_adjustments')
      .select('*, companies(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Fehler beim Laden der Stichtagsverschiebungen: ${error.message}`,
      );
    }

    return (data || []).map(this.mapToAdjustment);
  }

  /**
   * Get all adjustments for a financial statement
   */
  async getByFinancialStatement(
    financialStatementId: string,
  ): Promise<FiscalYearAdjustment[]> {
    const { data, error } = await this.supabase
      .from('fiscal_year_adjustments')
      .select('*, companies(name)')
      .or(
        `financial_statement_id.eq.${financialStatementId},group_financial_statement_id.eq.${financialStatementId}`,
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(
        `Fehler beim Laden der Stichtagsverschiebungen: ${error.message}`,
      );
    }

    return (data || []).map(this.mapToAdjustment);
  }

  /**
   * Get adjustment by ID
   */
  async getById(id: string): Promise<FiscalYearAdjustment> {
    const { data, error } = await this.supabase
      .from('fiscal_year_adjustments')
      .select('*, companies(name)')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(
        `Stichtagsverschiebung mit ID ${id} nicht gefunden`,
      );
    }

    return this.mapToAdjustment(data);
  }

  /**
   * Update an adjustment
   */
  async update(
    id: string,
    dto: UpdateAdjustmentDto,
  ): Promise<FiscalYearAdjustment> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.adjustmentMethod !== undefined)
      updateData.adjustment_method = dto.adjustmentMethod;
    if (dto.justification !== undefined)
      updateData.justification = dto.justification;
    if (dto.adjustmentEntries !== undefined)
      updateData.adjustment_entries = dto.adjustmentEntries;
    if (dto.significantEvents !== undefined)
      updateData.significant_events = dto.significantEvents;
    if (dto.status !== undefined) updateData.status = dto.status;

    const { data, error } = await this.supabase
      .from('fiscal_year_adjustments')
      .update(updateData)
      .eq('id', id)
      .select('*, companies(name)')
      .single();

    if (error) {
      throw new BadRequestException(
        `Stichtagsverschiebung konnte nicht aktualisiert werden: ${error.message}`,
      );
    }

    return this.mapToAdjustment(data);
  }

  /**
   * Approve an adjustment
   */
  async approve(
    id: string,
    approvedByUserId: string,
  ): Promise<FiscalYearAdjustment> {
    const { data, error } = await this.supabase
      .from('fiscal_year_adjustments')
      .update({
        status: 'approved',
        approved_by_user_id: approvedByUserId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, companies(name)')
      .single();

    if (error) {
      throw new BadRequestException(
        `Stichtagsverschiebung konnte nicht freigegeben werden: ${error.message}`,
      );
    }

    return this.mapToAdjustment(data);
  }

  /**
   * Calculate pro-rata adjustment entries
   */
  async calculateProRataAdjustments(
    adjustmentId: string,
    financialStatementId: string,
  ): Promise<any[]> {
    const adjustment = await this.getById(adjustmentId);

    // Get account balances for the subsidiary
    const { data: balances, error } = await this.supabase
      .from('account_balances')
      .select('*, accounts(*)')
      .eq('financial_statement_id', financialStatementId);

    if (error) {
      throw new BadRequestException(
        `Fehler beim Laden der Kontostände: ${error.message}`,
      );
    }

    const diffDays = adjustment.differenceDays;
    const daysInYear = 365;
    const proRataFactor = diffDays / daysInYear;

    const adjustmentEntries: any[] = [];

    for (const balance of balances || []) {
      const account = balance.accounts;

      // Only adjust income statement accounts (revenue/expense)
      if (
        account?.account_type === 'revenue' ||
        account?.account_type === 'expense'
      ) {
        const originalAmount = parseFloat(balance.balance || '0');
        const adjustedAmount = originalAmount * proRataFactor;

        if (Math.abs(adjustedAmount) >= 0.01) {
          adjustmentEntries.push({
            accountId: balance.account_id,
            accountNumber: account?.account_number,
            accountName: account?.name,
            accountType: account?.account_type,
            originalAmount,
            adjustmentAmount: adjustedAmount,
            adjustedAmount: originalAmount + adjustedAmount,
            proRataFactor,
            reason: `Zeitanteilige Anpassung für ${diffDays} Tage`,
          });
        }
      }
    }

    // Save entries to adjustment
    await this.update(adjustmentId, { adjustmentEntries });

    return adjustmentEntries;
  }

  /**
   * Get companies with fiscal year differences
   */
  async getCompaniesWithDifferentFiscalYears(
    parentCompanyId: string,
    groupReportingDate: string,
  ): Promise<{ company: any; validation: ValidationResult }[]> {
    // Get all subsidiaries
    const { data: companies, error } = await this.supabase
      .from('companies')
      .select('*')
      .eq('parent_company_id', parentCompanyId)
      .eq('is_consolidated', true);

    if (error) {
      throw new BadRequestException(
        `Fehler beim Laden der Unternehmen: ${error.message}`,
      );
    }

    const results: { company: any; validation: ValidationResult }[] = [];
    const groupDate = new Date(groupReportingDate);

    for (const company of companies || []) {
      // Calculate subsidiary fiscal year end based on fiscal_year_end_month
      const fiscalYearEndMonth = company.fiscal_year_end_month || 12;
      const subsidiaryDate = new Date(
        groupDate.getFullYear(),
        fiscalYearEndMonth - 1,
        new Date(groupDate.getFullYear(), fiscalYearEndMonth, 0).getDate(),
      );

      const validation = await this.validateDateDifference(
        subsidiaryDate,
        groupDate,
      );

      results.push({
        company: {
          id: company.id,
          name: company.name,
          fiscalYearEndMonth,
          subsidiaryFiscalYearEnd: subsidiaryDate.toISOString().split('T')[0],
        },
        validation,
      });
    }

    return results;
  }

  /**
   * Delete an adjustment
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('fiscal_year_adjustments')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(
        `Stichtagsverschiebung konnte nicht gelöscht werden: ${error.message}`,
      );
    }
  }

  private mapToAdjustment(data: any): FiscalYearAdjustment {
    return {
      id: data.id,
      companyId: data.company_id,
      companyName: data.companies?.name,
      financialStatementId: data.financial_statement_id,
      groupFinancialStatementId: data.group_financial_statement_id,
      subsidiaryFiscalYearEnd: new Date(data.subsidiary_fiscal_year_end),
      groupReportingDate: new Date(data.group_reporting_date),
      differenceDays: data.difference_days,
      differenceMonths: data.difference_months,
      adjustmentMethod: data.adjustment_method,
      isHgbCompliant: data.is_hgb_compliant,
      status: data.status,
      adjustmentEntries: data.adjustment_entries || [],
      significantEvents: data.significant_events || [],
      justification: data.justification,
      hgbReference: data.hgb_reference,
      createdByUserId: data.created_by_user_id,
      approvedByUserId: data.approved_by_user_id,
      approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
