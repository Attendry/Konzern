import { Module, forwardRef } from '@nestjs/common';
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
// Phase 4 Services
import { KonzernanhangDocumentService } from './konzernanhang-document.service';
import { KonzernanhangExportService } from './konzernanhang-export.service';
import { KonzernanhangController } from './konzernanhang.controller';

import { SupabaseModule } from '../supabase/supabase.module';
import { CompanyModule } from '../company/company.module';
import { LineageModule } from '../lineage/lineage.module';

@Module({
  imports: [
    SupabaseModule,
    CompanyModule,
    forwardRef(() => LineageModule), // Phase 4: Data Lineage Integration
  ],
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
    // Phase 4 Controllers
    KonzernanhangController,
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
    // Phase 4 Services
    KonzernanhangDocumentService,
    KonzernanhangExportService,
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
    // Phase 4 Services
    KonzernanhangDocumentService,
    KonzernanhangExportService,
  ],
})
export class ConsolidationModule {}
