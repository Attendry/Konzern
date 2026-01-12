import { IsUUID, IsEnum, IsNumber, IsOptional, IsString, IsArray } from 'class-validator';
import { 
  AdjustmentType, 
  EntryStatus, 
  EntrySource, 
  HgbReference 
} from '../../../entities/consolidation-entry.entity';

export class CreateConsolidationEntryDto {
  @IsUUID()
  financialStatementId: string;

  // Legacy field - optional for backward compatibility
  @IsOptional()
  @IsUUID()
  accountId?: string;

  // Double-entry bookkeeping
  @IsOptional()
  @IsUUID()
  debitAccountId?: string;

  @IsOptional()
  @IsUUID()
  creditAccountId?: string;

  @IsEnum(AdjustmentType)
  adjustmentType: AdjustmentType;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(EntrySource)
  source?: EntrySource;

  @IsOptional()
  @IsEnum(HgbReference)
  hgbReference?: HgbReference;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  affectedCompanyIds?: string[];

  @IsOptional()
  @IsUUID()
  createdByUserId?: string;
}

export class UpdateConsolidationEntryDto {
  @IsOptional()
  @IsUUID()
  debitAccountId?: string;

  @IsOptional()
  @IsUUID()
  creditAccountId?: string;

  @IsOptional()
  @IsEnum(AdjustmentType)
  adjustmentType?: AdjustmentType;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(HgbReference)
  hgbReference?: HgbReference;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  affectedCompanyIds?: string[];
}

export class ApproveEntryDto {
  @IsUUID()
  approvedByUserId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class RejectEntryDto {
  @IsUUID()
  rejectedByUserId: string;

  @IsString()
  reason: string;
}

export class FilterConsolidationEntriesDto {
  @IsOptional()
  @IsEnum(AdjustmentType)
  adjustmentType?: AdjustmentType;

  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;

  @IsOptional()
  @IsEnum(EntrySource)
  source?: EntrySource;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
