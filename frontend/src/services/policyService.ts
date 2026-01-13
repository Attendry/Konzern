import api from './api';

// ==================== TYPES ====================

export interface AccountingPolicy {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  hgbReference: string | null;
  hgbSection: string | null;
  isHgbMandatory: boolean;
  policyText: string;
  effectiveDate: string;
  expirationDate: string | null;
  version: number;
  supersedesPolicyId: string | null;
  status: 'draft' | 'active' | 'superseded' | 'deprecated';
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface PolicyVersion {
  id: string;
  policyId: string;
  version: number;
  policyText: string;
  effectiveDate: string;
  changeReason: string | null;
  changedByUserId: string | null;
  changedAt: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
}

export interface ConsolidationRule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  ruleType: string;
  hgbReference: string | null;
  hgbDescription: string | null;
  flexibility: 'mandatory' | 'recommended' | 'optional' | 'prohibited';
  isHgbMandatory: boolean;
  ruleConfig: Record<string, unknown>;
  parameters: Record<string, unknown>;
  thresholdAmount: number | null;
  thresholdPercentage: number | null;
  appliesToEntityTypes: string[] | null;
  executionOrder: number;
  isActive: boolean;
  policyId: string | null;
  policy?: AccountingPolicy;
  createdAt: string;
}

export interface GaapHgbMapping {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sourceGaap: string;
  sourceGaapReference: string | null;
  sourceGaapDescription: string | null;
  hgbReference: string | null;
  hgbDescription: string | null;
  direction: 'source_to_hgb' | 'hgb_to_source';
  adjustmentType: string;
  adjustmentConfig: Record<string, unknown>;
  affectsBalanceSheet: boolean;
  affectsIncomeStatement: boolean;
  affectsEquity: boolean;
  affectsDeferredTax: boolean;
  sourceAccounts: string[] | null;
  targetAccounts: string[] | null;
  isActive: boolean;
  isMaterial: boolean;
  policyId: string | null;
}

export interface GaapAdjustment {
  id: string;
  financialStatementId: string;
  companyId: string;
  mappingId: string;
  sourceGaap: string;
  sourceAmount: number;
  sourceAccount: string | null;
  adjustmentAmount: number;
  adjustmentDescription: string | null;
  targetAmount: number;
  targetAccount: string | null;
  deferredTaxImpact: number;
  consolidationEntryId: string | null;
  isReviewed: boolean;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
}

export interface HgbWahlrecht {
  id: string;
  code: string;
  name: string;
  description: string | null;
  hgbReference: string;
  hgbSection: string | null;
  optionType: string;
  availableOptions: {
    value: string;
    label: string;
    description?: string;
  }[];
  defaultOption: string | null;
  onceChosenBinding: boolean;
  changeRequiresDisclosure: boolean;
  ifrsEquivalent: string | null;
  differencesToIfrs: string | null;
  isActive: boolean;
}

export interface WahlrechtSelection {
  id: string;
  wahlrechtId: string;
  wahlrecht?: HgbWahlrecht;
  companyId: string | null;
  financialStatementId: string | null;
  selectedOption: string;
  selectionReason: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  wasApplied: boolean;
  wasSuccessful: boolean;
  message: string;
  affectedAmount?: number;
  affectedAccounts?: string[];
  consolidationEntryId?: string;
  parametersUsed?: Record<string, unknown>;
}

export interface PolicySummary {
  totalPolicies: number;
  activePolicies: number;
  draftPolicies: number;
  hgbMandatory: number;
  byCategory: { category: string; count: number }[];
}

export interface RuleSummary {
  totalRules: number;
  activeRules: number;
  mandatoryRules: number;
  byType: { type: string; count: number; mandatoryCount: number }[];
  byFlexibility: { flexibility: string; count: number }[];
}

export interface MappingSummary {
  totalMappings: number;
  activeMappings: number;
  materialMappings: number;
  bySourceGaap: { gaap: string; count: number }[];
  byAdjustmentType: { type: string; count: number }[];
}

export interface AdjustmentSummary {
  totalAdjustments: number;
  reviewedCount: number;
  pendingReviewCount: number;
  totalAdjustmentAmount: number;
  totalDeferredTaxImpact: number;
  bySourceGaap: { gaap: string; count: number; totalAmount: number }[];
  byAdjustmentType: { type: string; count: number; totalAmount: number }[];
}

export interface WahlrechtSummary {
  totalWahlrechte: number;
  selectionsCount: number;
  bindingSelectionsCount: number;
  byOptionType: { type: string; count: number }[];
}

export interface CategoryMeta {
  value: string;
  label: string;
  hgbReference?: string;
}

// ==================== SERVICE ====================

