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
import {
  PolicyService,
  PolicySummary,
  WahlrechtSummary,
} from './policy.service';
import {
  RulesEngineService,
  RuleExecutionResult,
  RuleSummary,
} from './rules-engine.service';
import {
  GaapHgbMappingService,
  GaapAdjustment,
  AdjustmentSummary,
  MappingSummary,
} from './gaap-hgb-mapping.service';
import {
  AccountingPolicy,
  PolicyCategory,
  PolicyStatus,
} from '../../entities/accounting-policy.entity';
import {
  ConsolidationRule,
  ConsolidationRuleType,
  RuleFlexibility,
} from '../../entities/consolidation-rule.entity';
import {
  GaapHgbMapping,
  GaapStandard,
  GaapAdjustmentType,
} from '../../entities/gaap-hgb-mapping.entity';
import {
  HgbWahlrecht,
  WahlrechtSelection,
} from '../../entities/hgb-wahlrecht.entity';

// ==================== DTOs ====================

class CreatePolicyDto {
  code: string;
  name: string;
  description?: string;
  category: PolicyCategory;
  hgbReference?: string;
  hgbSection?: string;
  isHgbMandatory?: boolean;
  policyText: string;
  effectiveDate: string;
  expirationDate?: string;
}

class UpdatePolicyDto {
  name?: string;
  description?: string;
  hgbReference?: string;
  hgbSection?: string;
  policyText?: string;
  effectiveDate?: string;
  expirationDate?: string;
  status?: PolicyStatus;
}

class CreateRuleDto {
  code: string;
  name: string;
  description?: string;
  ruleType: ConsolidationRuleType;
  hgbReference?: string;
  hgbDescription?: string;
  flexibility?: RuleFlexibility;
  isHgbMandatory?: boolean;
  ruleConfig: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  thresholdAmount?: number;
  thresholdPercentage?: number;
  appliesToEntityTypes?: string[];
  executionOrder?: number;
  policyId?: string;
}

class UpdateRuleDto {
  name?: string;
  description?: string;
  hgbReference?: string;
  hgbDescription?: string;
  parameters?: Record<string, unknown>;
  thresholdAmount?: number;
  thresholdPercentage?: number;
  appliesToEntityTypes?: string[];
  executionOrder?: number;
  isActive?: boolean;
}

class SetRuleOverrideDto {
  parameterOverrides: Record<string, unknown>;
  justification: string;
  userId?: string;
}

class ExecuteRulesDto {
  context: Record<string, unknown>;
  userId?: string;
  ruleTypes?: ConsolidationRuleType[];
}

class CreateMappingDto {
  code: string;
  name: string;
  description?: string;
  sourceGaap: GaapStandard;
  sourceGaapReference?: string;
  sourceGaapDescription?: string;
  hgbReference?: string;
  hgbDescription?: string;
  adjustmentType: GaapAdjustmentType;
  adjustmentConfig: Record<string, unknown>;
  affectsBalanceSheet?: boolean;
  affectsIncomeStatement?: boolean;
  affectsEquity?: boolean;
  affectsDeferredTax?: boolean;
  sourceAccounts?: string[];
  targetAccounts?: string[];
  isMaterial?: boolean;
  policyId?: string;
}

class UpdateMappingDto {
  name?: string;
  description?: string;
  adjustmentConfig?: Record<string, unknown>;
  affectsBalanceSheet?: boolean;
  affectsIncomeStatement?: boolean;
  affectsEquity?: boolean;
  affectsDeferredTax?: boolean;
  sourceAccounts?: string[];
  targetAccounts?: string[];
  isActive?: boolean;
  isMaterial?: boolean;
}

class ApplyMappingDto {
  companyId: string;
  sourceAmount: number;
  sourceAccount?: string;
  userId?: string;
}

class CreateAdjustmentDto {
  companyId: string;
  mappingId: string;
  sourceGaap: GaapStandard;
  sourceAmount: number;
  sourceAccount?: string;
  adjustmentAmount: number;
  adjustmentDescription?: string;
  targetAmount: number;
  targetAccount?: string;
  deferredTaxImpact?: number;
  userId?: string;
}

