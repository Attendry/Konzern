import api from './api';
import { DeferredTax, DeferredTaxSummary, DeferredTaxSource, TemporaryDifferenceType, DeferredTaxStatus } from '../types';

export interface CreateDeferredTaxRequest {
  financialStatementId: string;
  companyId: string;
  differenceType: TemporaryDifferenceType;
  source: DeferredTaxSource;
  description: string;
  temporaryDifferenceAmount: number;
  taxRate?: number;
  affectsEquity?: boolean;
  expectedReversalYear?: number;
  originatingEntryId?: string;
  hgbNote?: string;
}

export interface UpdateDeferredTaxRequest {
  temporaryDifferenceAmount?: number;
  taxRate?: number;
  description?: string;
  expectedReversalYear?: number;
  status?: DeferredTaxStatus;
  hgbNote?: string;
}

export const deferredTaxService = {
  // Calculate deferred taxes for a financial statement
  async calculateDeferredTaxes(financialStatementId: string, taxRate?: number): Promise<{ deferredTaxes: DeferredTax[]; summary: DeferredTaxSummary }> {
    const params = taxRate ? `?taxRate=${taxRate}` : '';
    const response = await api.post(`/consolidation/deferred-taxes/calculate/${financialStatementId}${params}`);
    return response.data;
  },

  // Get all deferred taxes for a financial statement
  async getDeferredTaxes(financialStatementId: string): Promise<DeferredTax[]> {
    const response = await api.get(`/consolidation/deferred-taxes/${financialStatementId}`);
    return response.data;
  },

  // Get deferred tax summary
  async getSummary(financialStatementId: string): Promise<DeferredTaxSummary> {
    const response = await api.get(`/consolidation/deferred-taxes/summary/${financialStatementId}`);
    return response.data;
  },

  // Create a manual deferred tax entry
  async create(data: CreateDeferredTaxRequest): Promise<DeferredTax> {
    const response = await api.post('/consolidation/deferred-taxes', data);
    return response.data;
  },

  // Update a deferred tax entry
  async update(id: string, data: UpdateDeferredTaxRequest): Promise<DeferredTax> {
    const response = await api.put(`/consolidation/deferred-taxes/${id}`, data);
    return response.data;
  },

  // Delete a deferred tax entry
  async delete(id: string): Promise<void> {
    await api.delete(`/consolidation/deferred-taxes/${id}`);
  },
};

export default deferredTaxService;
