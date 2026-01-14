import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ManagementReportService,
  CreateReportDto,
  UpdateSectionDto,
} from './management-report.service';

@Controller('management-reports')
export class ManagementReportController {
  constructor(private reportService: ManagementReportService) {}

  /**
   * Create a new report
   */
  @Post()
  async create(@Body() dto: CreateReportDto, @Req() req: Request) {
    dto.createdByUserId = req.user?.id;
    const report = await this.reportService.create(dto);
    return { success: true, report };
  }

  /**
   * Get all reports
   */
  @Get()
  async getAll() {
    const reports = await this.reportService.getAll();
    return { success: true, reports };
  }

  /**
   * Get report by ID
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    const report = await this.reportService.getById(id);
    return { success: true, report };
  }

  /**
   * Get report by financial statement
   */
  @Get('financial-statement/:financialStatementId')
  async getByFinancialStatement(@Param('financialStatementId') financialStatementId: string) {
    const report = await this.reportService.getByFinancialStatement(financialStatementId);
    return { success: true, report };
  }

  /**
   * Update a section
   */
  @Put(':id/sections')
  async updateSection(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @Req() req: Request,
  ) {
    dto.updatedByUserId = req.user?.id;
    const report = await this.reportService.updateSection(id, dto);
    return { success: true, report };
  }

  /**
   * Generate key figures
   */
  @Post(':id/generate-key-figures')
  async generateKeyFigures(
    @Param('id') id: string,
    @Body('financialStatementId') financialStatementId: string,
  ) {
    const keyFigures = await this.reportService.generateKeyFigures(id, financialStatementId);
    return { success: true, keyFigures };
  }

  /**
   * Generate content suggestions
   */
  @Post(':id/generate-suggestions')
  async generateSuggestions(@Param('id') id: string) {
    const suggestions = await this.reportService.generateContentSuggestions(id);
    return { success: true, suggestions };
  }

  /**
   * Submit for review
   */
  @Post(':id/submit-for-review')
  async submitForReview(@Param('id') id: string) {
    const report = await this.reportService.submitForReview(id);
    return { success: true, report };
  }

  /**
   * Approve report
   */
  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: Request) {
    const report = await this.reportService.approve(id, req.user?.id || 'system');
    return { success: true, report };
  }

  /**
   * Publish report
   */
  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    const report = await this.reportService.publish(id);
    return { success: true, report };
  }

  /**
   * Get versions
   */
  @Get(':id/versions')
  async getVersions(@Param('id') id: string) {
    const versions = await this.reportService.getVersions(id);
    return { success: true, versions };
  }

  /**
   * Export report
   */
  @Get(':id/export')
  async exportReport(@Param('id') id: string) {
    const exportData = await this.reportService.exportReport(id);
    return { success: true, data: exportData };
  }
}
