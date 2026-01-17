import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { DependencyIdentificationService } from './dependency-identification.service';
import { ParticipationService } from './participation.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CompanyController],
  providers: [
    CompanyService,
    DependencyIdentificationService,
    ParticipationService,
  ],
  exports: [
    CompanyService,
    DependencyIdentificationService,
    ParticipationService,
  ],
})
export class CompanyModule {}
