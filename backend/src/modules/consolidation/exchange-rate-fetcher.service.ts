import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Exchange Rate Fetcher Service
 * 
 * Fetches exchange rates from the ECB (European Central Bank) API
 * and stores them in the database for consolidation purposes.
 * 
 * ECB provides daily rates for major currencies against EUR.
 * For HGB § 308a compliance, we need:
 * - Spot rates (Stichtagskurs): Balance sheet date rate
 * - Average rates (Durchschnittskurs): Period average for income statement
 * - Historical rates (Historischer Kurs): Acquisition date rate for equity
 */

interface ECBRateData {
  currency: string;
  rate: number;
  date: string;
}

interface ExchangeRateConfig {
  // Currencies to fetch (against EUR)
  currencies: string[];
  // Auto-calculate average rates
  calculateAverages: boolean;
  // Store historical data
  keepHistory: boolean;
}

const DEFAULT_CONFIG: ExchangeRateConfig = {
  currencies: ['USD', 'GBP', 'CHF', 'PLN', 'CZK', 'SEK', 'DKK', 'NOK', 'HUF', 'RON', 'BGN', 'JPY', 'CNY'],
  calculateAverages: true,
  keepHistory: true,
};

@Injectable()
export class ExchangeRateFetcherService {
  private readonly logger = new Logger(ExchangeRateFetcherService.name);

