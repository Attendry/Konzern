import { IsString, IsUUID, IsOptional } from 'class-validator';

export class ImportDataDto {
  @IsUUID()
  financialStatementId: string;

  @IsString()
  fileType: 'excel' | 'csv';

  @IsOptional()
  @IsString()
  sheetName?: string; // Für Excel
}
