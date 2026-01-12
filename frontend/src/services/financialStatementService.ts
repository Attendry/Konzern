import api from './api';
import { FinancialStatement, AccountBalance } from '../types';

export const financialStatementService = {
  getAll: async (): Promise<FinancialStatement[]> => {
    const response = await api.get<FinancialStatement[]>('/financial-statements');
    return Array.isArray(response.data) ? response.data : [];
  },

  getById: async (id: string): Promise<FinancialStatement> => {
    const response = await api.get<FinancialStatement>(`/financial-statements/${id}`);
    return response.data;
  },

  getBalances: async (id: string): Promise<AccountBalance[]> => {
    const response = await api.get<AccountBalance[]>(`/financial-statements/${id}/balances`);
    return Array.isArray(response.data) ? response.data : [];
  },

  create: async (statement: Partial<FinancialStatement>): Promise<FinancialStatement> => {
    const response = await api.post<FinancialStatement>('/financial-statements', statement);
    return response.data;
  },

  update: async (id: string, statement: Partial<FinancialStatement>): Promise<FinancialStatement> => {
    const response = await api.patch<FinancialStatement>(`/financial-statements/${id}`, statement);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/financial-statements/${id}`);
  },
};
