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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlausibilityService, PlausibilityCheckRun, PlausibilityCheckSummary } from './plausibility.service';
import { VarianceAnalysisService, MaterialityThresholds, VarianceSummary, AnalysisLevel } from './variance-analysis.service';
import { ExceptionReportingService, ExceptionSummary, CreateExceptionDto } from './exception-reporting.service';
import { PlausibilityRule, PlausibilityRuleCategory } from '../../entities/plausibility-rule.entity';
import { PlausibilityCheck, PlausibilityCheckStatus } from '../../entities/plausibility-check.entity';
import { VarianceAnalysis, VarianceExplanationCategory } from '../../entities/variance-analysis.entity';
import { ExceptionReport, ExceptionStatus, ExceptionPriority, ExceptionResolutionType } from '../../entities/exception-report.entity';

// ==================== DTOs ====================

class CreateRuleDto {
  code: string;
  name: string;
  description?: string;
  category: PlausibilityRuleCategory;
  severity?: string;
  hgbReference?: string;
  hgbDescription?: string;
  ruleType: string;
  ruleExpression: string;
  thresholdAbsolute?: number;
  thresholdPercentage?: number;
  toleranceAmount?: number;
  appliesToEntityTypes?: string[];
  appliesToConsolidationTypes?: string[];
  appliesToStatementTypes?: string[];
  isMandatory?: boolean;
  isHgbRequired?: boolean;
  executionOrder?: number;
}

class UpdateRuleDto {
  name?: string;
  description?: string;
  severity?: string;
  hgbReference?: string;
  hgbDescription?: string;
  ruleExpression?: string;
  thresholdAbsolute?: number;
  thresholdPercentage?: number;
  toleranceAmount?: number;
  appliesToEntityTypes?: string[];
  appliesToConsolidationTypes?: string[];
  appliesToStatementTypes?: string[];
  isActive?: boolean;
  isMandatory?: boolean;
  isHgbRequired?: boolean;
  executionOrder?: number;
}

class RunChecksDto {
  userId?: string;
  categories?: PlausibilityRuleCategory[];
}

class AcknowledgeCheckDto {
  userId: string;
  comment: string;
}

class WaiveCheckDto {
  userId: string;
  reason: string;
}

class SetMaterialityDto {
  basisType: string;
  basisAmount: number;
  planningMateriality: number;
  performanceMateriality: number;
  trivialThreshold: number;
  planningPercentage: number;
  performancePercentage: number;
  trivialPercentage: number;
  qualitativeFactors?: Record<string, unknown>;
  notes?: string;
}

class RunVarianceAnalysisDto {
  priorFinancialStatementId: string;
  level?: AnalysisLevel;
  userId?: string;
}

class ExplainVarianceDto {
  explanation: string;
  category: VarianceExplanationCategory;
  userId: string;
}

class ReviewVarianceDto {
  userId: string;
  comment?: string;
}

class AssignExceptionDto {
  assignToUserId: string;
  assignByUserId: string;
}

class EscalateExceptionDto {
  escalateToUserId: string;
  reason: string;
  userId: string;
}

class ResolveExceptionDto {
  resolution: string;
  resolutionType: ExceptionResolutionType;
  userId: string;
}

class WaiveExceptionDto {
  reason: string;
  userId: string;
}

class UpdatePriorityDto {
  priority: ExceptionPriority;
  userId: string;
}

class ReopenExceptionDto {
  reason: string;
  userId: string;
}

// ==================== CONTROLLER ====================

@Controller('controls')
export class ControlsController {
  constructor(
    private readonly plausibilityService: PlausibilityService,
    private readonly varianceAnalysisService: VarianceAnalysisService,
    private readonly exceptionReportingService: ExceptionReportingService,
  ) {}

  // ==================== PLAUSIBILITY RULES ====================

  /**
   * Get all active plausibility rules
   */
  @Get('rules')
  async getRules(
    @Query('category') category?: PlausibilityRuleCategory,
  ): Promise<PlausibilityRule[]> {
    return this.plausibilityService.getActiveRules(category);
  }

  /**
   * Get a single rule by ID
   */
  @Get('rules/:ruleId')
  async getRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<PlausibilityRule | null> {
    return this.plausibilityService.getRule(ruleId);
  }

