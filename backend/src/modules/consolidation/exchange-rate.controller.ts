import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ExchangeRateService, ExchangeRateDto } from './exchange-rate.service';
import { ExchangeRateFetcherService } from './exchange-rate-fetcher.service';
import { RateType } from '../../entities/exchange-rate.entity';

@Controller('exchange-rates')
export class ExchangeRateController {
  constructor(
    private readonly exchangeRateService: ExchangeRateService,
    private readonly exchangeRateFetcherService: ExchangeRateFetcherService,
  ) {}

  /**
   * Get all exchange rates with optional filters
   * GET /api/exchange-rates
   */
  @Get()
  async getExchangeRates(
    @Query('fromCurrency') fromCurrency?: string,
    @Query('toCurrency') toCurrency?: string,
    @Query('rateType') rateType?: RateType,
    @Query('fiscalYear') fiscalYear?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.exchangeRateService.getExchangeRates({
      fromCurrency,
      toCurrency,
      rateType,
      fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined,
      startDate,
      endDate,
    });
  }

  /**
   * Get available currencies
   * GET /api/exchange-rates/currencies
   */
  @Get('currencies')
  async getAvailableCurrencies() {
    return this.exchangeRateService.getAvailableCurrencies();
  }

  /**
   * Get specific rate
   * GET /api/exchange-rates/rate?from=USD&to=EUR&date=2026-01-01&type=spot
   */
  @Get('rate')
  async getRate(
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string,
    @Query('date') rateDate: string,
    @Query('type') rateType: RateType = RateType.SPOT,
  ) {
    const rate = await this.exchangeRateService.getRate(
      fromCurrency,
      toCurrency,
      rateDate,
      rateType,
    );
    return { fromCurrency, toCurrency, rateDate, rateType, rate };
  }

  /**
   * Create or update exchange rate
   * POST /api/exchange-rates
   */
  @Post()
  async upsertRate(@Body() dto: ExchangeRateDto) {
    return this.exchangeRateService.upsertRate(dto);
  }

  /**
   * Bulk import rates
   * POST /api/exchange-rates/bulk
   */
  @Post('bulk')
  async bulkImportRates(@Body() rates: ExchangeRateDto[]) {
    return this.exchangeRateService.bulkImportRates(rates);
  }

  /**
   * Delete exchange rate
   * DELETE /api/exchange-rates/:id
   */
  @Delete(':id')
  async deleteRate(@Param('id', ParseUUIDPipe) id: string) {
    await this.exchangeRateService.deleteRate(id);
    return { message: 'Wechselkurs gelöscht' };
  }

  /**
   * Calculate translation for a company
   * POST /api/exchange-rates/calculate-translation
   */
  @Post('calculate-translation')
  async calculateTranslation(
    @Body()
    body: {
      companyId: string;
      financialStatementId: string;
      sourceCurrency: string;
      targetCurrency: string;
      rateDate: string;
      fiscalYear: number;
    },
  ) {
    return this.exchangeRateService.calculateTranslation(
      body.companyId,
      body.financialStatementId,
      body.sourceCurrency,
      body.targetCurrency,
      body.rateDate,
      body.fiscalYear,
    );
  }

  /**
   * Get translation differences for a company
   * GET /api/exchange-rates/translation-differences/:companyId
   */
  @Get('translation-differences/:companyId')
  async getTranslationDifferences(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.exchangeRateService.getTranslationDifferences(companyId);
  }

  // ===== ECB RATE FETCHING ENDPOINTS =====

  /**
   * Fetch latest spot rates from ECB
   * POST /api/exchange-rates/fetch/latest
   */
  @Post('fetch/latest')
  async fetchLatestRates() {
    const result = await this.exchangeRateFetcherService.updateAllSpotRates();
    return {
      message: `Spot-Kurse aktualisiert: ${result.success} erfolgreich, ${result.failed} fehlgeschlagen`,
      ...result,
    };
  }

  /**
   * Fetch rates for a specific date (balance sheet date)
   * POST /api/exchange-rates/fetch/date
   */
  @Post('fetch/date')
  async fetchRatesForDate(@Body('date') date: string) {
    const result =
      await this.exchangeRateFetcherService.fetchBalanceSheetRates(date);
    return {
      message: `Stichtagskurse für ${date} abgerufen: ${result.success} erfolgreich, ${result.failed} fehlgeschlagen`,
      date,
      ...result,
    };
  }

  /**
   * Calculate average rates for a fiscal year
   * POST /api/exchange-rates/calculate/average
   */
  @Post('calculate/average')
  async calculateAverageRates(
    @Body('fiscalYear') fiscalYear: number,
    @Body('fiscalMonth') fiscalMonth?: number,
  ) {
    if (fiscalMonth) {
      // Calculate for specific month
      const currencies = [
        'USD',
        'GBP',
        'CHF',
        'PLN',
        'CZK',
        'SEK',
        'DKK',
        'NOK',
        'HUF',
        'JPY',
        'CNY',
      ];
      let success = 0;
      let failed = 0;

      for (const currency of currencies) {
        const result =
          await this.exchangeRateFetcherService.calculateAndStoreAverageRate(
            currency,
            fiscalYear,
            fiscalMonth,
          );
        if (result !== null) success++;
        else failed++;
      }

      return {
        message: `Monatliche Durchschnittskurse für ${fiscalMonth}/${fiscalYear} berechnet`,
        fiscalYear,
        fiscalMonth,
        success,
        failed,
      };
    }

    // Calculate for entire year
    const result =
      await this.exchangeRateFetcherService.calculateAllAverageRates(
        fiscalYear,
      );
    return {
      message: `Jährliche Durchschnittskurse für ${fiscalYear} berechnet`,
      fiscalYear,
      ...result,
    };
  }

  /**
   * Get rate update schedule configuration
   * GET /api/exchange-rates/schedule
   */
  @Get('schedule')
  async getRateSchedule() {
    return this.exchangeRateFetcherService.getRateScheduleConfig();
  }

  /**
   * Update rate schedule configuration
   * POST /api/exchange-rates/schedule
   */
  @Post('schedule')
  async updateRateSchedule(@Body() config: any) {
    await this.exchangeRateFetcherService.saveRateScheduleConfig(config);
    return { message: 'Zeitplan gespeichert', config };
  }

  /**
   * Get rate summary/status
   * GET /api/exchange-rates/status
   */
  @Get('status')
  async getRateStatus() {
    const { data: latestRates } = await this.exchangeRateService['supabase']
      .from('exchange_rates')
      .select('from_currency, rate_date, rate_type, rate_source')
      .order('rate_date', { ascending: false })
      .limit(10);

    const { data: currencyCount } = await this.exchangeRateService['supabase']
      .from('exchange_rates')
      .select('from_currency')
      .limit(1000);

    const uniqueCurrencies = new Set(
      (currencyCount || []).map((r) => r.from_currency),
    );

    return {
      currencies: Array.from(uniqueCurrencies),
      currencyCount: uniqueCurrencies.size,
      latestRates: latestRates || [],
      lastUpdate: latestRates?.[0]?.rate_date || null,
    };
  }
}
