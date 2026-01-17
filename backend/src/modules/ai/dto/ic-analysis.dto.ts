import { IsString, IsUUID } from 'class-validator';

export class ICExplainRequestDto {
  @IsUUID()
  reconciliationId: string;
}

export class BatchAnalyzeRequestDto {
  @IsUUID()
  financialStatementId: string;
}

export type ICCauseType =
  | 'timing'
  | 'fx'
  | 'rounding'
  | 'missing_entry'
  | 'error'
  | 'unknown';

export interface CorrectionEntry {
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
}

export interface ICExplanationDto {
  reconciliationId: string;
  explanation: string;
  likelyCause: ICCauseType;
  confidence: number;
  suggestedAction: string;
  correctionEntry?: CorrectionEntry;
}
