import { IsUUID, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AdjustmentType } from '../../../entities/consolidation-entry.entity';

export class CreateConsolidationEntryDto {
  @IsUUID()
  financialStatementId: string;

  @IsUUID()
  accountId: string;

  @IsEnum(AdjustmentType)
  adjustmentType: AdjustmentType;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
