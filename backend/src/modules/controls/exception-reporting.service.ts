import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../consolidation/audit-log.service';
import {
  ExceptionReport,
  ExceptionStatus,
  ExceptionPriority,
  ExceptionSourceType,
  ExceptionResolutionType,
  ExceptionActionLog,
} from '../../entities/exception-report.entity';
import { PlausibilityRuleCategory } from '../../entities/plausibility-rule.entity';
import { PlausibilityCheckStatus } from '../../entities/plausibility-check.entity';

// Exception Summary
export interface ExceptionSummary {
  totalExceptions: number;
  openCount: number;
  inReviewCount: number;
  resolvedCount: number;
  escalatedCount: number;
  waivedCount: number;
  closedCount: number;
  byPriority: {
    priority: ExceptionPriority;
    count: number;
  }[];
  byCategory: {
    category: PlausibilityRuleCategory | null;
    count: number;
  }[];
  overdueCount: number;
  totalImpactAmount: number;
}

// Create Exception DTO
export interface CreateExceptionDto {
  financialStatementId: string;
  companyId?: string;
  sourceType: ExceptionSourceType;
  sourceId?: string;
  exceptionCode: string;
  title: string;
  description?: string;
  category?: PlausibilityRuleCategory;
  priority?: ExceptionPriority;
  impactAmount?: number;
  impactDescription?: string;
  affectsDisclosure?: boolean;
  affectsAuditOpinion?: boolean;
  dueDate?: Date;
  hgbReference?: string;
}

@Injectable()
export class ExceptionReportingService {
  constructor(
    private supabaseService: SupabaseService,
    @Optional()
    @Inject(forwardRef(() => AuditLogService))
    private auditLogService: AuditLogService,
  ) {}

  // ==================== EXCEPTION CRUD ====================

  /**
   * Create a new exception report
   */
  async createException(
    dto: CreateExceptionDto,
    userId?: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    const actionLog: ExceptionActionLog[] = [
      {
        timestamp: new Date().toISOString(),
        userId,
        action: 'created',
        details: 'Exception report created',
      },
    ];

    const { data, error } = await supabase
      .from('exception_reports')
      .insert({
        financial_statement_id: dto.financialStatementId,
        company_id: dto.companyId,
        source_type: dto.sourceType,
        source_id: dto.sourceId,
        exception_code: dto.exceptionCode,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        priority: dto.priority || ExceptionPriority.MEDIUM,
        status: ExceptionStatus.OPEN,
        impact_amount: dto.impactAmount,
        impact_description: dto.impactDescription,
        affects_disclosure: dto.affectsDisclosure || false,
        affects_audit_opinion: dto.affectsAuditOpinion || false,
        due_date: dto.dueDate?.toISOString(),
        hgb_reference: dto.hgbReference,
        action_log: actionLog,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create exception report: ${error.message}`);
    }

    // Log the action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'create' as any,
        entityType: 'financial_statement' as any,
        entityId: dto.financialStatementId,
        financialStatementId: dto.financialStatementId,
        afterState: data,
        description: `Created exception report: ${dto.title}`,
      });
    }

    return data;
  }

  /**
   * Create exception from a failed plausibility check
   */
  async createExceptionFromCheck(
    checkId: string,
    financialStatementId: string,
    userId?: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    // Get the check details
    const { data: check, error: checkError } = await supabase
      .from('plausibility_checks')
      .select(
        `
        *,
        rule:plausibility_rules(*)
      `,
      )
      .eq('id', checkId)
      .single();

    if (checkError) {
      throw new Error(
        `Failed to fetch plausibility check: ${checkError.message}`,
      );
    }

    const rule = check.rule as any;

    return this.createException(
      {
        financialStatementId,
        companyId: check.company_id,
        sourceType: ExceptionSourceType.PLAUSIBILITY_CHECK,
        sourceId: checkId,
        exceptionCode: `CHK-${rule?.code || 'UNKNOWN'}`,
        title: `Plausibilitätsprüfung fehlgeschlagen: ${rule?.name || 'Unbekannte Regel'}`,
        description: check.message || check.details,
        category: rule?.category,
        priority:
          rule?.severity === 'error'
            ? ExceptionPriority.HIGH
            : ExceptionPriority.MEDIUM,
        impactAmount: check.difference_value,
        hgbReference: rule?.hgb_reference,
      },
      userId,
    );
  }

  /**
   * Create exception from a material variance
   */
  async createExceptionFromVariance(
    varianceId: string,
    financialStatementId: string,
    userId?: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    // Get the variance details
    const { data: variance, error: varError } = await supabase
      .from('variance_analyses')
      .select('*')
      .eq('id', varianceId)
      .single();

    if (varError) {
      throw new Error(`Failed to fetch variance analysis: ${varError.message}`);
    }

    return this.createException(
      {
        financialStatementId,
        companyId: variance.company_id,
        sourceType: ExceptionSourceType.VARIANCE_ANALYSIS,
        sourceId: varianceId,
        exceptionCode: `VAR-${variance.account_number || 'UNKNOWN'}`,
        title: `Wesentliche Abweichung: ${variance.account_name || variance.account_number || 'Unbekanntes Konto'}`,
        description: `Abweichung zum Vorjahr: ${variance.absolute_variance?.toLocaleString('de-DE')} EUR (${variance.percentage_variance?.toFixed(2)}%)`,
        category: PlausibilityRuleCategory.YEAR_OVER_YEAR,
        priority:
          variance.significance === 'material'
            ? ExceptionPriority.HIGH
            : ExceptionPriority.MEDIUM,
        impactAmount: variance.absolute_variance,
      },
      userId,
    );
  }

  /**
   * Get exception by ID
   */
  async getException(exceptionId: string): Promise<ExceptionReport | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('exception_reports')
      .select('*')
      .eq('id', exceptionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch exception report: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all exceptions for a financial statement
   */
  async getExceptions(
    financialStatementId: string,
    status?: ExceptionStatus,
    priority?: ExceptionPriority,
  ): Promise<ExceptionReport[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('exception_reports')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch exception reports: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get open exceptions (not resolved or closed)
   */
  async getOpenExceptions(
    financialStatementId: string,
  ): Promise<ExceptionReport[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('exception_reports')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .in('status', [
        ExceptionStatus.OPEN,
        ExceptionStatus.IN_REVIEW,
        ExceptionStatus.ESCALATED,
      ])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch open exception reports: ${error.message}`,
      );
    }

    return data || [];
  }

