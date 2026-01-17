import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Res,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { ConsolidationService } from './consolidation.service';
import { IntercompanyTransactionService } from './intercompany-transaction.service';
import { DebtConsolidationService } from './debt-consolidation.service';
import { CapitalConsolidationService } from './capital-consolidation.service';
import { ConsolidatedBalanceSheetService } from './consolidated-balance-sheet.service';
import { ConsolidationValidationService } from './consolidation-validation.service';
import { ReportingService } from './reporting.service';
import { ExportService } from './export.service';
import { ParticipationService } from '../company/participation.service';
import {
  CreateConsolidationEntryDto,
  UpdateConsolidationEntryDto,
  ApproveEntryDto,
  RejectEntryDto,
} from './dto/create-consolidation-entry.dto';
import {
  AdjustmentType,
  EntryStatus,
  EntrySource,
} from '../../entities/consolidation-entry.entity';

@Controller('consolidation')
export class ConsolidationController {
  constructor(
    private readonly consolidationService: ConsolidationService,
    private readonly intercompanyService: IntercompanyTransactionService,
    private readonly debtConsolidationService: DebtConsolidationService,
    private readonly capitalConsolidationService: CapitalConsolidationService,
    private readonly consolidatedBalanceSheetService: ConsolidatedBalanceSheetService,
    private readonly consolidationValidationService: ConsolidationValidationService,
    private readonly reportingService: ReportingService,
    private readonly exportService: ExportService,
    private readonly participationService: ParticipationService,
  ) {}

  @Post('calculate/:financialStatementId')
  async calculate(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.consolidationService.calculateConsolidation(
      financialStatementId,
    );
  }

  @Get('entries/:financialStatementId')
  async getEntries(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Query('adjustmentType') adjustmentType?: AdjustmentType,
    @Query('status') status?: EntryStatus,
    @Query('source') source?: EntrySource,
  ) {
    return this.consolidationService.getConsolidationEntries(
      financialStatementId,
      {
        adjustmentType,
        status,
        source,
      },
    );
  }

  @Post('entries')
  async createEntry(@Body() createDto: CreateConsolidationEntryDto) {
    return this.consolidationService.createConsolidationEntry(createDto);
  }

  @Put('entries/:entryId')
  async updateEntry(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() updateDto: UpdateConsolidationEntryDto,
  ) {
    return this.consolidationService.updateConsolidationEntry(
      entryId,
      updateDto,
    );
  }

  @Delete('entries/:entryId')
  async deleteEntry(@Param('entryId', ParseUUIDPipe) entryId: string) {
    await this.consolidationService.deleteConsolidationEntry(entryId);
    return { message: 'Buchung erfolgreich gelöscht' };
  }

  // Entry Workflow Endpoints
  @Post('entries/:entryId/submit')
  async submitEntry(@Param('entryId', ParseUUIDPipe) entryId: string) {
    return this.consolidationService.submitForApproval(entryId);
  }

  @Post('entries/:entryId/approve')
  async approveEntry(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() approveDto: ApproveEntryDto,
  ) {
    return this.consolidationService.approveEntry(
      entryId,
      approveDto.approvedByUserId,
    );
  }

  @Post('entries/:entryId/reject')
  async rejectEntry(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() rejectDto: RejectEntryDto,
  ) {
    return this.consolidationService.rejectEntry(
      entryId,
      rejectDto.rejectedByUserId,
      rejectDto.reason,
    );
  }

  @Post('entries/:entryId/reverse')
  async reverseEntry(
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() body: { reversedByUserId: string; reason: string },
  ) {
    return this.consolidationService.reverseEntry(
      entryId,
      body.reversedByUserId,
      body.reason,
    );
  }

  @Get('entries/:financialStatementId/manual')
  async getManualEntries(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.consolidationService.getManualEntries(financialStatementId);
  }

  @Get('entries/:financialStatementId/pending')
  async getPendingEntries(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.consolidationService.getPendingEntries(financialStatementId);
  }

  // Intercompany Transaction Endpoints
  @Get('intercompany/detect/:financialStatementId')
  async detectIntercompanyTransactions(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.intercompanyService.detectIntercompanyTransactions(
      financialStatementId,
    );
  }

  @Post('intercompany/match')
  async matchTransactions(@Body() transactions: any[]) {
    return this.intercompanyService.matchReceivablesAndPayables(transactions);
  }

  // IC Reconciliation Endpoints
  @Get('intercompany/reconciliation/:financialStatementId')
  async getICReconciliations(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.intercompanyService.getICReconciliations(financialStatementId);
  }