  /**
   * Create a new plausibility rule
   */
  @Post('rules')
  async createRule(@Body() dto: CreateRuleDto): Promise<PlausibilityRule> {
    return this.plausibilityService.createRule(dto as any);
  }

  /**
   * Update a plausibility rule
   */
  @Put('rules/:ruleId')
  async updateRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateRuleDto,
  ): Promise<PlausibilityRule> {
    return this.plausibilityService.updateRule(ruleId, dto as any);
  }

  /**
   * Delete a plausibility rule
   */
  @Delete('rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<void> {
    return this.plausibilityService.deleteRule(ruleId);
  }

  // ==================== PLAUSIBILITY CHECKS ====================

  /**
   * Run all plausibility checks for a financial statement
   */
  @Post(':financialStatementId/checks/run')
  async runChecks(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body() dto: RunChecksDto,
  ): Promise<PlausibilityCheckRun> {
    return this.plausibilityService.runAllChecks(
      financialStatementId,
      dto.userId,
      dto.categories,
    );
  }

  /**
   * Get check results for a financial statement
   */
  @Get(':financialStatementId/checks')
  async getCheckResults(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Query('status') status?: PlausibilityCheckStatus,
  ): Promise<PlausibilityCheck[]> {
    return this.plausibilityService.getCheckResults(financialStatementId, status);
  }

  /**
   * Get check summary for a financial statement
   */
  @Get(':financialStatementId/checks/summary')
  async getCheckSummary(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<PlausibilityCheckSummary> {
    return this.plausibilityService.getCheckSummary(financialStatementId);
  }

  /**
   * Get check runs for a financial statement
   */
  @Get(':financialStatementId/checks/runs')
  async getCheckRuns(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<PlausibilityCheckRun[]> {
    return this.plausibilityService.getCheckRuns(financialStatementId);
  }

  /**
   * Acknowledge a check result
   */
  @Post('checks/:checkId/acknowledge')
  async acknowledgeCheck(
    @Param('checkId', ParseUUIDPipe) checkId: string,
    @Body() dto: AcknowledgeCheckDto,
  ): Promise<PlausibilityCheck> {
    return this.plausibilityService.acknowledgeCheck(checkId, dto.userId, dto.comment);
  }

  /**
   * Waive a check result
   */
  @Post('checks/:checkId/waive')
  async waiveCheck(
    @Param('checkId', ParseUUIDPipe) checkId: string,
    @Body() dto: WaiveCheckDto,
  ): Promise<PlausibilityCheck> {
    return this.plausibilityService.waiveCheck(checkId, dto.userId, dto.reason);
  }

  // ==================== MATERIALITY THRESHOLDS ====================

  /**
   * Get materiality thresholds for a financial statement
   */
  @Get(':financialStatementId/materiality')
  async getMaterialityThresholds(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<MaterialityThresholds | null> {
    return this.varianceAnalysisService.getMaterialityThresholds(financialStatementId);
  }

  /**
   * Calculate suggested materiality
   */
  @Get(':financialStatementId/materiality/suggested')
  async calculateSuggestedMateriality(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<{
    basisType: string;
    basisAmount: number;
    suggestedPlanning: number;
    suggestedPerformance: number;
    suggestedTrivial: number;
  }> {
    return this.varianceAnalysisService.calculateSuggestedMateriality(financialStatementId);
  }

  /**
   * Set materiality thresholds
   */
  @Post(':financialStatementId/materiality')
  async setMaterialityThresholds(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body() dto: SetMaterialityDto,
  ): Promise<MaterialityThresholds> {
    return this.varianceAnalysisService.setMaterialityThresholds(financialStatementId, dto);
  }

  /**
   * Approve materiality thresholds
   */
  @Post(':financialStatementId/materiality/approve')
  async approveMaterialityThresholds(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body('userId') userId: string,
  ): Promise<MaterialityThresholds> {
    return this.varianceAnalysisService.approveMaterialityThresholds(financialStatementId, userId);
  }

  // ==================== VARIANCE ANALYSIS ====================

  /**
   * Run variance analysis
   */
  @Post(':financialStatementId/variances/run')
  async runVarianceAnalysis(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body() dto: RunVarianceAnalysisDto,
  ): Promise<VarianceAnalysis[]> {
    return this.varianceAnalysisService.runVarianceAnalysis(
      financialStatementId,
      dto.priorFinancialStatementId,
      dto.level || AnalysisLevel.ACCOUNT,
      dto.userId,
    );
  }

  /**
   * Get variance analyses
   */
  @Get(':financialStatementId/variances')
  async getVarianceAnalyses(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Query('materialOnly') materialOnly?: string,
    @Query('unexplainedOnly') unexplainedOnly?: string,
  ): Promise<VarianceAnalysis[]> {
    return this.varianceAnalysisService.getVarianceAnalyses(
      financialStatementId,
      materialOnly === 'true',
      unexplainedOnly === 'true',
    );
  }

  /**
   * Get variance summary
   */
  @Get(':financialStatementId/variances/summary')
  async getVarianceSummary(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<VarianceSummary> {
    return this.varianceAnalysisService.getVarianceSummary(financialStatementId);
  }

  /**
   * Explain a variance
   */
  @Post('variances/:varianceId/explain')
  async explainVariance(
    @Param('varianceId', ParseUUIDPipe) varianceId: string,
    @Body() dto: ExplainVarianceDto,
  ): Promise<VarianceAnalysis> {
    return this.varianceAnalysisService.explainVariance(
      varianceId,
      dto.explanation,
      dto.category,
      dto.userId,
    );
  }

  /**
   * Review a variance
   */
  @Post('variances/:varianceId/review')
  async reviewVariance(
    @Param('varianceId', ParseUUIDPipe) varianceId: string,
    @Body() dto: ReviewVarianceDto,
  ): Promise<VarianceAnalysis> {
    return this.varianceAnalysisService.reviewVariance(varianceId, dto.userId, dto.comment);
  }

  // ==================== EXCEPTION REPORTS ====================

  /**
   * Get exceptions for a financial statement
   */
  @Get(':financialStatementId/exceptions')
  async getExceptions(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Query('status') status?: ExceptionStatus,
    @Query('priority') priority?: ExceptionPriority,
  ): Promise<ExceptionReport[]> {
    return this.exceptionReportingService.getExceptions(financialStatementId, status, priority);
  }

  /**
   * Get open exceptions
   */
  @Get(':financialStatementId/exceptions/open')
  async getOpenExceptions(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<ExceptionReport[]> {
    return this.exceptionReportingService.getOpenExceptions(financialStatementId);
  }

  /**
   * Get exception summary
   */
  @Get(':financialStatementId/exceptions/summary')
  async getExceptionSummary(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<ExceptionSummary> {
    return this.exceptionReportingService.getExceptionSummary(financialStatementId);
  }

  /**
   * Create a new exception
   */
  @Post(':financialStatementId/exceptions')
  async createException(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body() dto: Omit<CreateExceptionDto, 'financialStatementId'>,
  ): Promise<ExceptionReport> {
    return this.exceptionReportingService.createException({
      ...dto,
      financialStatementId,
    } as CreateExceptionDto);
  }

  /**
   * Get a single exception
   */
  @Get('exceptions/:exceptionId')
  async getException(
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ): Promise<ExceptionReport | null> {
    return this.exceptionReportingService.getException(exceptionId);
  }

  /**
   * Assign an exception
   */
  @Post('exceptions/:exceptionId/assign')
  async assignException(
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body() dto: AssignExceptionDto,
  ): Promise<ExceptionReport> {
    return this.exceptionReportingService.assignException(
      exceptionId,
      dto.assignToUserId,
      dto.assignByUserId,
    );
  }

  /**
   * Escalate an exception
   */
  @Post('exceptions/:exceptionId/escalate')
  async escalateException(
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body() dto: EscalateExceptionDto,
  ): Promise<ExceptionReport> {
    return this.exceptionReportingService.escalateException(
      exceptionId,
      dto.escalateToUserId,
      dto.reason,
      dto.userId,
    );
  }

  /**
   * Resolve an exception
   */
  @Post('exceptions/:exceptionId/resolve')
  async resolveException(
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body() dto: ResolveExceptionDto,
  ): Promise<ExceptionReport> {
    return this.exceptionReportingService.resolveException(
      exceptionId,
      dto.resolution,
      dto.resolutionType,
      dto.userId,
    );
  }

  /**
   * Waive an exception
   */
  @Post('exceptions/:exceptionId/waive')
  async waiveException(
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body() dto: WaiveExceptionDto,
  ): Promise<ExceptionReport> {
    return this.exceptionReportingService.waiveException(
      exceptionId,
      dto.reason,
      dto.userId,
    );
  }

  /**
   * Close an exception
   */
  @Post('exceptions/:exceptionId/close')
  async closeException(
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body('userId') userId: string,
  ): Promise<ExceptionReport> {
    return this.exceptionReportingService.closeException(exceptionId, userId);
  }

  /**
   * Reopen an exception
   */
  @Post('exceptions/:exceptionId/reopen')
  async reopenException(
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body() dto: ReopenExceptionDto,
  ): Promise<ExceptionReport> {
    return this.exceptionReportingService.reopenException(exceptionId, dto.reason, dto.userId);
  }

  /**
   * Update exception priority
   */
  @Put('exceptions/:exceptionId/priority')
  async updatePriority(
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body() dto: UpdatePriorityDto,
  ): Promise<ExceptionReport> {
    return this.exceptionReportingService.updatePriority(exceptionId, dto.priority, dto.userId);
  }

  /**
   * Auto-generate exceptions from failed checks
   */
  @Post(':financialStatementId/exceptions/generate-from-checks')
  async generateExceptionsFromChecks(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body('userId') userId?: string,
  ): Promise<ExceptionReport[]> {
    return this.exceptionReportingService.generateExceptionsFromChecks(financialStatementId, userId);
  }

  /**
   * Auto-generate exceptions from material variances
   */
  @Post(':financialStatementId/exceptions/generate-from-variances')
  async generateExceptionsFromVariances(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body('userId') userId?: string,
  ): Promise<ExceptionReport[]> {
    return this.exceptionReportingService.generateExceptionsFromVariances(financialStatementId, userId);
  }

  // ==================== RULE CATEGORIES METADATA ====================

  /**
   * Get available rule categories
   */
  @Get('metadata/categories')
  getRuleCategories(): { value: string; label: string; hgbReference?: string }[] {
    return [
      { value: 'balance_sheet_structure', label: 'Bilanzstrukturprüfungen' },
      { value: 'income_statement_structure', label: 'GuV-Strukturprüfungen' },
      { value: 'balance_equation', label: 'Bilanzgleichung' },
      { value: 'intercompany_consistency', label: 'IC-Konsistenz' },
      { value: 'capital_consolidation', label: 'Kapitalkonsolidierung', hgbReference: '§ 301 HGB' },
      { value: 'debt_consolidation', label: 'Schuldenkonsolidierung', hgbReference: '§ 303 HGB' },
      { value: 'intercompany_profit', label: 'Zwischenergebniseliminierung', hgbReference: '§ 304 HGB' },
      { value: 'income_expense_consolidation', label: 'Aufwands-/Ertragskonsolidierung', hgbReference: '§ 305 HGB' },
      { value: 'deferred_tax', label: 'Latente Steuern', hgbReference: '§ 306 HGB' },
      { value: 'currency_translation', label: 'Währungsumrechnung', hgbReference: '§ 308a HGB' },
      { value: 'minority_interest', label: 'Minderheitenanteile', hgbReference: '§ 307 HGB' },
      { value: 'equity_method', label: 'At-Equity-Bewertung', hgbReference: '§ 312 HGB' },
      { value: 'proportional_consolidation', label: 'Quotenkonsolidierung', hgbReference: '§ 310 HGB' },
      { value: 'year_over_year', label: 'Vorjahresvergleich' },
      { value: 'materiality', label: 'Wesentlichkeitsprüfungen' },
      { value: 'disclosure_completeness', label: 'Vollständigkeit der Angaben' },
      { value: 'custom', label: 'Benutzerdefiniert' },
    ];
  }

  /**
   * Get available variance explanation categories
   */
  @Get('metadata/variance-categories')
  getVarianceCategories(): { value: string; label: string }[] {
    return [
      { value: 'business_activity', label: 'Geschäftstätigkeit' },
      { value: 'accounting_change', label: 'Bilanzierungsänderung' },
      { value: 'consolidation_circle', label: 'Konsolidierungskreis' },
      { value: 'one_time', label: 'Einmaleffekt' },
      { value: 'currency', label: 'Währungseffekt' },
      { value: 'other', label: 'Sonstiges' },
    ];
  }
}
