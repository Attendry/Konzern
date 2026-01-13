import { Module } from '@nestjs/common';
import { ConsolidationService } from './consolidation.service';
import { ConsolidationController } from './consolidation.controller';
import { ConsolidationObligationController } from './consolidation-obligation.controller';
import { IncomeStatementConsolidationController } from './income-statement-consolidation.controller';
import { ConsolidatedNotesController } from './consolidated-notes.controller';
import { ExchangeRateController } from './exchange-rate.controller';
import { FirstConsolidationController } from './first-consolidation.controller';
// Phase 3 Controllers
import { DeferredTaxController } from './deferred-tax.controller';
import { AuditLogController } from './audit-log.controller';
import { ComplianceController } from './compliance.controller';
import { EquityMethodController } from './equity-method.controller';
import { ProportionalConsolidationController } from './proportional-consolidation.controller';

import { IntercompanyTransactionService } from './intercompany-transaction.service';
import { DebtConsolidationService } from './debt-consolidation.service';
import { CapitalConsolidationService } from './capital-consolidation.service';
import { ConsolidatedBalanceSheetService } from './consolidated-balance-sheet.service';
import { ConsolidationValidationService } from './consolidation-validation.service';
import { ReportingService } from './reporting.service';
import { ExportService } from './export.service';
import { ConsolidationObligationService } from './consolidation-obligation.service';
import { IncomeStatementConsolidationService } from './income-statement-consolidation.service';
import { ConsolidatedNotesService } from './consolidated-notes.service';
import { ExchangeRateService } from './exchange-rate.service';
import { ExchangeRateFetcherService } from './exchange-rate-fetcher.service';
import { FirstConsolidationService } from './first-consolidation.service';
// Phase 3 Services
import { DeferredTaxService } from './deferred-tax.service';
import { AuditLogService } from './audit-log.service';
import { ComplianceChecklistService } from './compliance-checklist.service';
import { EquityMethodService } from './equity-method.service';
import { ProportionalConsolidationService } from './proportional-consolidation.service';

import { SupabaseModule } from '../supabase/supabase.module';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [SupabaseModule, CompanyModule],
  controllers: [
    ConsolidationController,
    ConsolidationObligationController,
    IncomeStatementConsolidationController,
    ConsolidatedNotesController,
    ExchangeRateController,
    FirstConsolidationController,
    // Phase 3 Controllers
    DeferredTaxController,
    AuditLogController,
    ComplianceController,
    EquityMethodController,
    ProportionalConsolidationController,
  ],
  providers: [
    ConsolidationService,
    IntercompanyTransactionService,
    DebtConsolidationService,
    CapitalConsolidationService,
    ConsolidatedBalanceSheetService,
    ConsolidationValidationService,
    ReportingService,
    ExportService,
    ConsolidationObligationService,
    IncomeStatementConsolidationService,
    ConsolidatedNotesService,
    ExchangeRateService,
    ExchangeRateFetcherService,
    FirstConsolidationService,
    // Phase 3 Services
    DeferredTaxService,
    AuditLogService,
    ComplianceChecklistService,
    EquityMethodService,
    ProportionalConsolidationService,
  ],
  exports: [
    ConsolidationService,
    IntercompanyTransactionService,
    DebtConsolidationService,
    CapitalConsolidationService,
    ConsolidatedBalanceSheetService,
    ConsolidationValidationService,
    ReportingService,
    ExportService,
    ConsolidationObligationService,
    IncomeStatementConsolidationService,
    ConsolidatedNotesService,
    ExchangeRateService,
    ExchangeRateFetcherService,
    FirstConsolidationService,
    // Phase 3 Services
    DeferredTaxService,
    AuditLogService,
    ComplianceChecklistService,
    EquityMethodService,
    ProportionalConsolidationService,
  ],
})
export class ConsolidationModule {}
