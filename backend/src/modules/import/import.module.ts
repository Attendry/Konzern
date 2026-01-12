import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { ValidationService } from './validation.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ImportController],
  providers: [ImportService, ValidationService],
  exports: [ImportService, ValidationService],
})
export class ImportModule {}
