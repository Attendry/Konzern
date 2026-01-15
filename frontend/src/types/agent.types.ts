/**
 * AI Agent Types for Frontend
 * Version 2.1
 */

// ==========================================
// CONFIDENCE & QUALITY
// ==========================================

export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.65,
  low: 0.50,
} as const;

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high': return '#22c55e';   // Green
    case 'medium': return '#eab308'; // Yellow
    case 'low': return '#ef4444';    // Red
  }
}

export function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high': return 'Hoch';
    case 'medium': return 'Mittel';
    case 'low': return 'Niedrig';
  }
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
// QUALITY
// ==========================================

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
// MODE SYSTEM
// ==========================================

export type AgentModeType = 'explain' | 'action';

export interface ModeStatus {
  type: AgentModeType;
  activatedAt?: string;
  expiresAt?: string;
  remainingSeconds?: number;
}

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
  timestamp?: string;
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
// BATCH
// ==========================================

export interface BatchResult {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  summary: string;
  reportUrl?: string;
  sessionId: string;
  resultIndex?: Record<number, string>;
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
  auditLogId?: string;
}

// ==========================================
// OVERRIDE
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
  timestamp: string;
  aiConfidence: number;
}

// ==========================================
// AUDIT
// ==========================================

export interface AuditStatistics {
  period: {
    startDate: string;
    endDate: string;
  };
  totalInteractions: number;
  byDecision: {
    accept: number;
    reject: number;
    modify: number;
    ignore: number;
  };
  byTool: Record<string, number>;
  byUser: Array<{
    userId: string;
    userName: string;
    interactions: number;
    acceptRate: number;
  }>;
  averageConfidence: number;
  overrideRate: number;
  lowConfidenceInteractions: number;
  missingReasoningCount: number;
}

export interface AuditLogEntry {
  id: string;
  financialStatementId?: string;
  userId: string;
  requestText: string;
  requestMode: AgentModeType;
  requestTimestamp: string | Date;
  responseSummary?: string;
  aiRecommendation?: string;
  aiConfidence?: number;
  userDecision?: OverrideDecision;
  userReasoning?: string;
  toolName?: string;
  processingTimeMs?: number;
}
