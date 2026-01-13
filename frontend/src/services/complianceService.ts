import api from './api';
import { ComplianceChecklistItem, ComplianceSummary, ChecklistItemStatus, ComplianceCategory } from '../types';

export interface UpdateChecklistItemRequest {
  status?: ChecklistItemStatus;
  notes?: string;
  evidence?: string;
  relatedEntityIds?: string[];
  completedByUserId?: string;
  dueDate?: string;
}

export interface AddCustomItemRequest {
  itemCode: string;
  description: string;
  category: ComplianceCategory;
  hgbReference?: string;
  requirement?: string;
  isMandatory?: boolean;
  priority?: number;
  dueDate?: string;
}

export const complianceService = {
  // Initialize checklist for a financial statement
  async initializeChecklist(financialStatementId: string): Promise<ComplianceChecklistItem[]> {
    const response = await api.post(`/compliance/initialize/${financialStatementId}`);
    return response.data;
  },

  // Get checklist for a financial statement
  async getChecklist(financialStatementId: string): Promise<ComplianceChecklistItem[]> {
    const response = await api.get(`/compliance/${financialStatementId}`);
    return response.data;
  },

  // Get checklist items by category
  async getChecklistByCategory(financialStatementId: string, category: ComplianceCategory): Promise<ComplianceChecklistItem[]> {
    const response = await api.get(`/compliance/${financialStatementId}/category/${category}`);
    return response.data;
  },

  // Get compliance summary
  async getSummary(financialStatementId: string): Promise<ComplianceSummary> {
    const response = await api.get(`/compliance/summary/${financialStatementId}`);
    return response.data;
  },

  // Update a checklist item
  async updateItem(id: string, data: UpdateChecklistItemRequest): Promise<ComplianceChecklistItem> {
    const response = await api.put(`/compliance/item/${id}`, data);
    return response.data;
  },

  // Complete a checklist item
  async completeItem(id: string, userId: string, notes?: string, evidence?: string): Promise<ComplianceChecklistItem> {
    const response = await api.post(`/compliance/item/${id}/complete`, { userId, notes, evidence });
    return response.data;
  },

  // Mark item for review
  async markForReview(id: string, reviewerId: string): Promise<ComplianceChecklistItem> {
    const response = await api.post(`/compliance/item/${id}/review`, { reviewerId });
    return response.data;
  },

  // Auto-update checklist from consolidation entries
  async autoUpdate(financialStatementId: string): Promise<void> {
    await api.post(`/compliance/auto-update/${financialStatementId}`);
  },

  // Add custom checklist item
  async addCustomItem(financialStatementId: string, data: AddCustomItemRequest): Promise<ComplianceChecklistItem> {
    const response = await api.post(`/compliance/${financialStatementId}/custom`, data);
    return response.data;
  },

  // Delete a checklist item
  async deleteItem(id: string): Promise<void> {
    await api.delete(`/compliance/item/${id}`);
  },
};

export default complianceService;
