import api from './api';

// ==================== TYPES ====================

export interface PlausibilityRule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  severity: 'error' | 'warning' | 'info';
  hgbReference: string | null;
  hgbDescription: string | null;
  ruleType: string;
  ruleExpression: string;
  thresholdAbsolute: number | null;
  thresholdPercentage: number | null;
  toleranceAmount: number;
  isActive: boolean;
  isMandatory: boolean;
  isHgbRequired: boolean;
  executionOrder: number;
}

export interface PlausibilityCheck {
  id: string;
  financialStatementId: string;
  ruleId: string;
  rule?: PlausibilityRule;
  companyId: string | null;
  executedAt: string;
  executedByUserId: string | null;
  status: 'passed' | 'failed' | 'warning' | 'skipped' | 'acknowledged' | 'waived';
  expectedValue: number | null;
  actualValue: number | null;
  differenceValue: number | null;
  differencePercentage: number | null;
  message: string | null;
  details: string | null;
  affectedAccounts: string[] | null;
  acknowledgedAt: string | null;
  acknowledgedByUserId: string | null;
  acknowledgmentComment: string | null;
  waivedAt: string | null;
  waivedByUserId: string | null;
  waiverReason: string | null;
}

export interface PlausibilityCheckRun {
  id: string;
  financialStatementId: string;
  startedAt: string;
  completedAt?: string;
  executedByUserId?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  totalRules: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  categoriesChecked: string[];
  errorMessage?: string;
}

export interface PlausibilityCheckSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  acknowledged: number;
  waived: number;
  byCategory: {
    category: string;
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  }[];
  bySeverity: {
    severity: string;
    total: number;
    passed: number;
    failed: number;
  }[];
}

export interface MaterialityThresholds {
  id: string;
  financialStatementId: string;
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
  approvedByUserId?: string;
  approvedAt?: string;
}

export interface VarianceAnalysis {
  id: string;
  financialStatementId: string;
  priorFinancialStatementId: string | null;
  companyId: string | null;
  varianceType: 'absolute' | 'percentage' | 'both';
  analysisLevel: string;
  accountNumber: string | null;
  accountName: string | null;
  lineItemCode: string | null;
  lineItemName: string | null;
  currentPeriodValue: number;
  currentPeriodYear: number;
  priorPeriodValue: number;
  priorPeriodYear: number | null;
  absoluteVariance: number;
  percentageVariance: number;
  thresholdAbsolute: number | null;
  thresholdPercentage: number | null;
  significance: 'material' | 'significant' | 'minor' | 'immaterial';
  isMaterial: boolean;
  explanation: string | null;
  explanationCategory: string | null;
  explainedByUserId: string | null;
  explainedAt: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
}

export interface VarianceSummary {
  totalItems: number;
  materialCount: number;
  significantCount: number;
  minorCount: number;
  immaterialCount: number;
  explainedCount: number;
  unexplainedCount: number;
  reviewedCount: number;
  totalAbsoluteVariance: number;
  byCategory: {
    category: string;
    count: number;
    totalVariance: number;
  }[];
}

export interface ExceptionReport {
  id: string;
  financialStatementId: string;
  companyId: string | null;
  sourceType: string;
  sourceId: string | null;
  exceptionCode: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_review' | 'resolved' | 'escalated' | 'waived' | 'closed';
  impactAmount: number | null;
  impactDescription: string | null;
  affectsDisclosure: boolean;
  affectsAuditOpinion: boolean;
  assignedToUserId: string | null;
  assignedAt: string | null;
  assignedByUserId: string | null;
  resolution: string | null;
  resolutionType: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  escalatedAt: string | null;
  escalatedToUserId: string | null;
  escalationReason: string | null;
  actionLog: {
    timestamp: string;
    userId?: string;
    action: string;
    details?: string;
  }[];
  dueDate: string | null;
  hgbReference: string | null;
  createdAt: string;
}

export interface ExceptionSummary {
  totalExceptions: number;
  openCount: number;
  inReviewCount: number;
  resolvedCount: number;
  escalatedCount: number;
  waivedCount: number;
  closedCount: number;
  byPriority: {
    priority: string;
    count: number;
  }[];
  byCategory: {
    category: string | null;
    count: number;
  }[];
  overdueCount: number;
  totalImpactAmount: number;
}

export interface RuleCategoryMeta {
  value: string;
  label: string;
  hgbReference?: string;
}

export interface VarianceCategoryMeta {
  value: string;
  label: string;
}

// ==================== SERVICE ====================

