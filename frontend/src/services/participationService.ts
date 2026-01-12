import api from './api';
import { Participation, CreateParticipationRequest, OwnershipHistory } from '../types';

export const participationService = {
  // Get all participations
  getAll: async (): Promise<Participation[]> => {
    const response = await api.get<Participation[]>('/participations');
    return response.data;
  },

  // Get participation by ID
  getById: async (id: string): Promise<Participation> => {
    const response = await api.get<Participation>(`/participations/${id}`);
    return response.data;
  },

  // Get participations by parent company
  getByParentCompany: async (parentCompanyId: string): Promise<Participation[]> => {
    const response = await api.get<Participation[]>(`/participations/parent/${parentCompanyId}`);
    return response.data;
  },

  // Get participations by subsidiary company
  getBySubsidiaryCompany: async (subsidiaryCompanyId: string): Promise<Participation[]> => {
    const response = await api.get<Participation[]>(`/participations/subsidiary/${subsidiaryCompanyId}`);
    return response.data;
  },

  // Create participation
  create: async (data: CreateParticipationRequest): Promise<Participation> => {
    const response = await api.post<Participation>('/participations', data);
    return response.data;
  },

  // Update participation
  update: async (id: string, data: Partial<CreateParticipationRequest>): Promise<Participation> => {
    const response = await api.put<Participation>(`/participations/${id}`, data);
    return response.data;
  },

  // Delete participation
  delete: async (id: string): Promise<void> => {
    await api.delete(`/participations/${id}`);
  },

  // Get ownership history for a participation
  getOwnershipHistory: async (participationId: string): Promise<OwnershipHistory[]> => {
    const response = await api.get<OwnershipHistory[]>(`/participations/${participationId}/history`);
    return response.data;
  },

  // Record ownership change
  recordOwnershipChange: async (
    participationId: string, 
    changeData: Partial<OwnershipHistory>
  ): Promise<OwnershipHistory> => {
    const response = await api.post<OwnershipHistory>(
      `/participations/${participationId}/history`,
      changeData
    );
    return response.data;
  },
};
