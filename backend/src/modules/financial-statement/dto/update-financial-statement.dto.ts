import { PartialType } from '@nestjs/mapped-types';
import { CreateFinancialStatementDto } from './create-financial-statement.dto';

export class UpdateFinancialStatementDto extends PartialType(
  CreateFinancialStatementDto,
) {}
