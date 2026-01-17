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
    // Get all financial statements for the company
    const { data: financialStatements, error: fsError } = await this.supabase
      .from('financial_statements')
      .select('id')
      .eq('company_id', companyId);

    if (fsError) {
      SupabaseErrorHandler.handle(fsError, 'Financial Statements', 'fetch');
    }

    if (!financialStatements || financialStatements.length === 0) {
      return [];
    }

    const financialStatementIds = financialStatements.map((fs: any) => fs.id);

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
      .in('financial_statement_id', financialStatementIds)
      .order('account(account_number)', { ascending: true })
      .order('financial_statement(fiscal_year)', { ascending: false });

    if (error) {
      SupabaseErrorHandler.handle(error, 'Account Balances', 'fetch');
    }

    return (data || []).map((item) => SupabaseMapper.toAccountBalance(item));
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
