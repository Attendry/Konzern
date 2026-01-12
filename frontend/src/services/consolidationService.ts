import api from './api';
import { 
  ConsolidationEntry, 
  CreateConsolidationEntryRequest, 
  UpdateConsolidationEntryRequest,
  AdjustmentType,
  EntryStatus,
  EntrySource,
} from '../types';

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

export interface EntryFilters {
  adjustmentType?: AdjustmentType;
  status?: EntryStatus;
  source?: EntrySource;
}

export const consolidationService = {
  // Calculate consolidation
  calculate: async (financialStatementId: string): Promise<ConsolidationResult> => {
    const response = await api.post<ConsolidationResult>(
      `/consolidation/calculate/${financialStatementId}`,
    );
    return response.data;
  },

  // Get entries with optional filters
  getEntries: async (
    financialStatementId: string, 
    filters?: EntryFilters
  ): Promise<ConsolidationEntry[]> => {
    const params = new URLSearchParams();
    if (filters?.adjustmentType) params.append('adjustmentType', filters.adjustmentType);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.source) params.append('source', filters.source);
    
    const queryString = params.toString();
    const url = `/consolidation/entries/${financialStatementId}${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<ConsolidationEntry[]>(url);
    return response.data;
  },

  // Get manual entries only
  getManualEntries: async (financialStatementId: string): Promise<ConsolidationEntry[]> => {
    const response = await api.get<ConsolidationEntry[]>(
      `/consolidation/entries/${financialStatementId}/manual`,
    );
    return response.data;
  },

  // Get pending entries (awaiting approval)
  getPendingEntries: async (financialStatementId: string): Promise<ConsolidationEntry[]> => {
    const response = await api.get<ConsolidationEntry[]>(
      `/consolidation/entries/${financialStatementId}/pending`,
    );
    return response.data;
  },

  // Create new entry
  createEntry: async (entry: CreateConsolidationEntryRequest): Promise<ConsolidationEntry> => {
    const response = await api.post<ConsolidationEntry>('/consolidation/entries', entry);
    return response.data;
  },

  // Update existing entry (draft only)
  updateEntry: async (
    entryId: string, 
    updates: UpdateConsolidationEntryRequest
  ): Promise<ConsolidationEntry> => {
    const response = await api.put<ConsolidationEntry>(
      `/consolidation/entries/${entryId}`, 
      updates
    );
    return response.data;
  },

  // Delete entry (draft only)
  deleteEntry: async (entryId: string): Promise<void> => {
    await api.delete(`/consolidation/entries/${entryId}`);
  },

  // Submit entry for approval
  submitForApproval: async (entryId: string): Promise<ConsolidationEntry> => {
    const response = await api.post<ConsolidationEntry>(
      `/consolidation/entries/${entryId}/submit`,
    );
    return response.data;
  },

  // Approve entry (4-eyes principle)
  approveEntry: async (
    entryId: string, 
    approvedByUserId: string
  ): Promise<ConsolidationEntry> => {
    const response = await api.post<ConsolidationEntry>(
      `/consolidation/entries/${entryId}/approve`,
      { approvedByUserId },
    );
    return response.data;
  },

  // Reject entry
  rejectEntry: async (
    entryId: string, 
    rejectedByUserId: string, 
    reason: string
  ): Promise<ConsolidationEntry> => {
    const response = await api.post<ConsolidationEntry>(
      `/consolidation/entries/${entryId}/reject`,
      { rejectedByUserId, reason },
    );
    return response.data;
  },

  // Reverse approved entry
  reverseEntry: async (
    entryId: string, 
    reversedByUserId: string, 
    reason: string
  ): Promise<ConsolidationEntry> => {
    const response = await api.post<ConsolidationEntry>(
      `/consolidation/entries/${entryId}/reverse`,
      { reversedByUserId, reason },
    );
    return response.data;
  },

  // IC Reconciliation methods
  getICReconciliations: async (financialStatementId: string): Promise<ICReconciliation[]> => {
    const response = await api.get<ICReconciliation[]>(
      `/consolidation/intercompany/reconciliation/${financialStatementId}`,
    );
    return response.data;
  },

  getICReconciliationSummary: async (financialStatementId: string): Promise<ICReconciliationSummary> => {
    const response = await api.get<ICReconciliationSummary>(
      `/consolidation/intercompany/reconciliation/${financialStatementId}/summary`,
    );
    return response.data;
  },

  createICReconciliations: async (financialStatementId: string): Promise<{ created: number; differences: number }> => {
    const response = await api.post<{ created: number; differences: number }>(
      `/consolidation/intercompany/reconciliation/${financialStatementId}/create`,
    );
    return response.data;
  },

  updateICReconciliation: async (
    reconciliationId: string,
    updateData: {
      status?: ICReconciliationStatus;
      differenceReason?: ICDifferenceReason;
      explanation?: string;
      resolvedByUserId?: string;
    },
  ): Promise<ICReconciliation> => {
    const response = await api.put<ICReconciliation>(
      `/consolidation/intercompany/reconciliation/${reconciliationId}`,
      updateData,
    );
    return response.data;
  },

  generateClearingEntry: async (
    reconciliationId: string,
    userId: string,
  ): Promise<{ entryId: string; reconciliation: ICReconciliation }> => {
    const response = await api.post<{ entryId: string; reconciliation: ICReconciliation }>(
      `/consolidation/intercompany/reconciliation/${reconciliationId}/clear`,
      { userId },
    );
    return response.data;
  },
};

// IC Reconciliation Types
export interface ICReconciliation {
  id: string;
  financialStatementId: string;
  companyAId: string;
  companyA?: { id: string; name: string };
  companyBId: string;
  companyB?: { id: string; name: string };
  accountAId: string;
  accountA?: { id: string; accountNumber: string; name: string };
  accountBId: string;
  accountB?: { id: string; accountNumber: string; name: string };
  amountCompanyA: number;
  amountCompanyB: number;
  differenceAmount: number;
  status: ICReconciliationStatus;
  differenceReason?: ICDifferenceReason;
  explanation?: string;
  clearingEntryId?: string;
  resolvedByUserId?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ICReconciliationStatus = 'open' | 'explained' | 'cleared' | 'accepted';
export type ICDifferenceReason = 'timing' | 'currency' | 'booking_error' | 'missing_entry' | 'different_valuation' | 'intercompany_profit' | 'other';

export interface ICReconciliationSummary {
  total: number;
  open: number;
  explained: number;
  cleared: number;
  accepted: number;
  totalDifferenceAmount: number;
  openDifferenceAmount: number;
}
