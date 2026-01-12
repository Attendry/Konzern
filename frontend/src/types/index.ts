// Consolidation type according to HGB
export type ConsolidationType = 'full' | 'proportional' | 'equity' | 'none';

// Reason for exclusion from consolidation (§ 296 HGB)
export type ExclusionReason = 
  | 'materiality' 
  | 'temporary_control' 
  | 'severe_restrictions' 
  | 'disproportionate_cost' 
  | 'different_activity' 
  | 'none';

// Currency codes
export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'PLN' | 'CZK' | 'SEK' | 'DKK' | 'NOK' | 'HUF' | 'RON' | 'BGN' | 'HRK' | 'JPY' | 'CNY' | 'OTHER';

export interface Company {
  id: string;
  name: string;
  taxId?: string;
  address?: string;
  legalForm?: string;
  parentCompanyId?: string | null;
  isConsolidated: boolean;
  // Phase 2 extensions
  consolidationType?: ConsolidationType;
  exclusionReason?: ExclusionReason | null;
  firstConsolidationDate?: string | null;
  deconsolidationDate?: string | null;
  functionalCurrency?: Currency;
  countryCode?: string | null;
  industry?: string | null;
  fiscalYearEndMonth?: number;
  notes?: string | null;
  isUltimateParent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialStatement {
  id: string;
  companyId: string;
  company?: Company;
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'finalized' | 'consolidated';
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  accountNumber: string;
  name: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parentAccountId?: string | null;
}

export interface AccountBalance {
  id: string;
  financialStatementId: string;
  accountId: string;
  account?: Account;
  debit: number;
  credit: number;
  balance: number;
  isIntercompany: boolean;
}

// Adjustment types matching HGB consolidation requirements
export type AdjustmentType = 
  | 'elimination'
  | 'reclassification'
  | 'capital_consolidation'
  | 'debt_consolidation'
  | 'intercompany_profit'
  | 'income_expense'
  | 'currency_translation'
  | 'deferred_tax'
  | 'minority_interest'
  | 'other';

// Workflow status for entries
export type EntryStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'reversed';

// Source of the entry
export type EntrySource = 'automatic' | 'manual' | 'import';

// HGB references for compliance
export type HgbReference = 
  | '§ 301 HGB'
  | '§ 303 HGB'
  | '§ 304 HGB'
  | '§ 305 HGB'
  | '§ 306 HGB'
  | '§ 307 HGB'
  | '§ 308 HGB'
  | '§ 308a HGB'
  | '§ 312 HGB'
  | 'Sonstige';

export interface ConsolidationEntry {
  id: string;
  financialStatementId: string;
  accountId?: string;
  account?: Account;
  debitAccountId?: string;
  debitAccount?: Account;
  creditAccountId?: string;
  creditAccount?: Account;
  adjustmentType: AdjustmentType;
  amount: number;
  description?: string;
  status: EntryStatus;
  source: EntrySource;
  hgbReference?: HgbReference;
  affectedCompanyIds?: string[];
  createdByUserId?: string;
  approvedByUserId?: string;
  approvedAt?: string;
  reversedByEntryId?: string;
  reversesEntryId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateConsolidationEntryRequest {
  financialStatementId: string;
  debitAccountId: string;
  creditAccountId: string;
  adjustmentType: AdjustmentType;
  amount: number;
  description?: string;
  source: EntrySource;
  hgbReference?: HgbReference;
  affectedCompanyIds?: string[];
}

export interface UpdateConsolidationEntryRequest {
  debitAccountId?: string;
  creditAccountId?: string;
  adjustmentType?: AdjustmentType;
  amount?: number;
  description?: string;
  hgbReference?: HgbReference;
  affectedCompanyIds?: string[];
}

// ============================================
// PHASE 2: Participations & Ownership
// ============================================

export type OwnershipChangeType = 'initial' | 'increase' | 'decrease' | 'full_sale' | 'merger' | 'demerger';

export interface Participation {
  id: string;
  parentCompanyId: string;
  parentCompany?: Company;
  subsidiaryCompanyId: string;
  subsidiaryCompany?: Company;
  participationPercentage: number;
  votingRightsPercentage?: number;
  acquisitionCost?: number;
  acquisitionDate?: string;
  goodwill?: number;
  negativeGoodwill?: number;
  hiddenReserves?: number;
  hiddenLiabilities?: number;
  equityAtAcquisition?: number;
  isDirect?: boolean;
  throughCompanyId?: string;
  throughCompany?: Company;
  isActive?: boolean;
  disposalDate?: string;
  disposalProceeds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OwnershipHistory {
  id: string;
  participationId: string;
  participation?: Participation;
  changeType: OwnershipChangeType;
  effectiveDate: string;
  percentageBefore: number;
  percentageAfter: number;
  percentageChange: number;
  transactionAmount?: number;
  goodwillChange?: number;
  description?: string;
  consolidationEntryId?: string;
  createdAt: string;
}

export interface CreateParticipationRequest {
  parentCompanyId: string;
  subsidiaryCompanyId: string;
  participationPercentage: number;
  votingRightsPercentage?: number;
  acquisitionCost?: number;
  acquisitionDate?: string;
  goodwill?: number;
  hiddenReserves?: number;
  equityAtAcquisition?: number;
}

// ============================================
// PHASE 2: Exchange Rates & Currency
// ============================================

export type RateType = 'spot' | 'average' | 'historical';
export type RateSource = 'ecb' | 'bundesbank' | 'manual' | 'import';

export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rateDate: string;
  rate: number;
  rateType: RateType;
  rateSource: RateSource;
  fiscalYear?: number;
  fiscalMonth?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExchangeRateRequest {
  fromCurrency: string;
  toCurrency: string;
  rateDate: string;
  rate: number;
  rateType: RateType;
  rateSource?: RateSource;
  fiscalYear?: number;
  fiscalMonth?: number;
  notes?: string;
}

export interface CurrencyTranslationDifference {
  id: string;
  companyId: string;
  financialStatementId: string;
  fiscalYear: number;
  sourceCurrency: string;
  targetCurrency: string;
  spotRate: number;
  averageRate: number;
  historicalRate?: number;
  balanceSheetDifference: number;
  incomeStatementDifference: number;
  equityDifference: number;
  totalDifference: number;
  cumulativeDifference: number;
  consolidationEntryId?: string;
  createdAt: string;
  updatedAt: string;
}
