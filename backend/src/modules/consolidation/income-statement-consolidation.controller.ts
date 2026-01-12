import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IncomeStatementConsolidationService } from './income-statement-consolidation.service';
import { ConsolidatedIncomeStatement } from './income-statement-consolidation.service';

@Controller('consolidation/income-statement')
export class IncomeStatementConsolidationController {
  constructor(
    private readonly incomeStatementConsolidationService: IncomeStatementConsolidationService,
  ) {}

  /**
   * Führt GuV-Konsolidierung durch
   * POST /api/consolidation/income-statement/:financialStatementId
   */
  @Post(':financialStatementId')
  async consolidateIncomeStatement(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<ConsolidatedIncomeStatement> {
    return this.incomeStatementConsolidationService.consolidateIncomeStatement(
      financialStatementId,
    );
  }

  /**
   * Ruft konsolidierte GuV ab
   * GET /api/consolidation/income-statement/:financialStatementId
   */
  @Get(':financialStatementId')
  async getConsolidatedIncomeStatement(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<ConsolidatedIncomeStatement> {
    return this.incomeStatementConsolidationService.consolidateIncomeStatement(
      financialStatementId,
    );
  }

  /**
   * Validiert konsolidierte GuV
   * GET /api/consolidation/income-statement/:financialStatementId/validate
   */
  @Get(':financialStatementId/validate')
  async validateConsolidatedIncomeStatement(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.incomeStatementConsolidationService.validateConsolidatedIncomeStatement(
      financialStatementId,
    );
  }
}
