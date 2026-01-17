import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseErrorHandler } from '../../common/supabase-error.util';
import { SupabaseMapper } from '../../common/supabase-mapper.util';
import { FinancialStatement } from '../../entities/financial-statement.entity';
import { AccountBalance } from '../../entities/account-balance.entity';
import { CreateFinancialStatementDto } from './dto/create-financial-statement.dto';
import { UpdateFinancialStatementDto } from './dto/update-financial-statement.dto';

@Injectable()
export class FinancialStatementService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async create(
    createFinancialStatementDto: CreateFinancialStatementDto,
  ): Promise<FinancialStatement> {
    const { data, error } = await this.supabase
      .from('financial_statements')
      .insert({
        company_id: createFinancialStatementDto.companyId,
        fiscal_year: createFinancialStatementDto.fiscalYear,
        period_start: SupabaseMapper.formatDateForSupabase(
          createFinancialStatementDto.periodStart,
        ),
        period_end: SupabaseMapper.formatDateForSupabase(
          createFinancialStatementDto.periodEnd,
        ),
        status: createFinancialStatementDto.status || 'draft',
        created_at: SupabaseMapper.getCurrentTimestamp(),
        updated_at: SupabaseMapper.getCurrentTimestamp(),
      })
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Financial Statement', 'create');
    }

    SupabaseErrorHandler.handleNotFound(data, 'Financial Statement');
    return SupabaseMapper.toFinancialStatement(data);
  }

  async findAll(): Promise<FinancialStatement[]> {
    const { data, error } = await this.supabase
      .from('financial_statements')
      .select(
        `
        *,
        company:companies(*)
      `,
      )
      .order('fiscal_year', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      SupabaseErrorHandler.handle(error, 'Financial Statements', 'fetch');
    }

    return (data || []).map((item) =>
      SupabaseMapper.toFinancialStatement(item),
    );
  }

  async findByCompanyId(companyId: string): Promise<FinancialStatement[]> {
    const { data, error } = await this.supabase
      .from('financial_statements')
      .select(
        `
        *,
        company:companies(*)
      `,
      )
      .eq('company_id', companyId)
      .order('fiscal_year', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      SupabaseErrorHandler.handle(error, 'Financial Statements', 'fetch');
    }

    return (data || []).map((item) =>
      SupabaseMapper.toFinancialStatement(item),
    );
  }

  async findOne(id: string): Promise<FinancialStatement> {
    const { data, error } = await this.supabase
      .from('financial_statements')
      .select(
        `
        *,
        company:companies(*),
        account_balances:account_balances(
          *,
          account:accounts(*)
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Financial Statement', 'fetch');
    }

    SupabaseErrorHandler.handleNotFound(data, 'Financial Statement');
    return SupabaseMapper.toFinancialStatement(data);
  }

  async findBalances(id: string): Promise<AccountBalance[]> {
    const { data, error } = await this.supabase
      .from('account_balances')
      .select(
        `
        *,
        account:accounts(*)
      `,
      )
      .eq('financial_statement_id', id)
      .order('account(account_number)', { ascending: true });

    if (error) {
      SupabaseErrorHandler.handle(error, 'Account Balances', 'fetch');
    }

    return (data || []).map((item) => SupabaseMapper.toAccountBalance(item));
  }

  async findBalancesByCompanyId(companyId: string): Promise<AccountBalance[]> {
    // Get all financial statements for the company (with fiscal_year for sorting)
    const { data: financialStatements, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('id, fiscal_year')
      .eq('company_id', companyId);

    if (fsError) {
      SupabaseErrorHandler.handle(fsError, 'Financial Statements', 'fetch');
    }

    if (!financialStatements || financialStatements.length === 0) {
      console.log(`[FinancialStatementService] No financial statements found for company ${companyId}`);
      return [];
    }

    const financialStatementIds = financialStatements.map((fs: any) => fs.id);
    const fsMap = new Map(financialStatements.map((fs: any) => [fs.id, fs]));

    console.log(`[FinancialStatementService] Looking for balances for company ${companyId} in ${financialStatementIds.length} financial statements:`, financialStatementIds);

    // Get all account balances for all financial statements of this company
    const { data, error } = await this.supabase
      .from('account_balances')
      .select(
        `
        *,
        account:accounts(*),
        financial_statement:financial_statements(*)
      `,
      )
      .in('financial_statement_id', financialStatementIds);

    if (error) {
      console.error('[FinancialStatementService] Error fetching balances by company:', error);
      SupabaseErrorHandler.handle(error, 'Account Balances', 'fetch');
    }

    console.log(`[FinancialStatementService] Found ${data?.length || 0} balances for company ${companyId} across ${financialStatementIds.length} financial statements`);
    
    // Debug: If no balances found, check if they exist without the relationship
    if (!data || data.length === 0) {
      console.log(`[FinancialStatementService] No balances found with relationships. Checking raw balances...`);
      const { data: rawBalances, error: rawError } = await this.supabase
        .from('account_balances')
        .select('id, financial_statement_id, account_id')
        .in('financial_statement_id', financialStatementIds);
      
      if (rawError) {
        console.error('[FinancialStatementService] Error checking raw balances:', rawError);
      } else {
        console.log(`[FinancialStatementService] Found ${rawBalances?.length || 0} raw balances (without relationships) for financial statements:`, financialStatementIds);
        if (rawBalances && rawBalances.length > 0) {
          // Check if accounts exist for these balances
          const accountIds = [...new Set(rawBalances.map((b: any) => b.account_id))];
          const { data: accounts } = await this.supabase
            .from('accounts')
            .select('id, account_number')
            .in('id', accountIds);
          console.log(`[FinancialStatementService] Found ${accounts?.length || 0} accounts for ${accountIds.length} account IDs`);
        }
      }
    }
    
    // Debug: Check if balances exist but account relationship is missing
    if (data && data.length > 0) {
      const balancesWithoutAccount = data.filter((item: any) => !item.account);
      if (balancesWithoutAccount.length > 0) {
        console.warn(`[FinancialStatementService] Found ${balancesWithoutAccount.length} balances without account relationship`);
      }
      
      // Also check raw data
      console.log(`[FinancialStatementService] Sample balance data:`, data.slice(0, 2).map((item: any) => ({
        id: item.id,
        account_id: item.account_id,
        hasAccount: !!item.account,
        accountNumber: item.account?.account_number || item.account?.accountNumber || 'N/A'
      })));
    }

    const mapped = (data || []).map((item) => {
      try {
        const mapped = SupabaseMapper.toAccountBalance(item);
        // Log if account is missing
        if (!mapped.account && item.account_id) {
          console.warn(`[FinancialStatementService] Balance ${item.id} has account_id ${item.account_id} but account relationship is missing`);
        }
        return mapped;
      } catch (err) {
        console.error('[FinancialStatementService] Error mapping balance:', err, item);
        return null;
      }
    }).filter((item) => item !== null) as AccountBalance[];
    
    // Don't filter out balances without accounts - they should still be shown
    // The frontend can handle missing account data
    
    // Sort by account number, then by fiscal year
    mapped.sort((a, b) => {
      const accountNumA = a.account?.accountNumber || '';
      const accountNumB = b.account?.accountNumber || '';
      if (accountNumA !== accountNumB) {
        return accountNumA.localeCompare(accountNumB);
      }
      // If account numbers are the same, sort by fiscal year (descending)
      const fsA = fsMap.get(a.financialStatementId);
      const fsB = fsMap.get(b.financialStatementId);
      const yearA = fsA?.fiscal_year || 0;
      const yearB = fsB?.fiscal_year || 0;
      return yearB - yearA;
    });

    console.log(`[FinancialStatementService] Returning ${mapped.length} mapped balances for company ${companyId}`);
    return mapped;
  }

  /**
   * Diagnostic method: Check if any balances exist for a company, even if not properly linked
   * This helps diagnose import issues
   */
  async diagnoseCompanyBalances(companyId: string): Promise<{
    financialStatements: any[];
    balancesByFS: Record<string, number>;
    totalBalances: number;
    orphanedBalances: any[];
  }> {
    // Get all financial statements for the company
    const { data: financialStatements } = await this.supabase
      .from('financial_statements')
      .select('id, fiscal_year, company_id')
      .eq('company_id', companyId);

    const fsIds = (financialStatements || []).map((fs: any) => fs.id);
    
    // Check balances for each financial statement
    const balancesByFS: Record<string, number> = {};
    let totalBalances = 0;
    
    for (const fsId of fsIds) {
      const { data: balances, count } = await this.supabase
        .from('account_balances')
        .select('id, financial_statement_id, account_id', { count: 'exact' })
        .eq('financial_statement_id', fsId);
      
      const countValue = count || balances?.length || 0;
      balancesByFS[fsId] = countValue;
      totalBalances += countValue;
    }
    
    // Check for orphaned balances (balances with financial_statement_id that doesn't belong to this company)
    const { data: allCompanyBalances } = await this.supabase
      .from('account_balances')
      .select('id, financial_statement_id, account_id')
      .in('financial_statement_id', fsIds);
    
    // Also check if there are balances with financial_statement_id pointing to wrong company
    const { data: allFS } = await this.supabase
      .from('financial_statements')
      .select('id, company_id')
      .in('id', fsIds);
    
    const validFSIds = new Set((allFS || []).map((fs: any) => fs.id));
    const orphanedBalances = (allCompanyBalances || []).filter(
      (b: any) => !validFSIds.has(b.financial_statement_id)
    );
    
    return {
      financialStatements: financialStatements || [],
      balancesByFS,
      totalBalances,
      orphanedBalances,
    };
  }

  async update(
    id: string,
    updateFinancialStatementDto: UpdateFinancialStatementDto,
  ): Promise<FinancialStatement> {
    const updateData: Record<string, any> = {
      updated_at: SupabaseMapper.getCurrentTimestamp(),
    };

    if (updateFinancialStatementDto.fiscalYear !== undefined) {
      updateData.fiscal_year = updateFinancialStatementDto.fiscalYear;
    }
    if (updateFinancialStatementDto.periodStart) {
      updateData.period_start = SupabaseMapper.formatDateForSupabase(
        updateFinancialStatementDto.periodStart,
      );
    }
    if (updateFinancialStatementDto.periodEnd) {
      updateData.period_end = SupabaseMapper.formatDateForSupabase(
        updateFinancialStatementDto.periodEnd,
      );
    }
    if (updateFinancialStatementDto.status) {
      updateData.status = updateFinancialStatementDto.status;
    }

    const { data, error } = await this.supabase
      .from('financial_statements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      SupabaseErrorHandler.handle(error, 'Financial Statement', 'update');
    }

    SupabaseErrorHandler.handleNotFound(data, 'Financial Statement');
    return SupabaseMapper.toFinancialStatement(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('financial_statements')
      .delete()
      .eq('id', id);

    if (error) {
      SupabaseErrorHandler.handle(error, 'Financial Statement', 'delete');
    }
  }
}
