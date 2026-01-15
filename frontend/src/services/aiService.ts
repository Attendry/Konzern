import api from './api';
import type {
  AgentResponse,
  ModeStatus,
  AgentModeType,
  OverrideDecision,
  AuditStatistics,
  AuditLogEntry,
  OverrideRecord,
} from '../types/agent.types';
import type { LegalChangeAlert } from '../types/legal.types';

// ==========================================
// TYPES
// ==========================================

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatResponse {
  message: string;
  data?: Record<string, any>;
}

export type ICCauseType = 'timing' | 'fx' | 'rounding' | 'missing_entry' | 'error' | 'unknown';

export interface CorrectionEntry {
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
}

export interface ICExplanation {
  reconciliationId: string;
  explanation: string;
  likelyCause: ICCauseType;
  confidence: number;
  suggestedAction: string;
  correctionEntry?: CorrectionEntry;
}

export interface HealthStatus {
  status: string;
  model: string;
  available: boolean;
}

// Re-export agent types
export type { AgentResponse, ModeStatus, AuditStatistics, AuditLogEntry, OverrideRecord };

// ==========================================
// AI SERVICE
// ==========================================

const aiService = {
  /**
   * Check if AI service is healthy and available
   */
  async checkHealth(): Promise<HealthStatus> {
    const response = await api.get('/ai/health');
    return response.data;
  },

  /**
   * Send a chat message to the AI
   */
  async sendMessage(
    message: string,
    history: ChatMessage[] = [],
    financialStatementId?: string,
  ): Promise<ChatResponse> {
    const response = await api.post('/ai/chat', {
      message,
      history,
      financialStatementId,
    });
    return response.data;
  },

  /**
   * Get AI explanation for an IC difference
   */
  async explainDifference(reconciliationId: string): Promise<ICExplanation> {
    const response = await api.post('/ai/ic/explain', { reconciliationId });
    return response.data;
  },

  /**
   * Batch analyze all open IC differences
   */
  async batchAnalyze(financialStatementId: string): Promise<ICExplanation[]> {
    const response = await api.post('/ai/ic/batch-analyze', { financialStatementId });
    return response.data;
  },

  // ==========================================
  // AGENT ENDPOINTS
  // ==========================================

  /**
   * Process a request through the AI Agent
   */
  async processAgentRequest(
    message: string,
    financialStatementId?: string,
    sessionId?: string,
    userId?: string,
  ): Promise<AgentResponse> {
    const response = await api.post('/ai/agent/process', {
      message,
      financialStatementId,
      sessionId,
      userId,
    });
    return response.data;
  },

  /**
   * Get current mode status
   */
  async getModeStatus(userId?: string): Promise<ModeStatus> {
    const response = await api.get('/ai/agent/mode', {
      params: { userId },
    });
    return response.data;
  },

  /**
   * Set agent mode
   */
  async setMode(mode: AgentModeType, userId?: string): Promise<ModeStatus> {
    const response = await api.post('/ai/agent/mode', {
      mode,
      userId,
    });
    return response.data;
  },

  /**
   * Record user decision on AI recommendation
   */
  async recordDecision(
    auditLogId: string,
    decision: OverrideDecision,
    reasoning?: string,
    actionTaken?: string,
    actionResult?: any,
  ): Promise<{ success: boolean }> {
    const response = await api.post('/ai/agent/decision', {
      auditLogId,
      decision,
      reasoning,
      actionTaken,
      actionResult,
    });
    return response.data;
  },

  // ==========================================
  // AUDIT ENDPOINTS
  // ==========================================

  /**
   * Get audit statistics
   */
  async getAuditStatistics(startDate: Date, endDate: Date): Promise<AuditStatistics> {
    const response = await api.get('/ai/audit/statistics', {
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
    decisionType?: OverrideDecision,
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

  // ==========================================
  // LEGAL AWARENESS ENDPOINTS
  // ==========================================

  /**
   * Get legal change alerts for the current user
   */
  async getLegalAlerts(userId?: string): Promise<LegalChangeAlert[]> {
    const response = await api.get('/ai/legal/alerts', {
      params: { userId },
    });
    return response.data;
  },

  /**
   * Dismiss a legal change alert
   */
  async dismissLegalAlert(changeId: string, userId?: string): Promise<{ success: boolean }> {
    const response = await api.post('/ai/legal/alerts/dismiss', {
      changeId,
      userId,
    });
    return response.data;
  },
};

export default aiService;