  /**
   * Get exception summary
   */
  async getExceptionSummary(
    financialStatementId: string,
  ): Promise<ExceptionSummary> {
    const exceptions = await this.getExceptions(financialStatementId);

    const summary: ExceptionSummary = {
      totalExceptions: exceptions.length,
      openCount: 0,
      inReviewCount: 0,
      resolvedCount: 0,
      escalatedCount: 0,
      waivedCount: 0,
      closedCount: 0,
      byPriority: [],
      byCategory: [],
      overdueCount: 0,
      totalImpactAmount: 0,
    };

    const priorityMap = new Map<ExceptionPriority, number>();
    const categoryMap = new Map<PlausibilityRuleCategory | null, number>();
    const today = new Date();

    for (const exception of exceptions) {
      // Count by status
      switch (exception.status) {
        case ExceptionStatus.OPEN:
          summary.openCount++;
          break;
        case ExceptionStatus.IN_REVIEW:
          summary.inReviewCount++;
          break;
        case ExceptionStatus.RESOLVED:
          summary.resolvedCount++;
          break;
        case ExceptionStatus.ESCALATED:
          summary.escalatedCount++;
          break;
        case ExceptionStatus.WAIVED:
          summary.waivedCount++;
          break;
        case ExceptionStatus.CLOSED:
          summary.closedCount++;
          break;
      }

      // Count by priority
      const priorityCount = priorityMap.get(exception.priority) || 0;
      priorityMap.set(exception.priority, priorityCount + 1);

      // Count by category
      const categoryCount = categoryMap.get(exception.category) || 0;
      categoryMap.set(exception.category, categoryCount + 1);

      // Count overdue
      if (
        exception.dueDate &&
        new Date(exception.dueDate) < today &&
        ![
          ExceptionStatus.RESOLVED,
          ExceptionStatus.CLOSED,
          ExceptionStatus.WAIVED,
        ].includes(exception.status)
      ) {
        summary.overdueCount++;
      }

      // Total impact
      if (exception.impactAmount) {
        summary.totalImpactAmount += Math.abs(Number(exception.impactAmount));
      }
    }

    summary.byPriority = Array.from(priorityMap.entries()).map(
      ([priority, count]) => ({
        priority,
        count,
      }),
    );

    summary.byCategory = Array.from(categoryMap.entries()).map(
      ([category, count]) => ({
        category,
        count,
      }),
    );

    return summary;
  }

  // ==================== EXCEPTION WORKFLOW ====================

