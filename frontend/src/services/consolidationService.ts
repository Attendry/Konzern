import api from './api';
import { ConsolidationEntry } from '../types';

export interface ConsolidationResult {
  entries: ConsolidationEntry[];
  summary: {
    totalEntries: number;
    intercompanyEliminations: number;
    debtConsolidations: number;
    capitalConsolidations: number;
    totalAmount: number;
  };
}

export const consolidationService = {
  calculate: async (financialStatementId: string): Promise<ConsolidationResult> => {
    const response = await api.post<ConsolidationResult>(
      `/consolidation/calculate/${financialStatementId}`,
    );
    return response.data;
  },

  getEntries: async (financialStatementId: string): Promise<ConsolidationEntry[]> => {
    const response = await api.get<ConsolidationEntry[]>(
      `/consolidation/entries/${financialStatementId}`,
    );
    return response.data;
  },

  createEntry: async (entry: Partial<ConsolidationEntry>): Promise<ConsolidationEntry> => {
    const response = await api.post<ConsolidationEntry>('/consolidation/entries', entry);
    return response.data;
  },
};
