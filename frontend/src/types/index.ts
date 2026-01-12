export interface Company {
  id: string;
  name: string;
  taxId?: string;
  address?: string;
  legalForm?: string;
  parentCompanyId?: string | null;
  isConsolidated: boolean;
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
