import api from './api';

export interface ConsolidationMethod {
  method: 'full_consolidation' | 'equity_method' | 'proportional_consolidation';
  description: string;
  hgbReference: string;
}

export interface ConsolidationScope {
  parentCompany: {
    id: string;
    name: string;
  };
  subsidiaries: Array<{
    id: string;
    name: string;
    participationPercentage: number;
    consolidationMethod: string;
    includedFrom: string;
    excludedFrom?: string;
    exclusionReason?: string;
  }>;
  totalCompanies: number;
  consolidatedCompanies: number;
  excludedCompanies: number;
}

export interface GoodwillBreakdown {
  total: number;
  breakdown: Array<{
    subsidiaryCompanyId: string;
    subsidiaryCompanyName: string;
    goodwill: number;
    negativeGoodwill: number;
    acquisitionDate: string | null;
    acquisitionCost: number | null;
    bookValue: number;
    equityAtAcquisition: number;
  }>;
}

export interface MinorityInterestsBreakdown {
  total: number;
  breakdown: Array<{
    subsidiaryCompanyId: string;
    subsidiaryCompanyName: string;
    minorityPercentage: number;
    minorityEquity: number;
    minorityResult: number;
    participationPercentage: number;
  }>;
}

export interface IntercompanyTransactionNote {
  transactionType: string;
  description: string;
  totalAmount: number;
  eliminatedAmount: number;
  companies: Array<{
    fromCompany: string;
    toCompany: string;
    amount: number;
  }>;
}

export interface RelatedPartyTransaction {
  relatedParty: string;
  relationship: string;
  transactionType: string;
  amount: number;
  description: string;
}

export interface ConsolidatedNotes {
  financialStatementId: string;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  consolidationMethods: ConsolidationMethod[];
  consolidationScope: ConsolidationScope;
  goodwillBreakdown: GoodwillBreakdown;
  minorityInterestsBreakdown: MinorityInterestsBreakdown;
  intercompanyTransactions: IntercompanyTransactionNote[];
  relatedPartyTransactions: RelatedPartyTransaction[];
  accountingPolicies: {
    consolidationMethod: string;
    currency: string;
    fiscalYearEnd: string;
    valuationMethods: string[];
  };
  significantEvents: string[];
  hgbReferences: string[];
}

export const consolidatedNotesService = {
  get: async (financialStatementId: string): Promise<ConsolidatedNotes> => {
    const response = await api.get<ConsolidatedNotes>(
      `/consolidation/notes/${financialStatementId}`
    );
    return response.data;
  },

  exportJson: async (financialStatementId: string): Promise<Blob> => {
    const response = await api.get(`/consolidation/notes/${financialStatementId}/export/json`, {
      responseType: 'blob',
    });
    return response.data;
  },

  exportText: async (financialStatementId: string): Promise<Blob> => {
    const response = await api.get(`/consolidation/notes/${financialStatementId}/export/text`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