  constructor(private supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  /**
   * Fetch latest rates from ECB API
   * ECB publishes rates daily around 16:00 CET
   */
  async fetchLatestRatesFromECB(): Promise<ECBRateData[]> {
    try {
      // ECB provides an XML feed, but there's also a JSON endpoint
      const response = await fetch(
        'https://api.frankfurter.app/latest?from=EUR'
      );
      
      if (!response.ok) {
        throw new Error(`ECB API error: ${response.status}`);
      }

      const data = await response.json();
      const rates: ECBRateData[] = [];

      for (const [currency, rate] of Object.entries(data.rates)) {
        rates.push({
          currency,
          rate: rate as number,
          date: data.date,
        });
      }

      this.logger.log(`Fetched ${rates.length} exchange rates from ECB for ${data.date}`);
      return rates;
    } catch (error) {
      this.logger.error('Failed to fetch rates from ECB:', error);
      throw error;
    }
  }

  /**
   * Fetch historical rates for a specific date
   */
  async fetchHistoricalRatesFromECB(date: string): Promise<ECBRateData[]> {
    try {
      const response = await fetch(
        `https://api.frankfurter.app/${date}?from=EUR`
      );
      
      if (!response.ok) {
        throw new Error(`ECB API error: ${response.status}`);
      }

      const data = await response.json();
      const rates: ECBRateData[] = [];

      for (const [currency, rate] of Object.entries(data.rates)) {
        rates.push({
          currency,
          rate: rate as number,
          date: data.date,
        });
      }

      return rates;
    } catch (error) {
      this.logger.error(`Failed to fetch rates for ${date}:`, error);
      throw error;
    }
  }

  /**
   * Fetch rates for a date range (for calculating averages)
   */
  async fetchRatesForPeriod(startDate: string, endDate: string): Promise<Map<string, ECBRateData[]>> {
    try {
      const response = await fetch(
        `https://api.frankfurter.app/${startDate}..${endDate}?from=EUR`
      );
      
      if (!response.ok) {
        throw new Error(`ECB API error: ${response.status}`);
      }

      const data = await response.json();
      const ratesByCurrency = new Map<string, ECBRateData[]>();

      for (const [date, rates] of Object.entries(data.rates)) {
        for (const [currency, rate] of Object.entries(rates as Record<string, number>)) {
          if (!ratesByCurrency.has(currency)) {
            ratesByCurrency.set(currency, []);
          }
          ratesByCurrency.get(currency)!.push({
            currency,
            rate,
            date,
          });
        }
      }

      return ratesByCurrency;
    } catch (error) {
      this.logger.error(`Failed to fetch rates for period ${startDate} to ${endDate}:`, error);
      throw error;
    }
  }

  /**
   * Store spot rate in database
   */
  async storeSpotRate(currency: string, rate: number, date: string, source: string = 'ecb'): Promise<void> {
    const { error } = await this.supabase
      .from('exchange_rates')
      .upsert({
        from_currency: currency,
        to_currency: 'EUR',
        rate_date: date,
        rate: 1 / rate, // ECB gives EUR to X, we want X to EUR
        rate_type: 'spot',
        rate_source: source,
        fiscal_year: new Date(date).getFullYear(),
        fiscal_month: new Date(date).getMonth() + 1,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'from_currency,to_currency,rate_date,rate_type',
      });

    if (error) {
      this.logger.error(`Failed to store spot rate for ${currency}:`, error);
    }
  }

  /**
   * Calculate and store average rate for a period
   */
  async calculateAndStoreAverageRate(
    currency: string,
    fiscalYear: number,
    fiscalMonth?: number,
  ): Promise<number | null> {
    let startDate: string;
    let endDate: string;

    if (fiscalMonth) {
      // Monthly average
      startDate = `${fiscalYear}-${String(fiscalMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(fiscalYear, fiscalMonth, 0).getDate();
      endDate = `${fiscalYear}-${String(fiscalMonth).padStart(2, '0')}-${lastDay}`;
    } else {
      // Yearly average
      startDate = `${fiscalYear}-01-01`;
      endDate = `${fiscalYear}-12-31`;
    }

    try {
      const ratesByPeriod = await this.fetchRatesForPeriod(startDate, endDate);
      const currencyRates = ratesByPeriod.get(currency);

      if (!currencyRates || currencyRates.length === 0) {
        this.logger.warn(`No rates found for ${currency} in period ${startDate} to ${endDate}`);
        return null;
      }

      // Calculate simple average
      const sum = currencyRates.reduce((acc, r) => acc + r.rate, 0);
      const averageRate = sum / currencyRates.length;

      // Store average rate
      const { error } = await this.supabase
        .from('exchange_rates')
        .upsert({
          from_currency: currency,
          to_currency: 'EUR',
          rate_date: endDate,
          rate: 1 / averageRate,
          rate_type: 'average',
          rate_source: 'ecb',
          fiscal_year: fiscalYear,
          fiscal_month: fiscalMonth || null,
          notes: `Average of ${currencyRates.length} daily rates from ${startDate} to ${endDate}`,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'from_currency,to_currency,rate_date,rate_type',
        });

      if (error) {
        this.logger.error(`Failed to store average rate for ${currency}:`, error);
        return null;
      }

      this.logger.log(`Stored ${fiscalMonth ? 'monthly' : 'yearly'} average rate for ${currency}: ${1/averageRate}`);
      return 1 / averageRate;
    } catch (error) {
      this.logger.error(`Failed to calculate average rate for ${currency}:`, error);
      return null;
    }
  }

  /**
   * Update all spot rates - call daily
   */
  async updateAllSpotRates(): Promise<{ success: number; failed: number }> {
    const rates = await this.fetchLatestRatesFromECB();
    let success = 0;
    let failed = 0;

    for (const rate of rates) {
      try {
        await this.storeSpotRate(rate.currency, rate.rate, rate.date);
        success++;
      } catch {
        failed++;
      }
    }

    this.logger.log(`Updated spot rates: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Calculate all average rates for a fiscal year
   */
  async calculateAllAverageRates(fiscalYear: number): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const currency of DEFAULT_CONFIG.currencies) {
      const result = await this.calculateAndStoreAverageRate(currency, fiscalYear);
      if (result !== null) {
        success++;
      } else {
        failed++;
      }
    }

    this.logger.log(`Calculated average rates for ${fiscalYear}: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Fetch and store balance sheet date rates (Stichtagskurs)
   * Call this at period close (monthly, quarterly, yearly)
   */
  async fetchBalanceSheetRates(date: string): Promise<{ success: number; failed: number }> {
    const rates = await this.fetchHistoricalRatesFromECB(date);
    let success = 0;
    let failed = 0;

    for (const rate of rates) {
      try {
        await this.storeSpotRate(rate.currency, rate.rate, rate.date);
        success++;
      } catch {
        failed++;
      }
    }

    this.logger.log(`Fetched balance sheet rates for ${date}: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Get rate schedule configuration
   */
  async getRateScheduleConfig(): Promise<any> {
    const { data } = await this.supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'exchange_rate_schedule')
      .single();

    return data?.value || {
      spotRateUpdate: 'daily',
      averageRateCalculation: 'monthly',
      balanceSheetRates: ['quarterly', 'yearly'],
      lastUpdate: null,
    };
  }

  /**
   * Save rate schedule configuration
   */
  async saveRateScheduleConfig(config: any): Promise<void> {
    await this.supabase
      .from('system_settings')
      .upsert({
        key: 'exchange_rate_schedule',
        value: config,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      });
  }

  // ===== SCHEDULED TASKS =====
  // Note: These require @nestjs/schedule to be installed and configured

  /**
   * Daily spot rate update (runs at 17:00 CET, after ECB publishes)
   */
  // @Cron('0 17 * * 1-5', { timeZone: 'Europe/Berlin' }) // Weekdays at 17:00 CET
  async scheduledDailySpotRateUpdate(): Promise<void> {
    this.logger.log('Running scheduled daily spot rate update...');
    await this.updateAllSpotRates();
  }

  /**
   * Monthly average rate calculation (runs on 1st of each month)
   */
  // @Cron('0 6 1 * *', { timeZone: 'Europe/Berlin' }) // 1st of month at 06:00
  async scheduledMonthlyAverageRateCalculation(): Promise<void> {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    this.logger.log(`Running scheduled monthly average rate calculation for ${year}-${lastMonth}...`);
    
    for (const currency of DEFAULT_CONFIG.currencies) {
      await this.calculateAndStoreAverageRate(currency, year, lastMonth);
    }
  }

  /**
   * Quarterly rate snapshot (runs on 1st of Jan, Apr, Jul, Oct)
   */
  // @Cron('0 6 1 1,4,7,10 *', { timeZone: 'Europe/Berlin' })
  async scheduledQuarterlyRateSnapshot(): Promise<void> {
    const now = new Date();
    const lastQuarterEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    const dateStr = lastQuarterEnd.toISOString().split('T')[0];

    this.logger.log(`Running scheduled quarterly rate snapshot for ${dateStr}...`);
    await this.fetchBalanceSheetRates(dateStr);
  }

  /**
   * Yearly average rate calculation (runs on Jan 5th)
   */
  // @Cron('0 6 5 1 *', { timeZone: 'Europe/Berlin' }) // Jan 5th at 06:00
  async scheduledYearlyAverageRateCalculation(): Promise<void> {
    const lastYear = new Date().getFullYear() - 1;
    
    this.logger.log(`Running scheduled yearly average rate calculation for ${lastYear}...`);
    await this.calculateAllAverageRates(lastYear);
  }
}
