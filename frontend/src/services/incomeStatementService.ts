import api from './api';

export interface IncomeStatementPosition {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  amount: number;
  companyId?: string;
  companyName?: string;
  isIntercompany?: boolean;
}

export interface ConsolidatedIncomeStatement {
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  revenue: {
    total: number;
    intercompanyEliminated: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  costOfSales: {
    total: number;
    intercompanyEliminated: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  operatingExpenses: {
    total: number;
    intercompanyEliminated: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  financialResult: {
    total: number;
    intercompanyEliminated: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  extraordinaryResult: {
    total: number;
    intercompanyEliminated: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  incomeBeforeTax: number;
  incomeTax: {
    total: number;
    consolidated: number;
    positions: IncomeStatementPosition[];
  };
  netIncome: {
    total: number;
    parentCompany: number;
    minorityInterests: number;
    consolidated: number;
  };
  eliminations: {
    intercompanyRevenue: number;
    intercompanyExpenses: number;
    intercompanyProfits: number;
    intercompanyInterest: number;
    total: number;
  };
  consolidationSummary: {
    companiesIncluded: number;
    eliminationsApplied: number;
  };
}

export const incomeStatementService = {
  consolidate: async (financialStatementId: string): Promise<ConsolidatedIncomeStatement> => {
    const response = await api.post<ConsolidatedIncomeStatement>(
      `/consolidation/income-statement/${financialStatementId}`
    );
    return response.data;
  },

  get: async (financialStatementId: string): Promise<ConsolidatedIncomeStatement> => {
    const response = await api.get<ConsolidatedIncomeStatement>(
      `/consolidation/income-statement/${financialStatementId}`
    );
    return response.data;
  },

  validate: async (financialStatementId: string) => {
    const response = await api.get(
      `/consolidation/income-statement/${financialStatementId}/validate`
    );
    return response.data;
  },
};
