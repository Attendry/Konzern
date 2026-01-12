import api from './api';

export interface FirstConsolidationInput {
  parentCompanyId: string;
  subsidiaryCompanyId: string;
  acquisitionDate: string;
  participationPercentage: number;
  acquisitionCost: number;
  subscribedCapital: number;
  capitalReserves: number;
  revenueReserves: number;
  retainedEarnings: number;
  hiddenReserves?: number;
  hiddenLiabilities?: number;
  financialStatementId: string;
  userId?: string;
}

export interface FirstConsolidationResult {
  participationId: string;
  goodwill: number;
  negativeGoodwill: number;
  minorityInterestAtAcquisition: number;
  hiddenReserves: number;
  hiddenLiabilities: number;
  consolidationEntries: any[];
  summary: {
    equityAtAcquisition: number;
    adjustedEquity: number;
    parentShare: number;
    minorityShare: number;
    difference: number;
  };
}

export interface DeconsolidationInput {
  participationId: string;
  disposalDate: string;
  disposalProceeds: number;
  financialStatementId: string;
  userId?: string;
}

export interface DeconsolidationResult {
  disposalGainLoss: number;
  consolidationEntries: any[];
  summary: {
    bookValue: number;
    disposalProceeds: number;
    cumulativeGoodwillWriteOff: number;
    cumulativeTranslationDifference: number;
    minorityInterestReleased: number;
  };
}

export interface MinorityInterestResult {
  minorityInterestEquity: number;
  minorityInterestProfit: number;
  details: {
    companyId: string;
    minorityPercentage: number;
    totalEquity: number;
    totalProfit: number;
    minorityInterestEquity: number;
    minorityInterestProfit: number;
  }[];
}

export const firstConsolidationService = {
  // Perform first consolidation
  performFirstConsolidation: async (
    input: FirstConsolidationInput
  ): Promise<FirstConsolidationResult> => {
    const response = await api.post<FirstConsolidationResult>(
      '/consolidation/first/perform',
      input
    );
    return response.data;
  },

  // Perform deconsolidation
  performDeconsolidation: async (
    input: DeconsolidationInput
  ): Promise<DeconsolidationResult> => {
    const response = await api.post<DeconsolidationResult>(
      '/consolidation/first/deconsolidate',
      input
    );
    return response.data;
  },

  // Calculate minority interests
  calculateMinorityInterests: async (
    financialStatementId: string,
    companyId: string
  ): Promise<MinorityInterestResult> => {
    const response = await api.get<MinorityInterestResult>(
      `/consolidation/first/minority/${financialStatementId}/${companyId}`
    );
    return response.data;
  },

  // Get first consolidation summary
  getFirstConsolidationSummary: async (subsidiaryCompanyId: string): Promise<any> => {
    const response = await api.get(
      `/consolidation/first/summary/${subsidiaryCompanyId}`
    );
    return response.data;
  },
};
