import {
  Controller,
  Get,
  Query,
  Res,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuditService } from '../services/audit.service';
import { ExportService } from '../services/export.service';

@Controller('ai/audit')
export class AuditExportController {
  private readonly logger = new Logger(AuditExportController.name);

  constructor(
    private auditService: AuditService,
    private exportService: ExportService,
  ) {}

  /**
   * Export audit log as Excel or CSV
   */
  @Get('export')
  async exportAuditLog(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('decisionType') decisionType?: 'accept' | 'reject' | 'modify' | 'ignore',
    @Query('format') format: 'csv' | 'xlsx' = 'xlsx',
  ): Promise<void> {
    try {
      if (!startDate || !endDate) {
        throw new HttpException(
          'startDate and endDate are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const filter = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId,
        decisionType,
      };

      // Get data
      const [entries, statistics] = await Promise.all([
        this.auditService.getAuditLog(filter),
        this.auditService.calculateStatistics({
          startDate: filter.startDate,
          endDate: filter.endDate,
        }),
      ]);

      this.logger.log(`Exporting ${entries.length} audit entries as ${format}`);

      if (format === 'csv') {
        const csv = await this.exportService.generateAuditLogCSV(entries);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="ai_audit_log_${this.formatDate(filter.startDate)}_${this.formatDate(filter.endDate)}.csv"`,
        );
        res.send(csv);
      } else {
        const buffer = await this.exportService.generateAuditLogExcel(
          entries,
          statistics,
        );

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="ai_audit_log_${this.formatDate(filter.startDate)}_${this.formatDate(filter.endDate)}.xlsx"`,
        );
        res.send(buffer);
      }
    } catch (error: any) {
      this.logger.error(`Export failed: ${error.message}`);
      throw new HttpException(
        `Export failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Export override log as Excel
   */
  @Get('export/overrides')
  async exportOverrideLog(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!startDate || !endDate) {
        throw new HttpException(
          'startDate and endDate are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const overrides = await this.auditService.getOverrideLog({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      this.logger.log(`Exporting ${overrides.length} overrides`);

      const buffer = await this.exportService.generateOverrideLogExcel(overrides);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ai_override_log_${this.formatDate(new Date(startDate))}_${this.formatDate(new Date(endDate))}.xlsx"`,
      );
      res.send(buffer);
    } catch (error: any) {
      this.logger.error(`Override export failed: ${error.message}`);
      throw new HttpException(
        `Export failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get audit statistics for dashboard
   */
  @Get('dashboard/statistics')
  async getDashboardStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new HttpException(
        'startDate and endDate are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const statistics = await this.auditService.calculateStatistics({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    return {
      ...statistics,
      period: {
        startDate: statistics.period.startDate.toISOString(),
        endDate: statistics.period.endDate.toISOString(),
      },
    };
  }

  /**
   * Get daily trend data for charts
   */
  @Get('dashboard/trend')
  async getDailyTrend(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new HttpException(
        'startDate and endDate are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const entries = await this.auditService.getAuditLog({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    // Group by date
    const byDate: Record<string, {
      total: number;
      accept: number;
      reject: number;
      avgConfidence: number;
      confidenceSum: number;
    }> = {};

    for (const entry of entries) {
      const date = new Date(entry.requestTimestamp).toISOString().split('T')[0];
      
      if (!byDate[date]) {
        byDate[date] = { total: 0, accept: 0, reject: 0, avgConfidence: 0, confidenceSum: 0 };
      }

      byDate[date].total++;
      if (entry.userDecision === 'accept') byDate[date].accept++;
      if (entry.userDecision === 'reject') byDate[date].reject++;
      if (entry.aiConfidence) {
        byDate[date].confidenceSum += entry.aiConfidence;
      }
    }

    // Calculate averages
    const trend = Object.entries(byDate)
      .map(([date, data]) => ({
        date,
        total: data.total,
        accept: data.accept,
        reject: data.reject,
        acceptRate: data.total > 0 ? data.accept / data.total : 0,
        avgConfidence: data.total > 0 ? data.confidenceSum / data.total : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return trend;
  }

  /**
   * Get tool usage breakdown
   */
  @Get('dashboard/tools')
  async getToolUsage(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new HttpException(
        'startDate and endDate are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const entries = await this.auditService.getAuditLog({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    // Group by tool
    const byTool: Record<string, {
      count: number;
      acceptCount: number;
      avgConfidence: number;
      confidenceSum: number;
    }> = {};

    for (const entry of entries) {
      const tool = entry.toolName || 'chat';
      
      if (!byTool[tool]) {
        byTool[tool] = { count: 0, acceptCount: 0, avgConfidence: 0, confidenceSum: 0 };
      }

      byTool[tool].count++;
      if (entry.userDecision === 'accept') byTool[tool].acceptCount++;
      if (entry.aiConfidence) {
        byTool[tool].confidenceSum += entry.aiConfidence;
      }
    }

    // Calculate averages
    const tools = Object.entries(byTool)
      .map(([tool, data]) => ({
        tool,
        label: this.getToolLabel(tool),
        count: data.count,
        acceptRate: data.count > 0 ? data.acceptCount / data.count : 0,
        avgConfidence: data.count > 0 ? data.confidenceSum / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return tools;
  }

  /**
   * Format date for filename
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  /**
   * Get German label for tool
   */
  private getToolLabel(tool: string): string {
    const labels: Record<string, string> = {
      'analyze_ic_difference': 'IC-Differenz-Analyse',
      'generate_audit_documentation': 'Prüfpfad-Dokumentation',
      'explain_plausibility_check': 'Plausibilitätsprüfung',
      'chat': 'Chat',
    };
    return labels[tool] || tool;
  }
}