  @Get('intercompany/reconciliation/:financialStatementId/summary')
  async getICReconciliationSummary(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.intercompanyService.getICReconciliationSummary(
      financialStatementId,
    );
  }

  @Post('intercompany/reconciliation/:financialStatementId/create')
  async createICReconciliations(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.intercompanyService.createICReconciliationsFromMatching(
      financialStatementId,
    );
  }

  @Put('intercompany/reconciliation/:reconciliationId')
  async updateICReconciliation(
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Body()
    updateData: {
      status?: string;
      differenceReason?: string;
      explanation?: string;
      resolvedByUserId?: string;
    },
  ) {
    return this.intercompanyService.updateICReconciliation(
      reconciliationId,
      updateData,
    );
  }

  @Post('intercompany/reconciliation/:reconciliationId/clear')
  async generateClearingEntry(
    @Param('reconciliationId', ParseUUIDPipe) reconciliationId: string,
    @Body() body: { userId: string },
  ) {
    return this.intercompanyService.generateClearingEntry(
      reconciliationId,
      body.userId,
    );
  }

  // Debt Consolidation Endpoints
  @Post('debt/:financialStatementId')
  async consolidateDebts(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body() companyIds: string[],
  ) {
    return this.debtConsolidationService.consolidateDebts(
      financialStatementId,
      companyIds,
    );
  }

  // Capital Consolidation Endpoints
  @Post('capital/:financialStatementId')
  async consolidateCapital(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body() parentCompanyId: string,
  ) {
    return this.capitalConsolidationService.consolidateCapital(
      financialStatementId,
      parentCompanyId,
    );
  }

  // Participation Endpoints
  @Post('participations')
  async createOrUpdateParticipation(@Body() participation: any) {
    return this.participationService.createOrUpdate(participation);
  }

  @Get('participations/parent/:parentCompanyId')
  async getParticipationsByParent(
    @Param('parentCompanyId', ParseUUIDPipe) parentCompanyId: string,
  ) {
    return this.participationService.getByParentCompany(parentCompanyId);
  }

  @Get('participations/subsidiary/:subsidiaryCompanyId')
  async getParticipationsBySubsidiary(
    @Param('subsidiaryCompanyId', ParseUUIDPipe) subsidiaryCompanyId: string,
  ) {
    return this.participationService.getBySubsidiaryCompany(
      subsidiaryCompanyId,
    );
  }

  @Get('participations/:participationId/book-value/:financialStatementId')
  async getBookValue(
    @Param('participationId', ParseUUIDPipe) participationId: string,
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.participationService.calculateBookValue(
      participationId,
      financialStatementId,
    );
  }

  // Consolidated Balance Sheet Endpoints
  @Get('balance-sheet/:financialStatementId')
  async getConsolidatedBalanceSheet(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.consolidatedBalanceSheetService.createConsolidatedBalanceSheet(
      financialStatementId,
    );
  }

  @Get('balance-sheet/:financialStatementId/validate')
  async validateBalanceEquality(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.consolidatedBalanceSheetService.validateBalanceEquality(
      financialStatementId,
    );
  }

  // Validation Endpoints
  @Get('validate/:financialStatementId')
  async validateConsolidation(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ) {
    return this.consolidationValidationService.validateConsolidation(
      financialStatementId,
    );
  }

  // Reporting Endpoints
  @Get('report/:financialStatementId')
  async getConsolidationReport(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Query('includeComparison') includeComparison?: string,
  ) {
    return this.reportingService.generateConsolidationReport(
      financialStatementId,
      includeComparison === 'true',
    );
  }

  @Get('report/:financialStatementId/position/:accountId')
  async getPositionDetails(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
  ) {
    return this.reportingService.getPositionDetails(
      financialStatementId,
      accountId,
    );
  }

  // Export Endpoints
  @Get('export/excel/:financialStatementId')
  async exportToExcel(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Res() res: Response,
  ) {
    const excelBuffer =
      await this.exportService.exportToExcel(financialStatementId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=konsolidierte-bilanz-${financialStatementId}.xlsx`,
    );
    res.send(excelBuffer);
  }

  @Get('export/xml/:financialStatementId')
  async exportToXml(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Res() res: Response,
  ) {
    const xml = await this.exportService.exportToXml(financialStatementId);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=konsolidierte-bilanz-${financialStatementId}.xml`,
    );
    res.send(xml);
  }

  @Get('export/pdf/:financialStatementId')
  async exportToPdf(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer =
      await this.exportService.exportToPdf(financialStatementId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=konsolidierte-bilanz-${financialStatementId}.pdf`,
    );
    res.send(pdfBuffer);
  }
}
