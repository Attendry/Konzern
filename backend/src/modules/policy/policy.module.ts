import { Module, forwardRef } from '@nestjs/common';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';
import { RulesEngineService } from './rules-engine.service';
import { GaapHgbMappingService } from './gaap-hgb-mapping.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { ConsolidationModule } from '../consolidation/consolidation.module';

@Module({
  imports: [
    SupabaseModule,
    forwardRef(() => ConsolidationModule), // For AuditLogService
  ],
  controllers: [PolicyController],
  providers: [
    PolicyService,
    RulesEngineService,
    GaapHgbMappingService,
  ],
  exports: [
    PolicyService,
    RulesEngineService,
    GaapHgbMappingService,
  ],
})
export class PolicyModule {}
