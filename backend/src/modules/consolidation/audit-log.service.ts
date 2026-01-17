import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import {
  AuditLog,
  AuditAction,
  AuditEntityType,
  AuditLogQuery,
} from '../../entities/audit-log.entity';

interface CreateAuditLogDto {
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityName?: string;
  financialStatementId?: string;
  companyId?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  description?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Log an action
   */
  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const { data, error } = await this.supabase
      .from('audit_logs')
      .insert({
        user_id: dto.userId,
        user_email: dto.userEmail,
        user_name: dto.userName,
        action: dto.action,
        entity_type: dto.entityType,
        entity_id: dto.entityId,
        entity_name: dto.entityName,
        financial_statement_id: dto.financialStatementId,
        company_id: dto.companyId,
        before_state: dto.beforeState,
        after_state: dto.afterState,
        changes: dto.changes,
        metadata: dto.metadata,
        ip_address: dto.ipAddress,
        user_agent: dto.userAgent,
        session_id: dto.sessionId,
        description: dto.description,
        created_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating audit log:', error);
      // Don't throw - audit logging should not break main operations
      return null as any;
    }

    return this.mapToAuditLog(data);
  }

  /**
   * Log entity creation
   */
  async logCreate(
    entityType: AuditEntityType,
    entityId: string,
    entityName: string,
    afterState: Record<string, any>,
    userId?: string,
    financialStatementId?: string,
    companyId?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.CREATE,
      entityType,
      entityId,
      entityName,
      afterState,
      financialStatementId,
      companyId,
      description: `${entityType} "${entityName}" erstellt`,
    });
  }

  /**
   * Log entity update with diff calculation
   */
  async logUpdate(
    entityType: AuditEntityType,
    entityId: string,
    entityName: string,
    beforeState: Record<string, any>,
    afterState: Record<string, any>,
    userId?: string,
    financialStatementId?: string,
    companyId?: string,
  ): Promise<void> {
    const changes = this.calculateChanges(beforeState, afterState);

    await this.log({
      userId,
      action: AuditAction.UPDATE,
      entityType,
      entityId,
      entityName,
      beforeState,
      afterState,
      changes,
      financialStatementId,
      companyId,
      description: `${entityType} "${entityName}" aktualisiert`,
    });
  }

  /**
   * Log entity deletion
   */
  async logDelete(
    entityType: AuditEntityType,
    entityId: string,
    entityName: string,
    beforeState: Record<string, any>,
    userId?: string,
    financialStatementId?: string,
    companyId?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.DELETE,
      entityType,
      entityId,
      entityName,
      beforeState,
      financialStatementId,
      companyId,
      description: `${entityType} "${entityName}" gelöscht`,
    });
  }

  /**
   * Log approval action
   */
  async logApproval(
    entityType: AuditEntityType,
    entityId: string,
    entityName: string,
    userId: string,
    approved: boolean,
    reason?: string,
    financialStatementId?: string,
  ): Promise<void> {
    await this.log({
      userId,
      action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
      entityType,
      entityId,
      entityName,
      financialStatementId,
      metadata: { reason },
      description: `${entityType} "${entityName}" ${approved ? 'freigegeben' : 'abgelehnt'}${reason ? `: ${reason}` : ''}`,
    });
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    query: AuditLogQuery,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    let queryBuilder = this.supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    if (query.userId) {
      queryBuilder = queryBuilder.eq('user_id', query.userId);
    }
    if (query.entityType) {
      queryBuilder = queryBuilder.eq('entity_type', query.entityType);
    }
    if (query.entityId) {
      queryBuilder = queryBuilder.eq('entity_id', query.entityId);
    }
    if (query.action) {
      queryBuilder = queryBuilder.eq('action', query.action);
    }
    if (query.financialStatementId) {
      queryBuilder = queryBuilder.eq(
        'financial_statement_id',
        query.financialStatementId,
      );
    }
    if (query.companyId) {
      queryBuilder = queryBuilder.eq('company_id', query.companyId);
    }
    if (query.fromDate) {
      queryBuilder = queryBuilder.gte(
        'created_at',
        query.fromDate.toISOString(),
      );
    }
    if (query.toDate) {
      queryBuilder = queryBuilder.lte('created_at', query.toDate.toISOString());
    }

    queryBuilder = queryBuilder.order('created_at', { ascending: false });

    if (query.limit) {
      queryBuilder = queryBuilder.limit(query.limit);
    }
    if (query.offset) {
      queryBuilder = queryBuilder.range(
        query.offset,
        query.offset + (query.limit || 50) - 1,
      );
    }

    const { data, error, count } = await queryBuilder;

    if (error) {
      SupabaseErrorHandler.handle(error, 'Audit Logs', 'fetch');
    }

    return {
      logs: (data || []).map(this.mapToAuditLog),
      total: count || 0,
    };
  }

  /**
   * Get audit trail for a specific entity
   */
  async getEntityAuditTrail(
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<AuditLog[]> {
    const { data, error } = await this.supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true });

    if (error) {
      SupabaseErrorHandler.handle(error, 'Audit Logs', 'fetch');
    }

    return (data || []).map(this.mapToAuditLog);
  }

  /**
   * Get recent activity for a user
   */
  async getUserActivity(
    userId: string,
    limit: number = 50,
  ): Promise<AuditLog[]> {
    const { data, error } = await this.supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      SupabaseErrorHandler.handle(error, 'Audit Logs', 'fetch');
    }

    return (data || []).map(this.mapToAuditLog);
  }

  /**
   * Get activity summary for a financial statement
   */
  async getFinancialStatementActivity(
    financialStatementId: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    const { data, error } = await this.supabase
      .from('audit_logs')
      .select('*')
      .eq('financial_statement_id', financialStatementId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      SupabaseErrorHandler.handle(error, 'Audit Logs', 'fetch');
    }

    return (data || []).map(this.mapToAuditLog);
  }

  /**
   * Calculate changes between before and after states
   */
  private calculateChanges(
    before: Record<string, any>,
    after: Record<string, any>,
  ): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};

    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);

    for (const key of allKeys) {
      const fromValue = before?.[key];
      const toValue = after?.[key];

      if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
        changes[key] = { from: fromValue, to: toValue };
      }
    }

    return changes;
  }

  /**
   * Map database row to AuditLog entity
   */
  private mapToAuditLog(data: any): AuditLog {
    return {
      id: data.id,
      userId: data.user_id,
      userEmail: data.user_email,
      userName: data.user_name,
      action: data.action,
      entityType: data.entity_type,
      entityId: data.entity_id,
      entityName: data.entity_name,
      financialStatementId: data.financial_statement_id,
      companyId: data.company_id,
      beforeState: data.before_state,
      afterState: data.after_state,
      changes: data.changes,
      metadata: data.metadata,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      sessionId: data.session_id,
      description: data.description,
      createdAt: new Date(data.created_at),
    };
  }
}
