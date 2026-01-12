import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { 
  FirstConsolidationService, 
  FirstConsolidationInput,
  DeconsolidationInput,
} from './first-consolidation.service';

@Controller('consolidation/first')
export class FirstConsolidationController {
  constructor(
    private readonly firstConsolidationService: FirstConsolidationService,
  ) {}

  /**
   * Perform first consolidation (Erstkonsolidierung)
   * POST /api/consolidation/first/perform
   */
  @Post('perform')
  async performFirstConsolidation(@Body() input: FirstConsolidationInput) {
    return this.firstConsolidationService.performFirstConsolidation(input);
  }

  /**
   * Perform deconsolidation (Entkonsolidierung)
   * POST /api/consolidation/first/deconsolidate
   */
  @Post('deconsolidate')
  async performDeconsolidation(@Body() input: DeconsolidationInput) {
    return this.firstConsolidationService.performDeconsolidation(input);
  }

  /**
   * Calculate minority interests for a company
   * GET /api/consolidation/first/minority/:financialStatementId/:companyId
   */
  @Get('minority/:financialStatementId/:companyId')
  async calculateMinorityInterests(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.firstConsolidationService.calculateMinorityInterests(
      financialStatementId,
      companyId,
    );
  }

  /**
   * Get first consolidation summary for a subsidiary
   * GET /api/consolidation/first/summary/:subsidiaryCompanyId
   */
  @Get('summary/:subsidiaryCompanyId')
  async getFirstConsolidationSummary(
    @Param('subsidiaryCompanyId', ParseUUIDPipe) subsidiaryCompanyId: string,
  ) {
    return this.firstConsolidationService.getFirstConsolidationSummary(subsidiaryCompanyId);
  }
}