  /**
   * Assign an exception to a user
   */
  async assignException(
    exceptionId: string,
    assignToUserId: string,
    assignByUserId: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    const exception = await this.getException(exceptionId);
    if (!exception) {
      throw new Error('Exception not found');
    }

    const actionLog = [
      ...(exception.actionLog || []),
      {
        timestamp: new Date().toISOString(),
        userId: assignByUserId,
        action: 'assigned',
        details: `Assigned to user ${assignToUserId}`,
      },
    ];

    const { data, error } = await supabase
      .from('exception_reports')
      .update({
        assigned_to_user_id: assignToUserId,
        assigned_at: new Date().toISOString(),
        assigned_by_user_id: assignByUserId,
        status: ExceptionStatus.IN_REVIEW,
        action_log: actionLog,
      })
      .eq('id', exceptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to assign exception: ${error.message}`);
    }

    return data;
  }

  /**
   * Escalate an exception
   */
  async escalateException(
    exceptionId: string,
    escalateToUserId: string,
    reason: string,
    userId: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    const exception = await this.getException(exceptionId);
    if (!exception) {
      throw new Error('Exception not found');
    }

    const actionLog = [
      ...(exception.actionLog || []),
      {
        timestamp: new Date().toISOString(),
        userId,
        action: 'escalated',
        details: reason,
        oldStatus: exception.status,
        newStatus: ExceptionStatus.ESCALATED,
      },
    ];

    const { data, error } = await supabase
      .from('exception_reports')
      .update({
        status: ExceptionStatus.ESCALATED,
        escalated_at: new Date().toISOString(),
        escalated_to_user_id: escalateToUserId,
        escalation_reason: reason,
        action_log: actionLog,
      })
      .eq('id', exceptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to escalate exception: ${error.message}`);
    }

