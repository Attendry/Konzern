import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RateType, RateSource } from '../../entities/exchange-rate.entity';

export interface ExchangeRateDto {
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

@Injectable()
export class ExchangeRateService {
  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Get all exchange rates with optional filters
   */
  async getExchangeRates(filters?: {
    fromCurrency?: string;
    toCurrency?: string;
    rateType?: RateType;
    fiscalYear?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    let query = this.supabase
      .from('exchange_rates')
      .select('*')
      .order('rate_date', { ascending: false });

    if (filters?.fromCurrency) {
      query = query.eq('from_currency', filters.fromCurrency);
    }
    if (filters?.toCurrency) {
      query = query.eq('to_currency', filters.toCurrency);
    }
    if (filters?.rateType) {
      query = query.eq('rate_type', filters.rateType);
    }
    if (filters?.fiscalYear) {
      query = query.eq('fiscal_year', filters.fiscalYear);
    }
    if (filters?.startDate) {
      query = query.gte('rate_date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('rate_date', filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException(`Fehler beim Laden der Wechselkurse: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get specific exchange rate
   */
  async getRate(
    fromCurrency: string,
    toCurrency: string,
    rateDate: string,
    rateType: RateType = RateType.SPOT,
  ): Promise<number> {
    // Handle same currency
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const { data, error } = await this.supabase
      .from('exchange_rates')
      .select('rate')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .eq('rate_type', rateType)
      .lte('rate_date', rateDate)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Try inverse rate
      const { data: inverseData, error: inverseError } = await this.supabase
        .from('exchange_rates')
        .select('rate')
        .eq('from_currency', toCurrency)
        .eq('to_currency', fromCurrency)
        .eq('rate_type', rateType)
        .lte('rate_date', rateDate)
        .order('rate_date', { ascending: false })
        .limit(1)
        .single();

      if (inverseError || !inverseData) {
        throw new NotFoundException(
          `Kein Wechselkurs gefunden für ${fromCurrency}/${toCurrency} am ${rateDate} (${rateType})`
        );
      }

      return 1 / parseFloat(inverseData.rate);
    }

    return parseFloat(data.rate);
  }

  /**
   * Create or update exchange rate
   */
  async upsertRate(dto: ExchangeRateDto): Promise<any> {
    const { data: existing } = await this.supabase
      .from('exchange_rates')
      .select('id')
      .eq('from_currency', dto.fromCurrency)
      .eq('to_currency', dto.toCurrency)
      .eq('rate_date', dto.rateDate)
      .eq('rate_type', dto.rateType)
      .single();

    const rateData = {
      from_currency: dto.fromCurrency,
      to_currency: dto.toCurrency,
      rate_date: dto.rateDate,
      rate: dto.rate,
      rate_type: dto.rateType,
      rate_source: dto.rateSource || RateSource.MANUAL,
      fiscal_year: dto.fiscalYear,
      fiscal_month: dto.fiscalMonth,
      notes: dto.notes,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      const { data, error } = await this.supabase
        .from('exchange_rates')
        .update(rateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw new BadRequestException(`Fehler: ${error.message}`);
      result = data;
    } else {
      const { data, error } = await this.supabase
        .from('exchange_rates')
        .insert({
          ...rateData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new BadRequestException(`Fehler: ${error.message}`);
      result = data;
    }

    return result;
  }

  /**
   * Bulk import exchange rates
   */
  async bulkImportRates(rates: ExchangeRateDto[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const rate of rates) {
      try {
        await this.upsertRate(rate);
        imported++;
      } catch (error: any) {
        errors.push(`${rate.fromCurrency}/${rate.toCurrency} ${rate.rateDate}: ${error.message}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Delete exchange rate
   */
  async deleteRate(rateId: string): Promise<void> {
    const { error } = await this.supabase
      .from('exchange_rates')
      .delete()
      .eq('id', rateId);

    if (error) {
      throw new BadRequestException(`Fehler beim Löschen: ${error.message}`);
    }
  }

  /**
   * Get available currencies
   */
  async getAvailableCurrencies(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('exchange_rates')
      .select('from_currency, to_currency');

    if (error) {
      throw new BadRequestException(`Fehler: ${error.message}`);
    }

    const currencies = new Set<string>();
    for (const rate of data || []) {
      currencies.add(rate.from_currency);
      currencies.add(rate.to_currency);
    }

    return Array.from(currencies).sort();
  }

  /**
   * Calculate currency translation for a company's financial statement
   */
  async calculateTranslation(
    companyId: string,
    financialStatementId: string,
    sourceCurrency: string,
    targetCurrency: string,
    rateDate: string,
    fiscalYear: number,
  ): Promise<CurrencyTranslationResult> {
    // Get rates
    const spotRate = await this.getRate(sourceCurrency, targetCurrency, rateDate, RateType.SPOT);
    const averageRate = await this.getRate(sourceCurrency, targetCurrency, rateDate, RateType.AVERAGE)
      .catch(() => spotRate); // Fallback to spot if no average

    // Get balance sheet totals
    const { data: balances } = await this.supabase
      .from('account_balances')
      .select('balance, accounts(account_type)')
      .eq('financial_statement_id', financialStatementId);

    // Get income statement totals
    const { data: incomeBalances } = await this.supabase
      .from('income_statement_balances')
      .select('balance')
      .eq('financial_statement_id', financialStatementId);

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalIncome = 0;

    for (const bal of balances || []) {
      const amount = parseFloat(bal.balance) || 0;
      const accountType = (bal.accounts as any)?.account_type;
      
      if (accountType === 'asset') totalAssets += amount;
      else if (accountType === 'liability') totalLiabilities += amount;
      else if (accountType === 'equity') totalEquity += amount;
    }

    for (const bal of incomeBalances || []) {
      totalIncome += parseFloat(bal.balance) || 0;
    }

    // Calculate translation differences
    // Balance sheet items at spot rate
    const bsAtSpot = (totalAssets - totalLiabilities) * spotRate;
    // Income statement at average rate
    const isAtAverage = totalIncome * averageRate;
    // Equity at historical rate (approximated with spot for now)
    const equityAtHistorical = totalEquity * spotRate;

    // Difference arises from using different rates
    const balanceSheetDifference = (totalAssets - totalLiabilities) * (spotRate - averageRate);
    const incomeStatementDifference = totalIncome * (averageRate - spotRate);

    const totalDifference = balanceSheetDifference + incomeStatementDifference;

    return {
      companyId,
      sourceCurrency,
      targetCurrency,
      spotRate,
      averageRate,
      balanceSheetDifference,
      incomeStatementDifference,
      totalDifference,
    };
  }

  /**
   * Save currency translation difference
   */
  async saveTranslationDifference(
    companyId: string,
    financialStatementId: string,
    translation: CurrencyTranslationResult,
    fiscalYear: number,
    consolidationEntryId?: string,
  ): Promise<any> {
    // Get cumulative from previous year
    const { data: previous } = await this.supabase
      .from('currency_translation_differences')
      .select('cumulative_difference')
      .eq('company_id', companyId)
      .eq('fiscal_year', fiscalYear - 1)
      .single();

    const previousCumulative = previous ? parseFloat(previous.cumulative_difference) : 0;
    const newCumulative = previousCumulative + translation.totalDifference;

    const { data, error } = await this.supabase
      .from('currency_translation_differences')
      .insert({
        company_id: companyId,
        financial_statement_id: financialStatementId,
        fiscal_year: fiscalYear,
        source_currency: translation.sourceCurrency,
        target_currency: translation.targetCurrency,
        spot_rate: translation.spotRate,
        average_rate: translation.averageRate,
        historical_rate: translation.spotRate, // Simplified
        balance_sheet_difference: translation.balanceSheetDifference,
        income_statement_difference: translation.incomeStatementDifference,
        equity_difference: 0, // Simplified
        total_difference: translation.totalDifference,
        cumulative_difference: newCumulative,
        consolidation_entry_id: consolidationEntryId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Fehler: ${error.message}`);
    }

    return data;
  }

  /**
   * Get translation differences for a company
   */
  async getTranslationDifferences(companyId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('currency_translation_differences')
      .select('*')
      .eq('company_id', companyId)
      .order('fiscal_year', { ascending: false });

    if (error) {
      throw new BadRequestException(`Fehler: ${error.message}`);
    }

    return data || [];
  }
}
