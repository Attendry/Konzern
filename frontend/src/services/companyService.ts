import api from './api';
import { Company } from '../types';

export const companyService = {
  getAll: async (): Promise<Company[]> => {
    const response = await api.get<Company[]>('/companies');
    return Array.isArray(response.data) ? response.data : [];
  },

  getById: async (id: string): Promise<Company> => {
    const response = await api.get<Company>(`/companies/${id}`);
    return response.data;
  },

  getChildren: async (id: string): Promise<Company[]> => {
    const response = await api.get<Company[]>(`/companies/${id}/children`);
    return Array.isArray(response.data) ? response.data : [];
  },

  create: async (company: Partial<Company>): Promise<Company> => {
    const response = await api.post<Company>('/companies', company);
    return response.data;
  },

  update: async (id: string, company: Partial<Company>): Promise<Company> => {
    const response = await api.patch<Company>(`/companies/${id}`, company);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/companies/${id}`);
  },

  getHierarchy: async (): Promise<any[]> => {
    const response = await api.get<any[]>('/companies/hierarchy/all');
    return Array.isArray(response.data) ? response.data : [];
  },
};
