import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { FiscalYearAdjustmentService, CreateAdjustmentDto, UpdateAdjustmentDto } from './fiscal-year-adjustment.service';

@Controller('fiscal-year-adjustments')
export class FiscalYearAdjustmentController {
  constructor(private fiscalYearAdjustmentService: FiscalYearAdjustmentService) {}

  /**
   * Validate date difference
   */
  @Post('validate')
  async validateDateDifference(
    @Body('subsidiaryDate') subsidiaryDate: string,
    @Body('groupDate') groupDate: string,
  ) {
    const validation = await this.fiscalYearAdjustmentService.validateDateDifference(
      new Date(subsidiaryDate),
      new Date(groupDate),
    );
    return { success: true, validation };
  }

  /**
   * Get companies with different fiscal years
   */
  @Get('companies-with-differences')
  async getCompaniesWithDifferentFiscalYears(
    @Query('parentCompanyId') parentCompanyId: string,
    @Query('groupReportingDate') groupReportingDate: string,
  ) {
    const results = await this.fiscalYearAdjustmentService.getCompaniesWithDifferentFiscalYears(
      parentCompanyId,
      groupReportingDate,
    );
    return { success: true, results };
  }

  /**
   * Create adjustment
   */
  @Post()
  async create(@Body() dto: CreateAdjustmentDto, @Req() req: Request) {
    dto.createdByUserId = req.user?.id;
    const adjustment = await this.fiscalYearAdjustmentService.create(dto);
    return { success: true, adjustment };
  }

  /**
   * Get adjustments by company
   */
  @Get('company/:companyId')
  async getByCompany(@Param('companyId') companyId: string) {
    const adjustments = await this.fiscalYearAdjustmentService.getByCompany(companyId);
    return { success: true, adjustments };
  }

  /**
   * Get adjustments by financial statement
   */
  @Get('financial-statement/:financialStatementId')
  async getByFinancialStatement(@Param('financialStatementId') financialStatementId: string) {
    const adjustments = await this.fiscalYearAdjustmentService.getByFinancialStatement(financialStatementId);
    return { success: true, adjustments };
  }

  /**
   * Get adjustment by ID
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    const adjustment = await this.fiscalYearAdjustmentService.getById(id);
    return { success: true, adjustment };
  }

  /**
   * Update adjustment
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAdjustmentDto) {
    const adjustment = await this.fiscalYearAdjustmentService.update(id, dto);
    return { success: true, adjustment };
  }

  /**
   * Calculate pro-rata adjustments
   */
  @Post(':id/calculate-pro-rata')
  async calculateProRata(
    @Param('id') id: string,
    @Body('financialStatementId') financialStatementId: string,
  ) {
    const entries = await this.fiscalYearAdjustmentService.calculateProRataAdjustments(id, financialStatementId);
    return { success: true, entries };
  }

  /**
   * Approve adjustment
   */
  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: Request) {
    const adjustment = await this.fiscalYearAdjustmentService.approve(id, req.user?.id || 'system');
    return { success: true, adjustment };
  }

  /**
   * Delete adjustment
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.fiscalYearAdjustmentService.delete(id);
    return { success: true, message: 'Stichtagsverschiebung erfolgreich gelöscht' };
  }
}
