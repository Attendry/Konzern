import { IsString, IsOptional, IsBoolean, IsUUID, IsNumber, Min, Max } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  legalForm?: string;

  @IsOptional()
  @IsUUID()
  parentCompanyId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  participationPercentage?: number;

  @IsOptional()
  @IsBoolean()
  isConsolidated?: boolean;
}
