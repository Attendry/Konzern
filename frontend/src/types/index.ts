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

export interface ConsolidationEntry {
  id: string;
  financialStatementId: string;
  accountId: string;
  account?: Account;
  adjustmentType: 'elimination' | 'reclassification' | 'capital_consolidation' | 'debt_consolidation' | 'other';
  amount: number;
  description?: string;
  createdAt: string;
}
