import api from './api';
import { 
  ExchangeRate, 
  CreateExchangeRateRequest, 
  CurrencyTranslationDifference,
  RateType,
} from '../types';

export interface ExchangeRateFilters {
  fromCurrency?: string;
  toCurrency?: string;
  rateType?: RateType;
  fiscalYear?: number;
  startDate?: string;
  endDate?: string;
}

export interface CurrencyTranslationResult {
  companyId: string;
  sourceCurrency: string;
  targetCurrency: string;
  spotRate: number;
  averageRate: number;
  balanceSheetDifference: number;
  incomeStatementDifference: number;
  totalDifference: number;
}

export const exchangeRateService = {
  // Get all exchange rates with optional filters
  getExchangeRates: async (filters?: ExchangeRateFilters): Promise<ExchangeRate[]> => {
    const params = new URLSearchParams();
    if (filters?.fromCurrency) params.append('fromCurrency', filters.fromCurrency);
    if (filters?.toCurrency) params.append('toCurrency', filters.toCurrency);
    if (filters?.rateType) params.append('rateType', filters.rateType);
    if (filters?.fiscalYear) params.append('fiscalYear', String(filters.fiscalYear));
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const queryString = params.toString();
    const url = `/exchange-rates${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<ExchangeRate[]>(url);
    return response.data;
  },

  // Get available currencies
  getAvailableCurrencies: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/exchange-rates/currencies');
    return response.data;
  },

  // Get specific rate
  getRate: async (
    fromCurrency: string,
    toCurrency: string,
    rateDate: string,
    rateType: RateType = 'spot',
  ): Promise<{ fromCurrency: string; toCurrency: string; rateDate: string; rateType: RateType; rate: number }> => {
    const response = await api.get(
      `/exchange-rates/rate?from=${fromCurrency}&to=${toCurrency}&date=${rateDate}&type=${rateType}`
    );
    return response.data;
  },

  // Create or update exchange rate
  upsertRate: async (rate: CreateExchangeRateRequest): Promise<ExchangeRate> => {
    const response = await api.post<ExchangeRate>('/exchange-rates', rate);
    return response.data;
  },

  // Bulk import rates
  bulkImportRates: async (rates: CreateExchangeRateRequest[]): Promise<{ imported: number; errors: string[] }> => {
    const response = await api.post<{ imported: number; errors: string[] }>(
      '/exchange-rates/bulk',
      rates
    );
    return response.data;
  },

  // Delete exchange rate
  deleteRate: async (rateId: string): Promise<void> => {
    await api.delete(`/exchange-rates/${rateId}`);
  },

  // Calculate currency translation
  calculateTranslation: async (
    companyId: string,
    financialStatementId: string,
    sourceCurrency: string,
    targetCurrency: string,
    rateDate: string,
    fiscalYear: number,
  ): Promise<CurrencyTranslationResult> => {
    const response = await api.post<CurrencyTranslationResult>(
      '/exchange-rates/calculate-translation',
      { companyId, financialStatementId, sourceCurrency, targetCurrency, rateDate, fiscalYear }
    );
    return response.data;
  },

  // Get translation differences for a company
  getTranslationDifferences: async (companyId: string): Promise<CurrencyTranslationDifference[]> => {
    const response = await api.get<CurrencyTranslationDifference[]>(
      `/exchange-rates/translation-differences/${companyId}`
    );
    return response.data;
  },
};

// Common currency list for UI
export const COMMON_CURRENCIES = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
];
