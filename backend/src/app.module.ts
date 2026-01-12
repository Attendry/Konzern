import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompanyModule } from './modules/company/company.module';
import { FinancialStatementModule } from './modules/financial-statement/financial-statement.module';
import { ConsolidationModule } from './modules/consolidation/consolidation.module';
import { ImportModule } from './modules/import/import.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),
    HealthModule, // Health-Check sollte immer verfügbar sein
    SupabaseModule,
    CompanyModule,
    FinancialStatementModule,
    ConsolidationModule,
    ImportModule,
  ],
})
export class AppModule {}
