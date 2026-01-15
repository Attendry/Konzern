import { Module, forwardRef } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { ValidationService } from './validation.service';
import { MultiSheetImportService } from './multi-sheet-import.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { CompanyModule } from '../company/company.module';
import { ParticipationModule } from '../participation/participation.module';

@Module({
  imports: [
    SupabaseModule,
    CompanyModule,
    ParticipationModule,
  ],
  controllers: [ImportController],
  providers: [ImportService, ValidationService, MultiSheetImportService],
  exports: [ImportService, ValidationService, MultiSheetImportService],
})
export class ImportModule {}
