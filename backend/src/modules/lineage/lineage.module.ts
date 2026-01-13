import { Module, forwardRef } from '@nestjs/common';
import { LineageService } from './lineage.service';
import { LineageIntegrationService } from './lineage-integration.service';
import { LineageController } from './lineage.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { ConsolidationModule } from '../consolidation/consolidation.module';

@Module({
  imports: [
    SupabaseModule,
    forwardRef(() => ConsolidationModule), // Circular dependency with ConsolidationModule
  ],
  controllers: [LineageController],
  providers: [LineageService, LineageIntegrationService],
  exports: [LineageService, LineageIntegrationService],
})
export class LineageModule {}
