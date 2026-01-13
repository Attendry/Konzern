import {
  Controller,
  Get,
  Post,
  Param,
} from '@nestjs/common';
import { ProportionalConsolidationService } from './proportional-consolidation.service';

@Controller('consolidation/proportional')
export class ProportionalConsolidationController {
  constructor(
    private readonly proportionalService: ProportionalConsolidationService,
  ) {}

  /**
   * Perform proportional consolidation for joint ventures
   */
  @Post('calculate/:financialStatementId/:parentCompanyId')
  async consolidateProportionally(
    @Param('financialStatementId') financialStatementId: string,
    @Param('parentCompanyId') parentCompanyId: string,
  ) {
    return this.proportionalService.consolidateProportionally(
      financialStatementId,
      parentCompanyId,
    );
  }

  /**
   * Get proportional consolidation disclosure for notes
   */
  @Get('disclosure/:financialStatementId/:parentCompanyId')
  async getProportionalDisclosure(
    @Param('financialStatementId') financialStatementId: string,
    @Param('parentCompanyId') parentCompanyId: string,
  ) {
    return this.proportionalService.getProportionalDisclosure(
      financialStatementId,
      parentCompanyId,
    );
  }
}
