import api from './api';
import { AuditLog, AuditAction, AuditEntityType } from '../types';

export interface AuditLogQuery {
  userId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  financialStatementId?: string;
  companyId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export const auditService = {
  // Get audit logs with filtering
  async getLogs(query: AuditLogQuery = {}): Promise<{ logs: AuditLog[]; total: number }> {
    const params = new URLSearchParams();
    if (query.userId) params.append('userId', query.userId);
    if (query.entityType) params.append('entityType', query.entityType);
    if (query.entityId) params.append('entityId', query.entityId);
    if (query.action) params.append('action', query.action);
    if (query.financialStatementId) params.append('financialStatementId', query.financialStatementId);
    if (query.companyId) params.append('companyId', query.companyId);
    if (query.fromDate) params.append('fromDate', query.fromDate);
    if (query.toDate) params.append('toDate', query.toDate);
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.offset) params.append('offset', query.offset.toString());

    const response = await api.get(`/audit/logs?${params.toString()}`);
    return response.data;
  },

  // Get audit trail for a specific entity
  async getEntityAuditTrail(entityType: AuditEntityType, entityId: string): Promise<AuditLog[]> {
    const response = await api.get(`/audit/entity/${entityType}/${entityId}`);
    return response.data;
  },

  // Get user activity
  async getUserActivity(userId: string, limit?: number): Promise<AuditLog[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get(`/audit/user/${userId}${params}`);
    return response.data;
  },

  // Get financial statement activity
  async getFinancialStatementActivity(financialStatementId: string, limit?: number): Promise<AuditLog[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get(`/audit/financial-statement/${financialStatementId}${params}`);
    return response.data;
  },
};

export default auditService;
