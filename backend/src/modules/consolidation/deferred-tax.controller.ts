import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { DeferredTaxService } from './deferred-tax.service';
import {
  DeferredTaxSource,
  DeferredTaxStatus,
  TemporaryDifferenceType,
} from '../../entities/deferred-tax.entity';

class CreateDeferredTaxDto {
  financialStatementId: string;
  companyId: string;
  differenceType: TemporaryDifferenceType;
  source: DeferredTaxSource;
  description: string;
  temporaryDifferenceAmount: number;
  taxRate?: number;
  affectsEquity?: boolean;
  expectedReversalYear?: number;
  originatingEntryId?: string;
  hgbNote?: string;
}

class UpdateDeferredTaxDto {
  temporaryDifferenceAmount?: number;
  taxRate?: number;
  description?: string;
  expectedReversalYear?: number;
  status?: DeferredTaxStatus;
  hgbNote?: string;
}

@Controller('consolidation/deferred-taxes')
export class DeferredTaxController {
  constructor(private readonly deferredTaxService: DeferredTaxService) {}

  /**
   * Calculate deferred taxes for a financial statement
   */
  @Post('calculate/:financialStatementId')
  async calculateDeferredTaxes(
    @Param('financialStatementId') financialStatementId: string,
    @Query('taxRate') taxRate?: string,
  ) {
    const rate = taxRate ? parseFloat(taxRate) : undefined;
    return this.deferredTaxService.calculateDeferredTaxes(
      financialStatementId,
      rate,
    );
  }

  /**
   * Get all deferred taxes for a financial statement
   */
  @Get(':financialStatementId')
  async getDeferredTaxes(
    @Param('financialStatementId') financialStatementId: string,
  ) {
    return this.deferredTaxService.getDeferredTaxes(financialStatementId);
  }

  /**
   * Get deferred tax summary
   */
  @Get('summary/:financialStatementId')
  async getDeferredTaxSummary(
    @Param('financialStatementId') financialStatementId: string,
  ) {
    return this.deferredTaxService.getDeferredTaxSummary(financialStatementId);
  }

  /**
   * Create a manual deferred tax entry
   */
  @Post()
  async createDeferredTax(@Body() dto: CreateDeferredTaxDto) {
    return this.deferredTaxService.createDeferredTax(dto);
  }

  /**
   * Update a deferred tax entry
   */
  @Put(':id')
  async updateDeferredTax(
    @Param('id') id: string,
    @Body() dto: UpdateDeferredTaxDto,
  ) {
    return this.deferredTaxService.updateDeferredTax(id, dto);
  }

  /**
   * Delete a deferred tax entry
   */
  @Delete(':id')
  async deleteDeferredTax(@Param('id') id: string) {
    await this.deferredTaxService.deleteDeferredTax(id);
    return { message: 'Latente Steuer erfolgreich gelöscht' };
  }
}
