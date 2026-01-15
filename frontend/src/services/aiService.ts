import api from './api';

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
};

export default aiService;
