import api from './api';

export interface BalanceSheetPosition {
  accountId: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  companyId?: string;
  companyName?: string;
}

export interface ConsolidatedBalanceSheet {
  assets: {
    fixedAssets: BalanceSheetPosition[];
    currentAssets: BalanceSheetPosition[];
    goodwill: number;
    totalAssets: number;
  };
  liabilities: {
    provisions: BalanceSheetPosition[];
    longTermLiabilities: BalanceSheetPosition[];
    shortTermLiabilities: BalanceSheetPosition[];
    totalLiabilities: number;
  };
  equity: {
    subscribedCapital: number;
    capitalReserves: number;
    revenueReserves: number;
    retainedEarnings: number;
    minorityInterests: number;
    currencyTranslationDifference: number;
    totalEquity: number;
    positions: BalanceSheetPosition[];
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  balanceDifference: number;
}

export interface IncomeStatementPosition {
  accountId: string;
  accountNumber: string;
  accountName: string;
  amount: number;
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

export interface ConsolidationReport {
  financialStatementId: string;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  balanceSheet: ConsolidatedBalanceSheet;
  incomeStatement?: ConsolidatedIncomeStatement;
  overview: {
    parentCompany: {
      id: string;
      name: string;
    };
    consolidatedCompanies: {
      id: string;
      name: string;
      ownershipPercentage: number;
      consolidationType: string;
    }[];
    entriesCount: number;
    eliminationsTotal: number;
  };
  comparison?: {
    priorYear: number;
    balanceSheetChanges: {
      totalAssets: { current: number; prior: number; change: number; changePercent: number };
      totalLiabilities: { current: number; prior: number; change: number; changePercent: number };
      totalEquity: { current: number; prior: number; change: number; changePercent: number };
    };
    incomeStatementChanges?: {
      revenue: { current: number; prior: number; change: number; changePercent: number };
      netIncome: { current: number; prior: number; change: number; changePercent: number };
    };
  };
}

export const reportService = {
  // Get consolidated balance sheet
  getConsolidatedBalanceSheet: async (financialStatementId: string): Promise<ConsolidatedBalanceSheet> => {
    const response = await api.get<ConsolidatedBalanceSheet>(
      `/consolidation/balance-sheet/${financialStatementId}`
    );
    return response.data;
  },

  // Get consolidated income statement
  getConsolidatedIncomeStatement: async (financialStatementId: string): Promise<ConsolidatedIncomeStatement> => {
    const response = await api.get<ConsolidatedIncomeStatement>(
      `/consolidation/income-statement/${financialStatementId}`
    );
    return response.data;
  },

  // Get full consolidation report
  getConsolidationReport: async (financialStatementId: string, includeComparison: boolean = false): Promise<ConsolidationReport> => {
    const response = await api.get<ConsolidationReport>(
      `/consolidation/report/${financialStatementId}`,
      { params: { includeComparison } }
    );
    return response.data;
  },

  // Export to Excel
  exportToExcel: async (financialStatementId: string): Promise<Blob> => {
    const response = await api.get(
      `/consolidation/export/excel/${financialStatementId}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  // Export to PDF
  exportToPdf: async (financialStatementId: string): Promise<Blob> => {
    const response = await api.get(
      `/consolidation/export/pdf/${financialStatementId}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  // Export to XBRL/XML
  exportToXbrl: async (financialStatementId: string): Promise<Blob> => {
    const response = await api.get(
      `/consolidation/export/xml/${financialStatementId}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  // Get year-over-year comparison
  getYearComparison: async (financialStatementId: string): Promise<ConsolidationReport> => {
    const response = await api.get<ConsolidationReport>(
      `/consolidation/report/${financialStatementId}`,
      { params: { includeComparison: true } }
    );
    return response.data;
  },
};

export default reportService;
