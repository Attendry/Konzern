import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompanyModule } from './modules/company/company.module';
import { FinancialStatementModule } from './modules/financial-statement/financial-statement.module';
import { ConsolidationModule } from './modules/consolidation/consolidation.module';
import { ImportModule } from './modules/import/import.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { HealthModule } from './modules/health/health.module';
import { ParticipationModule } from './modules/participation/participation.module';
import { LineageModule } from './modules/lineage/lineage.module';
import { ControlsModule } from './modules/controls/controls.module';
import { PolicyModule } from './modules/policy/policy.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    HealthModule, // Health-Check sollte immer verfügbar sein
    SupabaseModule,
    AuthModule, // Priority Feature: Authentication
    CompanyModule,
    FinancialStatementModule,
    ConsolidationModule,
    ImportModule,
    ParticipationModule,
    LineageModule, // Phase 4: Data Lineage + Prüfpfad
    ControlsModule, // Phase 4: Plausibility & Controls Engine
    PolicyModule, // Phase 4: Accounting Policy & Rules Layer
  ],
})
export class AppModule {}
