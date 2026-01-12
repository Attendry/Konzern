import api from './api';

export interface ConsolidationObligationResult {
  companyId: string;
  companyName: string;
  isObligatory: boolean;
  reason: 'majority_interest' | 'unified_management' | 'control_agreement' | 'none' | null;
  participationPercentage: number | null;
  hasUnifiedManagement: boolean | null;
  hasControlAgreement: boolean | null;
  exceptions: string[];
  warnings: string[];
  recommendations: string[];
  hgbReferences: string[];
}

export interface ManualDecision {
  hasUnifiedManagement?: boolean;
  hasControlAgreement?: boolean;
  exceptions?: string[];
  comment?: string;
}

export const consolidationObligationService = {
  checkObligation: async (companyId: string): Promise<ConsolidationObligationResult> => {
    const response = await api.get<ConsolidationObligationResult>(
      `/consolidation/obligation/check/${companyId}`
    );
    return response.data;
  },

  checkAll: async (): Promise<ConsolidationObligationResult[]> => {
    const response = await api.post<ConsolidationObligationResult[]>(
      '/consolidation/obligation/check-all'
    );
    return response.data;
  },

  getWarnings: async (): Promise<ConsolidationObligationResult[]> => {
    const response = await api.get<ConsolidationObligationResult[]>(
      '/consolidation/obligation/warnings'
    );
    return response.data;
  },

  getLastCheck: async (companyId: string) => {
    const response = await api.get(`/consolidation/obligation/last-check/${companyId}`);
    return response.data;
  },

  updateManualDecision: async (
    companyId: string,
    decision: ManualDecision
  ): Promise<{ success: boolean; message: string }> => {
    const response = await api.put<{ success: boolean; message: string }>(
      `/consolidation/obligation/manual-decision/${companyId}`,
      decision
    );
    return response.data;
  },
};
