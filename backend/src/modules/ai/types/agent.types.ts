/**
 * AI Agent Types and Interfaces
 * Version 2.1 - Based on WP Feedback
 */

// ==========================================
// CONFIDENCE & QUALITY
// ==========================================

export const CONFIDENCE_THRESHOLDS = {
  high: 0.85, // Hoch - Empfehlung kann verwendet werden
  medium: 0.65, // Mittel - Manuelle Prüfung empfohlen
  low: 0.5, // Niedrig - Nicht verlässlich
} as const;

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export interface QualityIndicators {
  dataCompleteness: {
    percentage: number;
    missingData?: string[];
  };
  ruleCompliance: {
    hgbConformity: boolean;
    deviations?: string[];
  };
  historicalAccuracy?: {
    similarCases: number;
    correctPredictions: number;
    accuracy: number;
  };
  confidenceBreakdown: {
    dataQuality: number;
    patternMatch: number;
    ruleMatch: number;
    overall: number;
  };
  confidenceLevel: ConfidenceLevel;
}

// ==========================================
// REASONING
// ==========================================

export interface ReasoningStep {
  observation: string;
  inference: string;
  confidence: number;
  dataPoints: string[];
}

export interface AlternativeInterpretation {
  interpretation: string;
  probability: number;
  checkQuestion: string;
}

export interface ReasoningChain {
  steps: ReasoningStep[];
  conclusion: string;
  alternativeInterpretations?: AlternativeInterpretation[];
  showAlternativesProminent: boolean;
}

// ==========================================
// MODE SYSTEM
// ==========================================

export type AgentModeType = 'explain' | 'action';

export interface AgentMode {
  type: AgentModeType;
  activatedAt?: Date;
  activatedBy?: string;
  expiresAt?: Date;
}

export const MODE_TIMEOUT_MINUTES = 30;

// ==========================================
// PROVENANCE
// ==========================================

export type ProvenanceType =
  | 'database_record'
  | 'hgb_paragraph'
  | 'calculation'
  | 'ai_inference'
  | 'user_input';

export interface ProvenanceInfo {
  type: ProvenanceType;
  source: string;
  recordId?: string;
  table?: string;
  hgbParagraph?: string;
  timestamp?: Date;
  description?: string;
}

// ==========================================
// ACTIONS
// ==========================================

export type SuggestedActionType =
  | 'navigate'
  | 'create_correction'
  | 'export'
  | 'activate_action_mode'
  | 'mark_resolved'
  | 'view_details';

export interface SuggestedAction {
  type: SuggestedActionType;
  label: string;
  payload?: Record<string, any>;
  requiresConfirmation?: boolean;
}

export interface OverrideOption {
  id: string;
  label: string;
  requiresReasoning: boolean;
}

// ==========================================
// TOOL SYSTEM
// ==========================================

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

export interface AgentContext {
  userId: string;
  financialStatementId?: string;
  mode: AgentMode;
  sessionId: string;
  lastBatchResult?: BatchResult;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  message: string;
  reasoning: ReasoningChain;
  quality: QualityIndicators;
  provenance: ProvenanceInfo[];
  suggestedAction?: SuggestedAction;
  overrideOptions?: OverrideOption[];
  disclaimer: string;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  requiredMode: 'explain' | 'action' | 'both';
  requiresConfirmation: boolean;
  supportsBatch: boolean;
  maxBatchSize?: number;
  execute: (
    params: Record<string, any>,
    context: AgentContext,
  ) => Promise<ToolResult>;
  executeBatch?: (
    items: string[],
    context: AgentContext,
  ) => Promise<BatchResult>;
}

// ==========================================
// BATCH PROCESSING
// ==========================================

export interface BatchRequest {
  tool: string;
  items: string[];
  options: {
    parallelism: number;
    stopOnError: boolean;
    generateReport: boolean;
  };
}

export interface BatchResult {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  results: ToolResult[];
  summary: string;
  reportUrl?: string;
  sessionId: string;
  resultIndex: Record<number, string>;
}

// ==========================================
// AGENT RESPONSE
// ==========================================

export interface AgentResponse {
  success: boolean;
  message: string;
  reasoning?: ReasoningChain;
  quality?: QualityIndicators;
  provenance?: ProvenanceInfo[];
  suggestedAction?: SuggestedAction;
  overrideOptions?: OverrideOption[];
  disclaimer?: string;
  data?: any;
  batchResult?: BatchResult;
  requiresModeChange?: boolean;
}

// ==========================================
// OVERRIDE PROTOCOL
// ==========================================

export type OverrideDecision = 'accept' | 'reject' | 'modify' | 'ignore';

export interface OverrideRecord {
  id: string;
  aiRecommendationId: string;
  originalRecommendation: string;
  wpDecision: OverrideDecision;
  wpReasoning: string;
  wpAlternative?: string;
  wpUserId: string;
  timestamp: Date;
  aiConfidence: number;
  dataPointsConsidered: string[];
}

// ==========================================
// SESSION CONTEXT
// ==========================================

export interface SessionContext {
  sessionId: string;
  userId: string;
  lastBatchResult?: {
    timestamp: Date;
    toolName: string;
    totalItems: number;
    resultIndex: Record<number, string>;
  };
  recentQueries: Array<{
    query: string;
    resultIds: string[];
    timestamp: Date;
  }>;
}

// ==========================================
// AUDIT LOG
// ==========================================

export interface AuditLogEntry {
  id?: string;
  financialStatementId?: string;
  userId: string;
  requestText: string;
  requestMode: AgentModeType;
  requestTimestamp: Date;
  responseSummary?: string;
  aiRecommendation?: string;
  aiConfidence?: number;
  reasoningChain?: ReasoningChain;
  qualityIndicators?: QualityIndicators;
  provenance?: ProvenanceInfo[];
  userDecision?: OverrideDecision;
  userReasoning?: string;
  decisionTimestamp?: Date;
  actionTaken?: string;
  actionResult?: any;
  sessionId: string;
  toolName?: string;
  processingTimeMs?: number;
}

// ==========================================
// DISCLAIMERS
// ==========================================

export const DISCLAIMERS = {
  general: `Hinweis: Diese AI-Analyse dient als Unterstützung und ersetzt nicht die professionelle Beurteilung des Wirtschaftsprüfers. Alle Empfehlungen sind zu prüfen und zu dokumentieren.`,

  action: `Aktions-Modus: Änderungen werden erst nach Ihrer expliziten Bestätigung durchgeführt. Sie tragen die Verantwortung für alle durchgeführten Aktionen.`,

  hgb: `Die HGB-Referenzen basieren auf dem aktuellen Rechtsstand. Bei Zweifelsfällen konsultieren Sie bitte die Fachliteratur oder einen Rechtsberater.`,

  dataQuality: (completeness: number): string | null =>
    completeness < 0.9
      ? `Datenqualität: Nur ${Math.round(completeness * 100)}% der erforderlichen Daten liegen vor. Die Analyse ist entsprechend eingeschränkt.`
      : null,
};

export function getDisclaimer(
  context: AgentContext,
  quality?: QualityIndicators,
): string {
  const parts: string[] = [];

  if (context.mode.type === 'action') {
    parts.push(DISCLAIMERS.action);
  } else {
    parts.push(DISCLAIMERS.general);
  }

  if (quality) {
    const dataQualityDisclaimer = DISCLAIMERS.dataQuality(
      quality.dataCompleteness.percentage / 100,
    );
    if (dataQualityDisclaimer) {
      parts.push(dataQualityDisclaimer);
    }
  }

  return parts.join('\n\n');
}
