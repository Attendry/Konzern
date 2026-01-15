import api from './api';
import type { AuditStatistics, AuditLogEntry, OverrideRecord } from '../types/agent.types';

// ==========================================
// TYPES
// ==========================================

export interface TrendDataPoint {
  date: string;
  total: number;
  accept: number;
  reject: number;
  acceptRate: number;
  avgConfidence: number;
}

export interface ToolUsageData {
  tool: string;
  label: string;
  count: number;
  acceptRate: number;
  avgConfidence: number;
}

// ==========================================
// AI AUDIT SERVICE
// ==========================================

const aiAuditService = {
  /**
   * Get audit statistics for dashboard
   */
  async getStatistics(startDate: Date, endDate: Date): Promise<AuditStatistics> {
    const response = await api.get('/ai/audit/dashboard/statistics', {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
    return response.data;
  },

  /**
   * Get daily trend data for charts
   */
  async getTrend(startDate: Date, endDate: Date): Promise<TrendDataPoint[]> {
    const response = await api.get('/ai/audit/dashboard/trend', {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
    return response.data;
  },

  /**
   * Get tool usage breakdown
   */
  async getToolUsage(startDate: Date, endDate: Date): Promise<ToolUsageData[]> {
    const response = await api.get('/ai/audit/dashboard/tools', {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
    return response.data;
  },

  /**
   * Get audit log entries
   */
  async getAuditLog(
    startDate: Date,
    endDate: Date,
    userId?: string,
    decisionType?: string,
    toolName?: string,
  ): Promise<AuditLogEntry[]> {
    const response = await api.get('/ai/audit/log', {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId,
        decisionType,
        toolName,
      },
    });
    return response.data;
  },

  /**
   * Get override log entries
   */
  async getOverrideLog(startDate: Date, endDate: Date): Promise<OverrideRecord[]> {
    const response = await api.get('/ai/audit/overrides', {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
    return response.data;
  },

  /**
   * Download audit log as Excel
   */
  async downloadAuditLogExcel(
    startDate: Date,
    endDate: Date,
    userId?: string,
    decisionType?: string,
  ): Promise<void> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      format: 'xlsx',
    });
    
    if (userId) params.append('userId', userId);
    if (decisionType) params.append('decisionType', decisionType);

    const response = await api.get(`/ai/audit/export?${params.toString()}`, {
      responseType: 'blob',
    });

    // Create download link
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai_audit_log_${formatDate(startDate)}_${formatDate(endDate)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Download audit log as CSV
   */
  async downloadAuditLogCSV(startDate: Date, endDate: Date): Promise<void> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      format: 'csv',
    });

    const response = await api.get(`/ai/audit/export?${params.toString()}`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai_audit_log_${formatDate(startDate)}_${formatDate(endDate)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Download override log as Excel
   */
  async downloadOverrideLogExcel(startDate: Date, endDate: Date): Promise<void> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const response = await api.get(`/ai/audit/export/overrides?${params.toString()}`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai_override_log_${formatDate(startDate)}_${formatDate(endDate)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

// Helper function
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

export default aiAuditService;
