import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { AIModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    // Rate limiting: 100 requests per minute per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time window in milliseconds (1 minute)
        limit: 100, // Max requests per window
      },
    ]),
    HealthModule, // Health check should always be available
    SupabaseModule,
    AuthModule, // Authentication module
    CompanyModule,
    FinancialStatementModule,
    ConsolidationModule,
    ImportModule,
    ParticipationModule,
    LineageModule, // Data Lineage + Audit Trail
    ControlsModule, // Plausibility & Controls Engine
    PolicyModule, // Accounting Policy & Rules Layer
    AIModule, // AI Features: Chat + IC Analysis
  ],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
