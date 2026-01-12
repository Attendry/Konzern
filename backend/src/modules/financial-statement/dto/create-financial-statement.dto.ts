import { IsUUID, IsInt, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { FinancialStatementStatus } from '../../../entities/financial-statement.entity';

export class CreateFinancialStatementDto {
  @IsUUID()
  companyId: string;

  @IsInt()
  fiscalYear: number;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsOptional()
  @IsEnum(FinancialStatementStatus)
  status?: FinancialStatementStatus;
}
