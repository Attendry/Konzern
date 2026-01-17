import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AgentModeType,
  OverrideDecision,
  ConfidenceLevel,
} from '../types/agent.types';

// ==========================================
// AGENT REQUEST DTOs
// ==========================================

export class AgentRequestDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsUUID()
  financialStatementId?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class ActivateModeDto {
  @IsEnum(['explain', 'action'])
  mode: AgentModeType;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class RecordDecisionDto {
  @IsUUID()
  auditLogId: string;

  @IsEnum(['accept', 'reject', 'modify', 'ignore'])
  decision: OverrideDecision;

  @IsOptional()
  @IsString()
  reasoning?: string;

  @IsOptional()
  @IsString()
  actionTaken?: string;

  @IsOptional()
  actionResult?: any;
}

export class BatchRequestDto {
  @IsString()
  tool: string;

  @IsArray()
  @IsString({ each: true })
  items: string[];

  @IsOptional()
  @IsNumber()
  parallelism?: number;

  @IsOptional()
  stopOnError?: boolean;

  @IsOptional()
  generateReport?: boolean;
}

export class AuditExportDto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(['accept', 'reject', 'modify', 'ignore'])
  decisionType?: OverrideDecision;

  @IsOptional()
  @IsEnum(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx';
}

// ==========================================
// AGENT RESPONSE DTOs
// ==========================================

export class ReasoningStepDto {
  observation: string;
  inference: string;
  confidence: number;
  dataPoints: string[];
}

export class AlternativeInterpretationDto {
  interpretation: string;
  probability: number;
  checkQuestion: string;
}

export class ReasoningChainDto {
  steps: ReasoningStepDto[];
  conclusion: string;
  alternativeInterpretations?: AlternativeInterpretationDto[];
  showAlternativesProminent: boolean;
}

export class QualityIndicatorsDto {
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

export class ProvenanceInfoDto {
  type: string;
  source: string;
  recordId?: string;
  table?: string;
  hgbParagraph?: string;
  timestamp?: string;
  description?: string;
}

export class SuggestedActionDto {
  type: string;
  label: string;
  payload?: Record<string, any>;
  requiresConfirmation?: boolean;
}

export class OverrideOptionDto {
  id: string;
  label: string;
  requiresReasoning: boolean;
}

export class BatchResultDto {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  summary: string;
  reportUrl?: string;
  sessionId: string;
}

export class AgentResponseDto {
  success: boolean;
  message: string;
  reasoning?: ReasoningChainDto;
  quality?: QualityIndicatorsDto;
  provenance?: ProvenanceInfoDto[];
  suggestedAction?: SuggestedActionDto;
  overrideOptions?: OverrideOptionDto[];
  disclaimer?: string;
  data?: any;
  batchResult?: BatchResultDto;
  requiresModeChange?: boolean;
  auditLogId?: string;
}

export class ModeStatusDto {
  type: AgentModeType;
  activatedAt?: string;
  expiresAt?: string;
  remainingSeconds?: number;
}

export class AuditStatisticsDto {
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
