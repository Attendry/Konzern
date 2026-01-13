import {
  Controller,
  Get,
  Post,
  Param,
} from '@nestjs/common';
import { EquityMethodService } from './equity-method.service';

@Controller('api/consolidation/equity-method')
export class EquityMethodController {
  constructor(private readonly equityMethodService: EquityMethodService) {}

  /**
   * Calculate at-equity valuation for all equity-method investments
   */
  @Post('calculate/:financialStatementId/:parentCompanyId')
  async calculateEquityMethod(
    @Param('financialStatementId') financialStatementId: string,
    @Param('parentCompanyId') parentCompanyId: string,
  ) {
    return this.equityMethodService.calculateEquityMethod(
      financialStatementId,
      parentCompanyId,
    );
  }

  /**
   * Get equity method disclosure for notes
   */
  @Get('disclosure/:financialStatementId/:parentCompanyId')
  async getEquityMethodDisclosure(
    @Param('financialStatementId') financialStatementId: string,
    @Param('parentCompanyId') parentCompanyId: string,
  ) {
    return this.equityMethodService.getEquityMethodDisclosure(
      financialStatementId,
      parentCompanyId,
    );
  }
}
