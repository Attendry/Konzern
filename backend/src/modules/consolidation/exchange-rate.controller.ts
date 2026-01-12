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
import { RateType } from '../../entities/exchange-rate.entity';

@Controller('exchange-rates')
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

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
    @Body() body: {
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
}
