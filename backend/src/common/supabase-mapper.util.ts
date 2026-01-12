import { Company } from '../entities/company.entity';
import { FinancialStatement } from '../entities/financial-statement.entity';
import { AccountBalance } from '../entities/account-balance.entity';
import { ConsolidationEntry } from '../entities/consolidation-entry.entity';

/**
 * Utility functions for mapping Supabase database records to entity objects
 */
export class SupabaseMapper {
  static toCompany(data: any): Company {
    return {
      id: data.id,
      name: data.name,
      taxId: data.tax_id,
      address: data.address,
      legalForm: data.legal_form,
      parentCompanyId: data.parent_company_id,
      parentCompany: data.parent_company ? this.toCompany(data.parent_company) : null,
      children: data.children ? data.children.map((c: any) => this.toCompany(c)) : [],
      isConsolidated: data.is_consolidated ?? true,
      financialStatements: data.financial_statements || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  static toFinancialStatement(data: any): FinancialStatement {
    return {
      id: data.id,
      companyId: data.company_id,
      company: data.company || null,
      fiscalYear: data.fiscal_year,
      periodStart: new Date(data.period_start),
      periodEnd: new Date(data.period_end),
      status: data.status,
      accountBalances: data.account_balances
        ? data.account_balances.map((ab: any) => this.toAccountBalance(ab))
        : [],
      consolidationEntries: [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  static toAccountBalance(data: any): AccountBalance {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      financialStatement: data.financial_statement ? this.toFinancialStatement(data.financial_statement) : null as any,
      accountId: data.account_id,
      account: data.account || null,
      debit: parseFloat(String(data.debit)) || 0,
      credit: parseFloat(String(data.credit)) || 0,
      balance: parseFloat(String(data.balance)) || 0,
      isIntercompany: Boolean(data.is_intercompany),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  static toConsolidationEntry(data: any): ConsolidationEntry {
    return {
      id: data.id,
      financialStatementId: data.financial_statement_id,
      financialStatement: data.financial_statement ? this.toFinancialStatement(data.financial_statement) : null as any,
      accountId: data.account_id,
      account: data.account || null,
      debitAccountId: data.debit_account_id || null,
      debitAccount: data.debit_account || null,
      creditAccountId: data.credit_account_id || null,
      creditAccount: data.credit_account || null,
      adjustmentType: data.adjustment_type,
      amount: parseFloat(String(data.amount)) || 0,
      description: data.description,
      status: data.status || 'approved',
      source: data.source || 'automatic',
      hgbReference: data.hgb_reference || null,
      affectedCompanyIds: data.affected_company_ids || null,
      createdByUserId: data.created_by_user_id || null,
      approvedByUserId: data.approved_by_user_id || null,
      approvedAt: data.approved_at ? new Date(data.approved_at) : null,
      reversedByEntryId: data.reversed_by_entry_id || null,
      reversesEntryId: data.reverses_entry_id || null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Formats a date to ISO date string (YYYY-MM-DD) for Supabase
   */
  static formatDateForSupabase(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }

  /**
   * Gets current timestamp in ISO format
   */
  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }
}
