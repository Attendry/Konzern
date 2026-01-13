import { Module, forwardRef } from '@nestjs/common';
import { ControlsController } from './controls.controller';
import { PlausibilityService } from './plausibility.service';
import { VarianceAnalysisService } from './variance-analysis.service';
import { ExceptionReportingService } from './exception-reporting.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { ConsolidationModule } from '../consolidation/consolidation.module';

@Module({
  imports: [
    SupabaseModule,
    forwardRef(() => ConsolidationModule), // For AuditLogService
  ],
  controllers: [ControlsController],
  providers: [
    PlausibilityService,
    VarianceAnalysisService,
    ExceptionReportingService,
  ],
  exports: [
    PlausibilityService,
    VarianceAnalysisService,
    ExceptionReportingService,
  ],
})
export class ControlsModule {}