    return data;
  }

  /**
   * Resolve an exception
   */
  async resolveException(
    exceptionId: string,
    resolution: string,
    resolutionType: ExceptionResolutionType,
    userId: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    const exception = await this.getException(exceptionId);
    if (!exception) {
      throw new Error('Exception not found');
    }

    const actionLog = [
      ...(exception.actionLog || []),
      {
        timestamp: new Date().toISOString(),
        userId,
        action: 'resolved',
        details: resolution,
        oldStatus: exception.status,
        newStatus: ExceptionStatus.RESOLVED,
      },
    ];

    const { data, error } = await supabase
      .from('exception_reports')
      .update({
        status: ExceptionStatus.RESOLVED,
        resolution,
        resolution_type: resolutionType,
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: userId,
        action_log: actionLog,
      })
      .eq('id', exceptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resolve exception: ${error.message}`);
    }

    // Log the action
    if (this.auditLogService) {
      await this.auditLogService.log({
        userId,
        action: 'update' as any,
        entityType: 'financial_statement' as any,
        entityId: exception.financialStatementId,
        financialStatementId: exception.financialStatementId,
        beforeState: exception,
        afterState: data,
        description: `Resolved exception: ${exception.title}`,
      });
    }

    return data;
  }

  /**
   * Waive an exception (approve without resolution)
   */
  async waiveException(
    exceptionId: string,
    reason: string,
    userId: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    const exception = await this.getException(exceptionId);
    if (!exception) {
      throw new Error('Exception not found');
    }

    const actionLog = [
      ...(exception.actionLog || []),
      {
        timestamp: new Date().toISOString(),
        userId,
        action: 'waived',
        details: reason,
        oldStatus: exception.status,
        newStatus: ExceptionStatus.WAIVED,
      },
    ];

    const { data, error } = await supabase
      .from('exception_reports')
      .update({
        status: ExceptionStatus.WAIVED,
        resolution: reason,
        resolution_type: ExceptionResolutionType.WAIVER,
        resolved_at: new Date().toISOString(),
        resolved_by_user_id: userId,
        action_log: actionLog,
      })
      .eq('id', exceptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to waive exception: ${error.message}`);
    }

    return data;
  }

  /**
   * Close an exception
   */
  async closeException(
    exceptionId: string,
    userId: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    const exception = await this.getException(exceptionId);
    if (!exception) {
      throw new Error('Exception not found');
    }

    if (
      ![ExceptionStatus.RESOLVED, ExceptionStatus.WAIVED].includes(
        exception.status,
      )
    ) {
      throw new Error('Can only close resolved or waived exceptions');
    }

    const actionLog = [
      ...(exception.actionLog || []),
      {
        timestamp: new Date().toISOString(),
        userId,
        action: 'closed',
        oldStatus: exception.status,
        newStatus: ExceptionStatus.CLOSED,
      },
    ];

    const { data, error } = await supabase
      .from('exception_reports')
      .update({
        status: ExceptionStatus.CLOSED,
        action_log: actionLog,
      })
      .eq('id', exceptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to close exception: ${error.message}`);
    }

    return data;
  }

  /**
   * Reopen an exception
   */
  async reopenException(
    exceptionId: string,
    reason: string,
    userId: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    const exception = await this.getException(exceptionId);
    if (!exception) {
      throw new Error('Exception not found');
    }

    const actionLog = [
      ...(exception.actionLog || []),
      {
        timestamp: new Date().toISOString(),
        userId,
        action: 'reopened',
        details: reason,
        oldStatus: exception.status,
        newStatus: ExceptionStatus.OPEN,
      },
    ];

    const { data, error } = await supabase
      .from('exception_reports')
      .update({
        status: ExceptionStatus.OPEN,
        resolution: null,
        resolution_type: null,
        resolved_at: null,
        resolved_by_user_id: null,
        action_log: actionLog,
      })
      .eq('id', exceptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reopen exception: ${error.message}`);
    }

    return data;
  }

  /**
   * Update exception priority
   */
  async updatePriority(
    exceptionId: string,
    priority: ExceptionPriority,
    userId: string,
  ): Promise<ExceptionReport> {
    const supabase = this.supabaseService.getClient();

    const exception = await this.getException(exceptionId);
    if (!exception) {
      throw new Error('Exception not found');
    }

    const actionLog = [
      ...(exception.actionLog || []),
      {
        timestamp: new Date().toISOString(),
        userId,
        action: 'priority_changed',
        details: `Priority changed from ${exception.priority} to ${priority}`,
      },
    ];

    const { data, error } = await supabase
      .from('exception_reports')
      .update({
        priority,
        action_log: actionLog,
      })
      .eq('id', exceptionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update exception priority: ${error.message}`);
    }

    return data;
  }

  // ==================== AUTO-GENERATION ====================

  /**
   * Auto-generate exceptions from failed plausibility checks
   */
  async generateExceptionsFromChecks(
    financialStatementId: string,
    userId?: string,
  ): Promise<ExceptionReport[]> {
    const supabase = this.supabaseService.getClient();

    // Get failed checks that don't already have exceptions
    const { data: failedChecks, error } = await supabase
      .from('plausibility_checks')
      .select('id')
      .eq('financial_statement_id', financialStatementId)
      .in('status', [
        PlausibilityCheckStatus.FAILED,
        PlausibilityCheckStatus.WARNING,
      ]);

    if (error) {
      throw new Error(`Failed to fetch failed checks: ${error.message}`);
    }

    // Get existing exceptions for these checks
    const { data: existingExceptions } = await supabase
      .from('exception_reports')
      .select('source_id')
      .eq('financial_statement_id', financialStatementId)
      .eq('source_type', ExceptionSourceType.PLAUSIBILITY_CHECK);

    const existingSourceIds = new Set(
      (existingExceptions || []).map((e) => e.source_id),
    );

    const exceptions: ExceptionReport[] = [];

    for (const check of failedChecks || []) {
      if (!existingSourceIds.has(check.id)) {
        try {
          const exception = await this.createExceptionFromCheck(
            check.id,
            financialStatementId,
            userId,
          );
          exceptions.push(exception);
        } catch (err) {
          console.error(
            `Failed to create exception for check ${check.id}:`,
            err,
          );
        }
      }
    }

    return exceptions;
  }

  /**
   * Auto-generate exceptions from material variances
   */
  async generateExceptionsFromVariances(
    financialStatementId: string,
    userId?: string,
  ): Promise<ExceptionReport[]> {
    const supabase = this.supabaseService.getClient();

    // Get material variances without explanations
    const { data: materialVariances, error } = await supabase
      .from('variance_analyses')
      .select('id')
      .eq('financial_statement_id', financialStatementId)
      .eq('is_material', true)
      .is('explanation', null);

    if (error) {
      throw new Error(`Failed to fetch material variances: ${error.message}`);
    }

    // Get existing exceptions for these variances
    const { data: existingExceptions } = await supabase
      .from('exception_reports')
      .select('source_id')
      .eq('financial_statement_id', financialStatementId)
      .eq('source_type', ExceptionSourceType.VARIANCE_ANALYSIS);

    const existingSourceIds = new Set(
      (existingExceptions || []).map((e) => e.source_id),
    );

    const exceptions: ExceptionReport[] = [];

    for (const variance of materialVariances || []) {
      if (!existingSourceIds.has(variance.id)) {
        try {
          const exception = await this.createExceptionFromVariance(
            variance.id,
            financialStatementId,
            userId,
          );
          exceptions.push(exception);
        } catch (err) {
          console.error(
            `Failed to create exception for variance ${variance.id}:`,
            err,
          );
        }
      }
    }

    return exceptions;
  }
}