export const policyService = {
  // ==================== ACCOUNTING POLICIES ====================

  async getPolicies(
    category?: string,
    status?: string,
    hgbMandatoryOnly?: boolean,
  ): Promise<AccountingPolicy[]> {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (status) params.status = status;
    if (hgbMandatoryOnly) params.hgbMandatoryOnly = 'true';
    const response = await api.get<AccountingPolicy[]>('/policy/policies', { params });
    return response.data;
  },

  async getActivePolicies(asOfDate?: string): Promise<AccountingPolicy[]> {
    const params = asOfDate ? { asOfDate } : {};
    const response = await api.get<AccountingPolicy[]>('/policy/policies/active', { params });
    return response.data;
  },

  async getPolicySummary(): Promise<PolicySummary> {
    const response = await api.get<PolicySummary>('/policy/policies/summary');
    return response.data;
  },

  async getPolicy(policyId: string): Promise<AccountingPolicy> {
    const response = await api.get<AccountingPolicy>(`/policy/policies/${policyId}`);
    return response.data;
  },

  async getPolicyVersions(policyId: string): Promise<PolicyVersion[]> {
    const response = await api.get<PolicyVersion[]>(`/policy/policies/${policyId}/versions`);
    return response.data;
  },

  async createPolicy(policy: Partial<AccountingPolicy>): Promise<AccountingPolicy> {
    const response = await api.post<AccountingPolicy>('/policy/policies', policy);
    return response.data;
  },

  async updatePolicy(policyId: string, updates: Partial<AccountingPolicy>): Promise<AccountingPolicy> {
    const response = await api.put<AccountingPolicy>(`/policy/policies/${policyId}`, updates);
    return response.data;
  },

  async activatePolicy(policyId: string, userId: string): Promise<AccountingPolicy> {
    const response = await api.post<AccountingPolicy>(`/policy/policies/${policyId}/activate`, { userId });
    return response.data;
  },

  // ==================== CONSOLIDATION RULES ====================

  async getRules(ruleType?: string, activeOnly?: boolean): Promise<ConsolidationRule[]> {
    const params: Record<string, string> = {};
    if (ruleType) params.ruleType = ruleType;
    if (activeOnly !== undefined) params.activeOnly = String(activeOnly);
    const response = await api.get<ConsolidationRule[]>('/policy/rules', { params });
    return response.data;
  },

  async getMandatoryRules(): Promise<ConsolidationRule[]> {
    const response = await api.get<ConsolidationRule[]>('/policy/rules/mandatory');
    return response.data;
  },

  async getRuleSummary(): Promise<RuleSummary> {
    const response = await api.get<RuleSummary>('/policy/rules/summary');
    return response.data;
  },

  async getRule(ruleId: string): Promise<ConsolidationRule> {
    const response = await api.get<ConsolidationRule>(`/policy/rules/${ruleId}`);
    return response.data;
  },

  async createRule(rule: Partial<ConsolidationRule>): Promise<ConsolidationRule> {
    const response = await api.post<ConsolidationRule>('/policy/rules', rule);
    return response.data;
  },

  async updateRule(ruleId: string, updates: Partial<ConsolidationRule>): Promise<ConsolidationRule> {
    const response = await api.put<ConsolidationRule>(`/policy/rules/${ruleId}`, updates);
    return response.data;
  },

  async deleteRule(ruleId: string): Promise<void> {
    await api.delete(`/policy/rules/${ruleId}`);
  },

  async executeRule(
    financialStatementId: string,
    ruleId: string,
    context: Record<string, unknown>,
    userId?: string,
  ): Promise<RuleExecutionResult> {
    const response = await api.post<RuleExecutionResult>(
      `/policy/${financialStatementId}/execute/${ruleId}`,
      { context, userId },
    );
    return response.data;
  },

  async executeAllRules(
    financialStatementId: string,
    context: Record<string, unknown>,
    userId?: string,
    ruleTypes?: string[],
  ): Promise<RuleExecutionResult[]> {
    const response = await api.post<RuleExecutionResult[]>(
      `/policy/${financialStatementId}/execute`,
      { context, userId, ruleTypes },
    );
    return response.data;
  },

  async getApplicationLogs(financialStatementId: string): Promise<any[]> {
    const response = await api.get(`/policy/${financialStatementId}/logs`);
    return response.data;
  },

  // ==================== GAAP-HGB MAPPINGS ====================

  async getMappings(
    sourceGaap?: string,
    adjustmentType?: string,
    activeOnly?: boolean,
  ): Promise<GaapHgbMapping[]> {
    const params: Record<string, string> = {};
    if (sourceGaap) params.sourceGaap = sourceGaap;
    if (adjustmentType) params.adjustmentType = adjustmentType;
    if (activeOnly !== undefined) params.activeOnly = String(activeOnly);
    const response = await api.get<GaapHgbMapping[]>('/policy/mappings', { params });
    return response.data;
  },

  async getMaterialMappings(): Promise<GaapHgbMapping[]> {
    const response = await api.get<GaapHgbMapping[]>('/policy/mappings/material');
    return response.data;
  },

  async getMappingSummary(): Promise<MappingSummary> {
    const response = await api.get<MappingSummary>('/policy/mappings/summary');
    return response.data;
  },

  async getMapping(mappingId: string): Promise<GaapHgbMapping> {
    const response = await api.get<GaapHgbMapping>(`/policy/mappings/${mappingId}`);
    return response.data;
  },

  async createMapping(mapping: Partial<GaapHgbMapping>): Promise<GaapHgbMapping> {
    const response = await api.post<GaapHgbMapping>('/policy/mappings', mapping);
    return response.data;
  },

  async updateMapping(mappingId: string, updates: Partial<GaapHgbMapping>): Promise<GaapHgbMapping> {
    const response = await api.put<GaapHgbMapping>(`/policy/mappings/${mappingId}`, updates);
    return response.data;
  },

  async applyMapping(
    financialStatementId: string,
    mappingId: string,
    companyId: string,
    sourceAmount: number,
    sourceAccount?: string,
    userId?: string,
  ): Promise<GaapAdjustment> {
    const response = await api.post<GaapAdjustment>(
      `/policy/${financialStatementId}/mappings/${mappingId}/apply`,
      { companyId, sourceAmount, sourceAccount, userId },
    );
    return response.data;
  },

  // ==================== GAAP ADJUSTMENTS ====================

  async getAdjustments(
    financialStatementId: string,
    companyId?: string,
    sourceGaap?: string,
  ): Promise<GaapAdjustment[]> {
    const params: Record<string, string> = {};
    if (companyId) params.companyId = companyId;
    if (sourceGaap) params.sourceGaap = sourceGaap;
    const response = await api.get<GaapAdjustment[]>(
      `/policy/${financialStatementId}/adjustments`,
      { params },
    );
    return response.data;
  },

  async getAdjustmentSummary(financialStatementId: string): Promise<AdjustmentSummary> {
    const response = await api.get<AdjustmentSummary>(
      `/policy/${financialStatementId}/adjustments/summary`,
    );
    return response.data;
  },

  async createAdjustment(
    financialStatementId: string,
    adjustment: Partial<GaapAdjustment>,
  ): Promise<GaapAdjustment> {
    const response = await api.post<GaapAdjustment>(
      `/policy/${financialStatementId}/adjustments`,
      adjustment,
    );
    return response.data;
  },

  async reviewAdjustment(adjustmentId: string, userId: string): Promise<GaapAdjustment> {
    const response = await api.post<GaapAdjustment>(
      `/policy/adjustments/${adjustmentId}/review`,
      { userId },
    );
    return response.data;
  },

  async deleteAdjustment(adjustmentId: string, userId?: string): Promise<void> {
    await api.delete(`/policy/adjustments/${adjustmentId}`, { params: { userId } });
  },

  // ==================== HGB WAHLRECHTE ====================

  async getWahlrechte(optionType?: string): Promise<HgbWahlrecht[]> {
    const params = optionType ? { optionType } : {};
    const response = await api.get<HgbWahlrecht[]>('/policy/wahlrechte', { params });
    return response.data;
  },

  async getWahlrechtSummary(): Promise<WahlrechtSummary> {
    const response = await api.get<WahlrechtSummary>('/policy/wahlrechte/summary');
    return response.data;
  },

  async getWahlrecht(wahlrechtId: string): Promise<HgbWahlrecht> {
    const response = await api.get<HgbWahlrecht>(`/policy/wahlrechte/${wahlrechtId}`);
    return response.data;
  },

  async getWahlrechtSelections(
    companyId?: string,
    financialStatementId?: string,
  ): Promise<WahlrechtSelection[]> {
    const params: Record<string, string> = {};
    if (companyId) params.companyId = companyId;
    if (financialStatementId) params.financialStatementId = financialStatementId;
    const response = await api.get<WahlrechtSelection[]>('/policy/wahlrechte/selections', { params });
    return response.data;
  },

  async setWahlrechtSelection(
    wahlrechtId: string,
    selection: Partial<WahlrechtSelection>,
    userId?: string,
  ): Promise<WahlrechtSelection> {
    const response = await api.post<WahlrechtSelection>(
      `/policy/wahlrechte/${wahlrechtId}/select`,
      { ...selection, userId },
    );
    return response.data;
  },

  async approveWahlrechtSelection(selectionId: string, userId: string): Promise<WahlrechtSelection> {
    const response = await api.post<WahlrechtSelection>(
      `/policy/wahlrechte/selections/${selectionId}/approve`,
      { userId },
    );
    return response.data;
  },

  // ==================== METADATA ====================

  async getPolicyCategories(): Promise<CategoryMeta[]> {
    const response = await api.get<CategoryMeta[]>('/policy/metadata/policy-categories');
    return response.data;
  },

  async getRuleTypes(): Promise<CategoryMeta[]> {
    const response = await api.get<CategoryMeta[]>('/policy/metadata/rule-types');
    return response.data;
  },

  async getGaapStandards(): Promise<CategoryMeta[]> {
    const response = await api.get<CategoryMeta[]>('/policy/metadata/gaap-standards');
    return response.data;
  },

  async getAdjustmentTypes(): Promise<CategoryMeta[]> {
    const response = await api.get<CategoryMeta[]>('/policy/metadata/adjustment-types');
    return response.data;
  },
};
