import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsEnum,
} from 'class-validator';

export class CreateParticipationDto {
  @IsUUID()
  parentCompanyId: string;

  @IsUUID()
  subsidiaryCompanyId: string;

  @IsNumber()
  participationPercentage: number;

  @IsOptional()
  @IsNumber()
  votingRightsPercentage?: number;

  @IsOptional()
  @IsNumber()
  acquisitionCost?: number;

  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @IsOptional()
  @IsNumber()
  goodwill?: number;

  @IsOptional()
  @IsNumber()
  negativeGoodwill?: number;

  @IsOptional()
  @IsNumber()
  hiddenReserves?: number;

  @IsOptional()
  @IsNumber()
  hiddenLiabilities?: number;

  @IsOptional()
  @IsNumber()
  equityAtAcquisition?: number;

  @IsOptional()
  @IsBoolean()
  isDirect?: boolean;

  @IsOptional()
  @IsUUID()
  throughCompanyId?: string;
}

export class UpdateParticipationDto {
  @IsOptional()
  @IsNumber()
  participationPercentage?: number;

  @IsOptional()
  @IsNumber()
  votingRightsPercentage?: number;

  @IsOptional()
  @IsNumber()
  acquisitionCost?: number;

  @IsOptional()
  @IsNumber()
  goodwill?: number;

  @IsOptional()
  @IsNumber()
  negativeGoodwill?: number;

  @IsOptional()
  @IsNumber()
  hiddenReserves?: number;

  @IsOptional()
  @IsNumber()
  hiddenLiabilities?: number;

  @IsOptional()
  @IsNumber()
  equityAtAcquisition?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  disposalDate?: string;

  @IsOptional()
  @IsNumber()
  disposalProceeds?: number;
}

export type OwnershipChangeType =
  | 'initial'
  | 'increase'
  | 'decrease'
  | 'full_sale'
  | 'merger'
  | 'demerger';

export class RecordOwnershipChangeDto {
  @IsEnum([
    'initial',
    'increase',
    'decrease',
    'full_sale',
    'merger',
    'demerger',
  ])
  changeType: OwnershipChangeType;

  @IsDateString()
  effectiveDate: string;

  @IsNumber()
  percentageBefore: number;

  @IsNumber()
  percentageAfter: number;

  @IsOptional()
  @IsNumber()
  transactionAmount?: number;

  @IsOptional()
  @IsNumber()
  goodwillChange?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  consolidationEntryId?: string;
}