export const controlsService = {
  // ==================== PLAUSIBILITY RULES ====================

  async getRules(category?: string): Promise<PlausibilityRule[]> {
    const params = category ? { category } : {};
    const response = await api.get<PlausibilityRule[]>('/controls/rules', { params });
    return response.data;
  },

  async getRule(ruleId: string): Promise<PlausibilityRule> {
    const response = await api.get<PlausibilityRule>(`/controls/rules/${ruleId}`);
    return response.data;
  },

  async createRule(rule: Partial<PlausibilityRule>): Promise<PlausibilityRule> {
    const response = await api.post<PlausibilityRule>('/controls/rules', rule);
    return response.data;
  },

  async updateRule(ruleId: string, updates: Partial<PlausibilityRule>): Promise<PlausibilityRule> {
    const response = await api.put<PlausibilityRule>(`/controls/rules/${ruleId}`, updates);
    return response.data;
  },

  async deleteRule(ruleId: string): Promise<void> {
    await api.delete(`/controls/rules/${ruleId}`);
  },

  // ==================== PLAUSIBILITY CHECKS ====================

  async runChecks(
    financialStatementId: string,
    userId?: string,
    categories?: string[],
  ): Promise<PlausibilityCheckRun> {
    const response = await api.post<PlausibilityCheckRun>(
      `/controls/${financialStatementId}/checks/run`,
      { userId, categories },
    );
    return response.data;
  },

  async getCheckResults(
    financialStatementId: string,
    status?: string,
  ): Promise<PlausibilityCheck[]> {
    const params = status ? { status } : {};
    const response = await api.get<PlausibilityCheck[]>(
      `/controls/${financialStatementId}/checks`,
      { params },
    );
    return response.data;
  },

  async getCheckSummary(financialStatementId: string): Promise<PlausibilityCheckSummary> {
    const response = await api.get<PlausibilityCheckSummary>(
      `/controls/${financialStatementId}/checks/summary`,
    );
    return response.data;
  },

  async getCheckRuns(financialStatementId: string): Promise<PlausibilityCheckRun[]> {
    const response = await api.get<PlausibilityCheckRun[]>(
      `/controls/${financialStatementId}/checks/runs`,
    );
    return response.data;
  },

  async acknowledgeCheck(checkId: string, userId: string, comment: string): Promise<PlausibilityCheck> {
    const response = await api.post<PlausibilityCheck>(
      `/controls/checks/${checkId}/acknowledge`,
      { userId, comment },
    );
    return response.data;
  },

  async waiveCheck(checkId: string, userId: string, reason: string): Promise<PlausibilityCheck> {
    const response = await api.post<PlausibilityCheck>(
      `/controls/checks/${checkId}/waive`,
      { userId, reason },
    );
    return response.data;
  },

  // ==================== MATERIALITY ====================

  async getMaterialityThresholds(financialStatementId: string): Promise<MaterialityThresholds | null> {
    const response = await api.get<MaterialityThresholds | null>(
      `/controls/${financialStatementId}/materiality`,
    );
    return response.data;
  },

  async calculateSuggestedMateriality(financialStatementId: string): Promise<{
    basisType: string;
    basisAmount: number;
    suggestedPlanning: number;
    suggestedPerformance: number;
    suggestedTrivial: number;
  }> {
    const response = await api.get(`/controls/${financialStatementId}/materiality/suggested`);
    return response.data;
  },

  async setMaterialityThresholds(
    financialStatementId: string,
    thresholds: Partial<MaterialityThresholds>,
  ): Promise<MaterialityThresholds> {
    const response = await api.post<MaterialityThresholds>(
      `/controls/${financialStatementId}/materiality`,
      thresholds,
    );
    return response.data;
  },

  async approveMaterialityThresholds(
    financialStatementId: string,
    userId: string,
  ): Promise<MaterialityThresholds> {
    const response = await api.post<MaterialityThresholds>(
      `/controls/${financialStatementId}/materiality/approve`,
      { userId },
    );
    return response.data;
  },

  // ==================== VARIANCE ANALYSIS ====================

  async runVarianceAnalysis(
    financialStatementId: string,
    priorFinancialStatementId: string,
    level?: string,
    userId?: string,
  ): Promise<VarianceAnalysis[]> {
    const response = await api.post<VarianceAnalysis[]>(
      `/controls/${financialStatementId}/variances/run`,
      { priorFinancialStatementId, level, userId },
    );
    return response.data;
  },

  async getVarianceAnalyses(
    financialStatementId: string,
    materialOnly?: boolean,
    unexplainedOnly?: boolean,
  ): Promise<VarianceAnalysis[]> {
    const params: Record<string, string> = {};
    if (materialOnly) params.materialOnly = 'true';
    if (unexplainedOnly) params.unexplainedOnly = 'true';
    const response = await api.get<VarianceAnalysis[]>(
      `/controls/${financialStatementId}/variances`,
      { params },
    );
    return response.data;
  },

  async getVarianceSummary(financialStatementId: string): Promise<VarianceSummary> {
    const response = await api.get<VarianceSummary>(
      `/controls/${financialStatementId}/variances/summary`,
    );
    return response.data;
  },

  async explainVariance(
    varianceId: string,
    explanation: string,
    category: string,
    userId: string,
  ): Promise<VarianceAnalysis> {
    const response = await api.post<VarianceAnalysis>(
      `/controls/variances/${varianceId}/explain`,
      { explanation, category, userId },
    );
    return response.data;
  },

  async reviewVariance(
    varianceId: string,
    userId: string,
    comment?: string,
  ): Promise<VarianceAnalysis> {
    const response = await api.post<VarianceAnalysis>(
      `/controls/variances/${varianceId}/review`,
      { userId, comment },
    );
    return response.data;
  },

  // ==================== EXCEPTION REPORTS ====================

  async getExceptions(
    financialStatementId: string,
    status?: string,
    priority?: string,
  ): Promise<ExceptionReport[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (priority) params.priority = priority;
    const response = await api.get<ExceptionReport[]>(
      `/controls/${financialStatementId}/exceptions`,
      { params },
    );
    return response.data;
  },

  async getOpenExceptions(financialStatementId: string): Promise<ExceptionReport[]> {
    const response = await api.get<ExceptionReport[]>(
      `/controls/${financialStatementId}/exceptions/open`,
    );
    return response.data;
  },

  async getExceptionSummary(financialStatementId: string): Promise<ExceptionSummary> {
    const response = await api.get<ExceptionSummary>(
      `/controls/${financialStatementId}/exceptions/summary`,
    );
    return response.data;
  },

  async createException(
    financialStatementId: string,
    exception: Partial<ExceptionReport>,
  ): Promise<ExceptionReport> {
    const response = await api.post<ExceptionReport>(
      `/controls/${financialStatementId}/exceptions`,
      exception,
    );
    return response.data;
  },

  async getException(exceptionId: string): Promise<ExceptionReport> {
    const response = await api.get<ExceptionReport>(`/controls/exceptions/${exceptionId}`);
    return response.data;
  },

  async assignException(
    exceptionId: string,
    assignToUserId: string,
    assignByUserId: string,
  ): Promise<ExceptionReport> {
    const response = await api.post<ExceptionReport>(
      `/controls/exceptions/${exceptionId}/assign`,
      { assignToUserId, assignByUserId },
    );
    return response.data;
  },

  async escalateException(
    exceptionId: string,
    escalateToUserId: string,
    reason: string,
    userId: string,
  ): Promise<ExceptionReport> {
    const response = await api.post<ExceptionReport>(
      `/controls/exceptions/${exceptionId}/escalate`,
      { escalateToUserId, reason, userId },
    );
    return response.data;
  },

  async resolveException(
    exceptionId: string,
    resolution: string,
    resolutionType: string,
    userId: string,
  ): Promise<ExceptionReport> {
    const response = await api.post<ExceptionReport>(
      `/controls/exceptions/${exceptionId}/resolve`,
      { resolution, resolutionType, userId },
    );
    return response.data;
  },

  async waiveException(
    exceptionId: string,
    reason: string,
    userId: string,
  ): Promise<ExceptionReport> {
    const response = await api.post<ExceptionReport>(
      `/controls/exceptions/${exceptionId}/waive`,
      { reason, userId },
    );
    return response.data;
  },

  async closeException(exceptionId: string, userId: string): Promise<ExceptionReport> {
    const response = await api.post<ExceptionReport>(
      `/controls/exceptions/${exceptionId}/close`,
      { userId },
    );
    return response.data;
  },

  async reopenException(
    exceptionId: string,
    reason: string,
    userId: string,
  ): Promise<ExceptionReport> {
    const response = await api.post<ExceptionReport>(
      `/controls/exceptions/${exceptionId}/reopen`,
      { reason, userId },
    );
    return response.data;
  },

  async updateExceptionPriority(
    exceptionId: string,
    priority: string,
    userId: string,
  ): Promise<ExceptionReport> {
    const response = await api.put<ExceptionReport>(
      `/controls/exceptions/${exceptionId}/priority`,
      { priority, userId },
    );
    return response.data;
  },

  async generateExceptionsFromChecks(
    financialStatementId: string,
    userId?: string,
  ): Promise<ExceptionReport[]> {
    const response = await api.post<ExceptionReport[]>(
      `/controls/${financialStatementId}/exceptions/generate-from-checks`,
      { userId },
    );
    return response.data;
  },

  async generateExceptionsFromVariances(
    financialStatementId: string,
    userId?: string,
  ): Promise<ExceptionReport[]> {
    const response = await api.post<ExceptionReport[]>(
      `/controls/${financialStatementId}/exceptions/generate-from-variances`,
      { userId },
    );
    return response.data;
  },

  // ==================== METADATA ====================

  async getRuleCategories(): Promise<RuleCategoryMeta[]> {
    const response = await api.get<RuleCategoryMeta[]>('/controls/metadata/categories');
    return response.data;
  },

  async getVarianceCategories(): Promise<VarianceCategoryMeta[]> {
    const response = await api.get<VarianceCategoryMeta[]>('/controls/metadata/variance-categories');
    return response.data;
  },
};