class SetWahlrechtSelectionDto {
  companyId?: string;
  selectedOption: string;
  selectionReason?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  userId?: string;
}

// ==================== CONTROLLER ====================

@Controller('policy')
export class PolicyController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly rulesEngineService: RulesEngineService,
    private readonly gaapHgbMappingService: GaapHgbMappingService,
  ) {}

  // ==================== ACCOUNTING POLICIES ====================

  /**
   * Get all accounting policies
   */
  @Get('policies')
  async getPolicies(
    @Query('category') category?: PolicyCategory,
    @Query('status') status?: PolicyStatus,
    @Query('hgbMandatoryOnly') hgbMandatoryOnly?: string,
  ): Promise<AccountingPolicy[]> {
    return this.policyService.getPolicies(
      category,
      status,
      hgbMandatoryOnly === 'true',
    );
  }

  /**
   * Get active policies as of a date
   */
  @Get('policies/active')
  async getActivePolicies(
    @Query('asOfDate') asOfDate?: string,
  ): Promise<AccountingPolicy[]> {
    const date = asOfDate ? new Date(asOfDate) : new Date();
    return this.policyService.getActivePolicies(date);
  }

  /**
   * Get policy summary
   */
  @Get('policies/summary')
  async getPolicySummary(): Promise<PolicySummary> {
    return this.policyService.getPolicySummary();
  }

  /**
   * Get a single policy
   */
  @Get('policies/:policyId')
  async getPolicy(
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ): Promise<AccountingPolicy | null> {
    return this.policyService.getPolicy(policyId);
  }

  /**
   * Get policy versions
   */
  @Get('policies/:policyId/versions')
  async getPolicyVersions(
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ): Promise<any[]> {
    return this.policyService.getPolicyVersions(policyId);
  }

  /**
   * Create a new policy
   */
  @Post('policies')
  async createPolicy(@Body() dto: CreatePolicyDto): Promise<AccountingPolicy> {
    return this.policyService.createPolicy({
      ...dto,
      effectiveDate: new Date(dto.effectiveDate),
      expirationDate: dto.expirationDate
        ? new Date(dto.expirationDate)
        : undefined,
    } as any);
  }

  /**
   * Update a policy
   */
  @Put('policies/:policyId')
  async updatePolicy(
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: UpdatePolicyDto,
  ): Promise<AccountingPolicy> {
    return this.policyService.updatePolicy(policyId, dto as any);
  }

  /**
   * Activate a policy
   */
  @Post('policies/:policyId/activate')
  async activatePolicy(
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body('userId') userId: string,
  ): Promise<AccountingPolicy> {
    return this.policyService.activatePolicy(policyId, userId);
  }

  // ==================== CONSOLIDATION RULES ====================

  /**
   * Get all consolidation rules
   */
  @Get('rules')
  async getRules(
    @Query('ruleType') ruleType?: ConsolidationRuleType,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<ConsolidationRule[]> {
    return this.rulesEngineService.getRules(ruleType, activeOnly !== 'false');
  }

  /**
   * Get mandatory HGB rules
   */
  @Get('rules/mandatory')
  async getMandatoryRules(): Promise<ConsolidationRule[]> {
    return this.rulesEngineService.getMandatoryRules();
  }

  /**
   * Get rule summary
   */
  @Get('rules/summary')
  async getRuleSummary(): Promise<RuleSummary> {
    return this.rulesEngineService.getRuleSummary();
  }

  /**
   * Get a single rule
   */
  @Get('rules/:ruleId')
  async getRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<ConsolidationRule | null> {
    return this.rulesEngineService.getRule(ruleId);
  }

  /**
   * Create a new rule
   */
  @Post('rules')
  async createRule(@Body() dto: CreateRuleDto): Promise<ConsolidationRule> {
    return this.rulesEngineService.createRule(dto as any);
  }

  /**
   * Update a rule
   */
  @Put('rules/:ruleId')
  async updateRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateRuleDto,
  ): Promise<ConsolidationRule> {
    return this.rulesEngineService.updateRule(ruleId, dto as any);
  }

  /**
   * Delete a rule
   */
  @Delete('rules/:ruleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ): Promise<void> {
    return this.rulesEngineService.deleteRule(ruleId);
  }

  // ==================== RULE OVERRIDES & EXECUTION ====================

  /**
   * Get rule overrides for a financial statement
   */
  @Get(':financialStatementId/overrides')
  async getRuleOverrides(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<any[]> {
    return this.rulesEngineService.getRuleOverrides(financialStatementId);
  }

  /**
   * Set a rule override
   */
  @Post(':financialStatementId/overrides/:ruleId')
  async setRuleOverride(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: SetRuleOverrideDto,
  ): Promise<any> {
    return this.rulesEngineService.setRuleOverride(
      ruleId,
      financialStatementId,
      dto.parameterOverrides,
      dto.justification,
      dto.userId,
    );
  }

  /**
   * Approve a rule override
   */
  @Post('overrides/:overrideId/approve')
  async approveRuleOverride(
    @Param('overrideId', ParseUUIDPipe) overrideId: string,
    @Body('userId') userId: string,
  ): Promise<any> {
    return this.rulesEngineService.approveRuleOverride(overrideId, userId);
  }

  /**
   * Execute a single rule
   */
  @Post(':financialStatementId/execute/:ruleId')
  async executeRule(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: { context: Record<string, unknown>; userId?: string },
  ): Promise<RuleExecutionResult> {
    return this.rulesEngineService.executeRule(
      ruleId,
      financialStatementId,
      dto.context,
      dto.userId,
    );
  }

  /**
   * Execute all rules for a financial statement
   */
  @Post(':financialStatementId/execute')
  async executeAllRules(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body() dto: ExecuteRulesDto,
  ): Promise<RuleExecutionResult[]> {
    return this.rulesEngineService.executeAllRules(
      financialStatementId,
      dto.context,
      dto.userId,
      dto.ruleTypes,
    );
  }

  /**
   * Get application logs for a financial statement
   */
  @Get(':financialStatementId/logs')
  async getApplicationLogs(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<any[]> {
    return this.rulesEngineService.getApplicationLogs(financialStatementId);
  }

  // ==================== GAAP-HGB MAPPINGS ====================

  /**
   * Get all GAAP-HGB mappings
   */
  @Get('mappings')
  async getMappings(
    @Query('sourceGaap') sourceGaap?: GaapStandard,
    @Query('adjustmentType') adjustmentType?: GaapAdjustmentType,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<GaapHgbMapping[]> {
    return this.gaapHgbMappingService.getMappings(
      sourceGaap,
      adjustmentType,
      activeOnly !== 'false',
    );
  }

  /**
   * Get material mappings
   */
  @Get('mappings/material')
  async getMaterialMappings(): Promise<GaapHgbMapping[]> {
    return this.gaapHgbMappingService.getMaterialMappings();
  }

  /**
   * Get mapping summary
   */
  @Get('mappings/summary')
  async getMappingSummary(): Promise<MappingSummary> {
    return this.gaapHgbMappingService.getMappingSummary();
  }

  /**
   * Get a single mapping
   */
  @Get('mappings/:mappingId')
  async getMapping(
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
  ): Promise<GaapHgbMapping | null> {
    return this.gaapHgbMappingService.getMapping(mappingId);
  }

  /**
   * Create a new mapping
   */
  @Post('mappings')
  async createMapping(@Body() dto: CreateMappingDto): Promise<GaapHgbMapping> {
    return this.gaapHgbMappingService.createMapping(dto as any);
  }

  /**
   * Update a mapping
   */
  @Put('mappings/:mappingId')
  async updateMapping(
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
    @Body() dto: UpdateMappingDto,
  ): Promise<GaapHgbMapping> {
    return this.gaapHgbMappingService.updateMapping(mappingId, dto as any);
  }

  /**
   * Apply a mapping to create an adjustment
   */
  @Post(':financialStatementId/mappings/:mappingId/apply')
  async applyMapping(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
    @Body() dto: ApplyMappingDto,
  ): Promise<GaapAdjustment> {
    return this.gaapHgbMappingService.applyMapping(
      mappingId,
      financialStatementId,
      dto.companyId,
      dto.sourceAmount,
      dto.sourceAccount,
      dto.userId,
    );
  }

  // ==================== GAAP ADJUSTMENTS ====================

  /**
   * Get adjustments for a financial statement
   */
  @Get(':financialStatementId/adjustments')
  async getAdjustments(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Query('companyId') companyId?: string,
    @Query('sourceGaap') sourceGaap?: GaapStandard,
  ): Promise<GaapAdjustment[]> {
    return this.gaapHgbMappingService.getAdjustments(
      financialStatementId,
      companyId,
      sourceGaap,
    );
  }

  /**
   * Get adjustment summary
   */
  @Get(':financialStatementId/adjustments/summary')
  async getAdjustmentSummary(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
  ): Promise<AdjustmentSummary> {
    return this.gaapHgbMappingService.getAdjustmentSummary(
      financialStatementId,
    );
  }

  /**
   * Create an adjustment
   */
  @Post(':financialStatementId/adjustments')
  async createAdjustment(
    @Param('financialStatementId', ParseUUIDPipe) financialStatementId: string,
    @Body() dto: CreateAdjustmentDto,
  ): Promise<GaapAdjustment> {
    return this.gaapHgbMappingService.createAdjustment({
      ...dto,
      financialStatementId,
    });
  }

  /**
   * Review an adjustment
   */
  @Post('adjustments/:adjustmentId/review')
  async reviewAdjustment(
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
    @Body('userId') userId: string,
  ): Promise<GaapAdjustment> {
    return this.gaapHgbMappingService.reviewAdjustment(adjustmentId, userId);
  }

  /**
   * Delete an adjustment
   */
  @Delete('adjustments/:adjustmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAdjustment(
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
    @Query('userId') userId?: string,
  ): Promise<void> {
    return this.gaapHgbMappingService.deleteAdjustment(adjustmentId, userId);
  }

  // ==================== HGB WAHLRECHTE ====================

  /**
   * Get all HGB Wahlrechte
   */
  @Get('wahlrechte')
  async getWahlrechte(
    @Query('optionType') optionType?: string,
  ): Promise<HgbWahlrecht[]> {
    return this.policyService.getWahlrechte(optionType);
  }

  /**
   * Get Wahlrecht summary
   */
  @Get('wahlrechte/summary')
  async getWahlrechtSummary(): Promise<WahlrechtSummary> {
    return this.policyService.getWahlrechtSummary();
  }

  /**
   * Get a single Wahlrecht
   */
  @Get('wahlrechte/:wahlrechtId')
  async getWahlrecht(
    @Param('wahlrechtId', ParseUUIDPipe) wahlrechtId: string,
  ): Promise<HgbWahlrecht | null> {
    return this.policyService.getWahlrecht(wahlrechtId);
  }

  /**
   * Get Wahlrecht selections
   */
  @Get('wahlrechte/selections')
  async getWahlrechtSelections(
    @Query('companyId') companyId?: string,
    @Query('financialStatementId') financialStatementId?: string,
  ): Promise<WahlrechtSelection[]> {
    return this.policyService.getWahlrechtSelections(
      companyId,
      financialStatementId,
    );
  }

  /**
   * Set a Wahlrecht selection
   */
  @Post('wahlrechte/:wahlrechtId/select')
  async setWahlrechtSelection(
    @Param('wahlrechtId', ParseUUIDPipe) wahlrechtId: string,
    @Body() dto: SetWahlrechtSelectionDto,
  ): Promise<WahlrechtSelection> {
    return this.policyService.setWahlrechtSelection(
      wahlrechtId,
      {
        ...dto,
        effectiveFrom: dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : undefined,
        effectiveUntil: dto.effectiveUntil
          ? new Date(dto.effectiveUntil)
          : undefined,
      } as any,
      dto.userId,
    );
  }

  /**
   * Approve a Wahlrecht selection
   */
  @Post('wahlrechte/selections/:selectionId/approve')
  async approveWahlrechtSelection(
    @Param('selectionId', ParseUUIDPipe) selectionId: string,
    @Body('userId') userId: string,
  ): Promise<WahlrechtSelection> {
    return this.policyService.approveWahlrechtSelection(selectionId, userId);
  }

  // ==================== METADATA ====================

  /**
   * Get policy categories
   */
  @Get('metadata/policy-categories')
  getPolicyCategories(): { value: string; label: string }[] {
    return [
      { value: 'valuation', label: 'Bewertung' },
      { value: 'recognition', label: 'Ansatz' },
      { value: 'consolidation', label: 'Konsolidierung' },
      { value: 'presentation', label: 'Ausweis' },
      { value: 'disclosure', label: 'Anhangangaben' },
      { value: 'currency', label: 'Währung' },
      { value: 'deferred_tax', label: 'Latente Steuern' },
      { value: 'goodwill', label: 'Geschäftswert' },
      { value: 'depreciation', label: 'Abschreibungen' },
      { value: 'provisions', label: 'Rückstellungen' },
      { value: 'leasing', label: 'Leasing' },
      { value: 'financial_instruments', label: 'Finanzinstrumente' },
      { value: 'inventory', label: 'Vorräte' },
      { value: 'revenue', label: 'Umsatzerlöse' },
      { value: 'other', label: 'Sonstiges' },
    ];
  }

  /**
   * Get rule types
   */
  @Get('metadata/rule-types')
  getRuleTypes(): { value: string; label: string; hgbReference?: string }[] {
    return [
      {
        value: 'capital_consolidation',
        label: 'Kapitalkonsolidierung',
        hgbReference: '§ 301 HGB',
      },
      {
        value: 'debt_consolidation',
        label: 'Schuldenkonsolidierung',
        hgbReference: '§ 303 HGB',
      },
      {
        value: 'intercompany_profit',
        label: 'Zwischenergebniseliminierung',
        hgbReference: '§ 304 HGB',
      },
      {
        value: 'income_expense',
        label: 'Aufwands-/Ertragskonsolidierung',
        hgbReference: '§ 305 HGB',
      },
      {
        value: 'deferred_tax',
        label: 'Latente Steuern',
        hgbReference: '§ 306 HGB',
      },
      {
        value: 'minority_interest',
        label: 'Minderheitenanteile',
        hgbReference: '§ 307 HGB',
      },
      {
        value: 'uniform_valuation',
        label: 'Einheitliche Bewertung',
        hgbReference: '§ 308 HGB',
      },
      {
        value: 'currency_translation',
        label: 'Währungsumrechnung',
        hgbReference: '§ 308a HGB',
      },
      {
        value: 'goodwill_treatment',
        label: 'Geschäftswertbehandlung',
        hgbReference: '§ 309 HGB',
      },
      {
        value: 'proportional_consolidation',
        label: 'Quotenkonsolidierung',
        hgbReference: '§ 310 HGB',
      },
      {
        value: 'equity_method',
        label: 'At-Equity-Bewertung',
        hgbReference: '§ 312 HGB',
      },
      {
        value: 'consolidation_scope',
        label: 'Konsolidierungskreis',
        hgbReference: '§ 294-296 HGB',
      },
      {
        value: 'disclosure',
        label: 'Anhangangaben',
        hgbReference: '§ 313-314 HGB',
      },
      { value: 'other', label: 'Sonstige' },
    ];
  }

  /**
   * Get GAAP standards
   */
  @Get('metadata/gaap-standards')
  getGaapStandards(): { value: string; label: string }[] {
    return [
      { value: 'hgb', label: 'HGB (Handelsgesetzbuch)' },
      {
        value: 'ifrs',
        label: 'IFRS (International Financial Reporting Standards)',
      },
      { value: 'us_gaap', label: 'US GAAP' },
      { value: 'local_gaap', label: 'Lokales GAAP' },
      { value: 'other', label: 'Sonstige' },
    ];
  }

  /**
   * Get adjustment types
   */
  @Get('metadata/adjustment-types')
  getAdjustmentTypes(): { value: string; label: string }[] {
    return [
      { value: 'recognition', label: 'Ansatzunterschied' },
      { value: 'measurement', label: 'Bewertungsunterschied' },
      { value: 'presentation', label: 'Ausweisunterschied' },
      { value: 'disclosure', label: 'Angabenunterschied' },
      { value: 'timing', label: 'Zeitliche Unterschiede' },
      { value: 'permanent', label: 'Permanente Unterschiede' },
      { value: 'reclassification', label: 'Umgliederung' },
    ];
  }
}
