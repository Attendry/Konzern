# Implementation To-Do List

**Based on:** IMPLEMENTATION_PLAN.md  
**Created:** 2026-01-XX  
**Status:** Ready for Implementation

---

## HIGH PRIORITY (Weeks 1-20)

### 1. Data Lineage Tracking + Prüfpfad-Dokumentation (3-4 weeks) ✅ COMPLETED

#### Backend
- [x] **1.1** Create database migration for data lineage + audit trail
  - File: `database/migrations/004_data_lineage_audit_trail.sql`
  - Effort: 1.5 days

- [x] **1.2** Create TypeORM entities (DataLineage, LineageTrace)
  - Files: `backend/src/entities/data-lineage-node.entity.ts`, `data-lineage-trace.entity.ts`, `pruefpfad-documentation.entity.ts`, `audit-evidence.entity.ts`
  - Effort: 1 day

- [x] **1.3** Create lineage service with audit trail
  - File: `backend/src/modules/lineage/lineage.service.ts`
  - Effort: 4 days

- [x] **1.4** Integrate lineage tracking into consolidation with audit trail
  - File: `backend/src/modules/lineage/lineage-integration.service.ts`
  - Effort: 4 days

- [x] **1.5** Create lineage controller with audit export
  - File: `backend/src/modules/lineage/lineage.controller.ts`
  - Effort: 1.5 days

#### Frontend
- [x] **1.6** Create lineage visualization UI with audit trail
  - Files: `frontend/src/pages/DataLineage.tsx`, `frontend/src/services/lineageService.ts`
  - Effort: 5 days

- [ ] **1.7** Add lineage to consolidation review
  - Effort: 2 days

#### Testing
- [ ] **1.8** Write unit tests for lineage service
  - Effort: 2 days

- [ ] **1.9** Write integration tests
  - Effort: 1 day

#### Documentation
- [ ] **1.10** Document data lineage and audit trail
  - Effort: 1.5 days

---

### 2. Konzernanhang-Generierung (HGB § 313-314) - Enhanced (2-3 weeks) ✅ COMPLETED

#### Backend
- [x] **2.1** Enhance database schema for audit trail
  - File: `database/migrations/005_konzernanhang_audit_trail.sql`
  - Effort: 1 day

- [x] **2.2** Enhance ConsolidatedNotesService
  - File: `backend/src/modules/consolidation/konzernanhang-document.service.ts`
  - Effort: 3 days

- [x] **2.3** Create export service for audit formats
  - File: `backend/src/modules/consolidation/konzernanhang-export.service.ts`
  - Effort: 3 days

- [x] **2.4** Enhance ConsolidatedNotesController
  - File: `backend/src/modules/consolidation/konzernanhang.controller.ts`
  - Effort: 1 day

#### Frontend
- [x] **2.5** Enhance ConsolidatedNotes page
  - Files: `frontend/src/pages/KonzernanhangPage.tsx`, `frontend/src/services/konzernanhangService.ts`
  - Effort: 2 days

#### Testing
- [ ] **2.6** Write unit tests for enhanced service
  - Effort: 2 days

- [ ] **2.7** Write integration tests
  - Effort: 1 day

#### Documentation
- [ ] **2.8** Document Konzernanhang system
  - Effort: 1 day

---

### 3. Plausibility & Controls Engine (HGB-Specific) (2-3 weeks)

#### Backend
- [ ] **3.1** Create database migration for plausibility rules (HGB-specific)
  - File: `database/migrations/007_plausibility_controls.sql`
  - Effort: 2 days

- [ ] **3.2** Create TypeORM entities (PlausibilityRule, PlausibilityCheck, VarianceAnalysis, ExceptionReport)
  - Effort: 1 day

- [ ] **3.3** Create plausibility service
  - File: `backend/src/modules/controls/plausibility.service.ts`
  - Effort: 3 days

- [ ] **3.4** Create variance analysis service
  - File: `backend/src/modules/controls/variance-analysis.service.ts`
  - Effort: 2 days

- [ ] **3.5** Create exception reporting service
  - File: `backend/src/modules/controls/exception-reporting.service.ts`
  - Effort: 2 days

- [ ] **3.6** Create plausibility controller
  - File: `backend/src/modules/controls/controls.controller.ts`
  - Effort: 1 day

- [ ] **3.7** Seed default plausibility rules (HGB-specific)
  - File: `database/seeds/004_plausibility_rules_hgb_seed.sql`
  - Effort: 1.5 days

- [ ] **3.8** Integrate HGB-specific plausibility checks into consolidation workflow
  - Effort: 1.5 days

#### Frontend
- [ ] **3.9** Create plausibility checks UI (HGB-focused)
  - File: `frontend/src/pages/PlausibilityChecks.tsx`
  - Effort: 3 days

- [ ] **3.10** Add plausibility indicators to consolidation workflow
  - Effort: 1 day

#### Testing
- [ ] **3.11** Write unit tests for plausibility service
  - Effort: 2 days

- [ ] **3.12** Write integration tests
  - Effort: 1 day

#### Documentation
- [ ] **3.13** Document plausibility system (HGB-focused)
  - Effort: 1 day

---

### 4. Accounting Policy & Rules Layer (with HGB Restrictions) (3-4 weeks) ✅ COMPLETED

#### Backend
- [x] **4.1** Create database migration for policy & rules (with HGB restrictions)
  - File: `database/migrations/006_policy_rules_layer_hgb.sql`
  - Effort: 2 days

- [x] **4.2** Create TypeORM entities (AccountingPolicy, ConsolidationRule, GaapHgbMapping, PolicyVersion)
  - Files: `backend/src/entities/accounting-policy.entity.ts`, `consolidation-rule.entity.ts`, `gaap-hgb-mapping.entity.ts`, `hgb-wahlrecht.entity.ts`
  - Effort: 1 day

- [x] **4.3** Create policy service (with HGB restrictions)
  - File: `backend/src/modules/policy/policy.service.ts`
  - Effort: 3 days

- [x] **4.4** Create rules engine service
  - File: `backend/src/modules/policy/rules-engine.service.ts`
  - Effort: 3 days

- [x] **4.5** Create GAAP→HGB mapping service
  - File: `backend/src/modules/policy/gaap-hgb-mapping.service.ts`
  - Effort: 2 days

- [x] **4.6** Create policy controller
  - File: `backend/src/modules/policy/policy.controller.ts`
  - Effort: 2 days

- [x] **4.7** Seed default policies and rules (HGB-mandatory marked)
  - File: `database/seeds/003_policy_rules_hgb_seed.sql`
  - Effort: 2.5 days

- [ ] **4.7b** Refactor consolidation services to use rules engine (HGB-mandatory rules enforced)
  - Effort: 4 days

#### Frontend
- [x] **4.8** Create policy management UI (with HGB restrictions)
  - Files: `frontend/src/pages/PolicyManagement.tsx`, `frontend/src/pages/PolicyManagement.css`, `frontend/src/services/policyService.ts`
  - Effort: 3 days
  - Note: Includes all three UIs (policies, rules, mappings) in a tabbed interface

#### Testing
- [ ] **4.9** Write unit tests for policy service
  - Effort: 2 days

- [ ] **4.10** Write unit tests for rules engine
  - Effort: 2 days

- [ ] **4.11** Write integration tests
  - Effort: 2 days

#### Documentation
- [ ] **4.12** Document policy & rules layer (HGB restrictions)
  - Effort: 2 days

---

### 5. Close Calendar Orchestration (with HGB Deadlines) (2-3 weeks)

#### Backend
- [ ] **5.1** Create database migration for close calendar (with HGB deadlines)
  - File: `database/migrations/009_close_calendar.sql`
  - Effort: 1 day

- [ ] **5.2** Create TypeORM entities (CloseCalendar, CloseTask, CloseTaskDependency)
  - Effort: 1 day

- [ ] **5.3** Create close calendar service (with HGB deadlines)
  - File: `backend/src/modules/close/close-calendar.service.ts`
  - Effort: 3 days

- [ ] **5.4** Create close calendar controller
  - File: `backend/src/modules/close/close-calendar.controller.ts`
  - Effort: 1 day

- [ ] **5.5** Create default close calendar templates (with HGB deadlines)
  - File: `database/seeds/005_close_calendar_hgb_templates.sql`
  - Effort: 1.5 days

- [ ] **5.6** Integrate close calendar with consolidation workflow (HGB deadlines)
  - Effort: 2 days

#### Frontend
- [ ] **5.7** Create close calendar UI (with HGB deadlines)
  - File: `frontend/src/pages/CloseCalendar.tsx`
  - Effort: 4 days

- [ ] **5.8** Add close calendar to consolidation workflow
  - Effort: 2 days

#### Testing
- [ ] **5.9** Write unit tests for close calendar service
  - Effort: 2 days

- [ ] **5.10** Write integration tests
  - Effort: 1 day

#### Documentation
- [ ] **5.11** Document close calendar
  - Effort: 1 day

---

### 6. Data Intake & Reporting Packages (with Audit Trail) (3-4 weeks)

#### Backend
- [ ] **6.1** Create database migration for reporting packages (with audit trail)
  - File: `database/migrations/008_reporting_packages_audit.sql`
  - Effort: 2 days

- [ ] **6.2** Create TypeORM entities (ReportingPackage, PackageSubmission, PackageValidation, PackageReconciliation)
  - Effort: 1 day

- [ ] **6.3** Create package service (with audit trail)
  - File: `backend/src/modules/packages/package.service.ts`
  - Effort: 3 days

- [ ] **6.4** Create package validation service
  - File: `backend/src/modules/packages/package-validation.service.ts`
  - Effort: 2 days

- [ ] **6.5** Create package reconciliation service
  - File: `backend/src/modules/packages/package-reconciliation.service.ts`
  - Effort: 2 days

- [ ] **6.6** Create package controller
  - File: `backend/src/modules/packages/package.controller.ts`
  - Effort: 2 days

- [ ] **6.7** Refactor import service to use packages
  - Effort: 2 days

#### Frontend
- [ ] **6.8** Create package management UI (with audit trail)
  - File: `frontend/src/pages/PackageManagement.tsx`
  - Effort: 4 days

- [ ] **6.9** Update import workflow to use packages
  - Effort: 2 days

- [ ] **6.10** Add package status indicators
  - Effort: 2 days

#### Testing
- [ ] **6.11** Write unit tests for package service
  - Effort: 2 days

- [ ] **6.12** Write integration tests
  - Effort: 2 days

#### Documentation
- [ ] **6.13** Document package system (with audit trail)
  - Effort: 1 day

---

## MEDIUM PRIORITY (Weeks 21-38)

### 7. Stichtagsverschiebungen (HGB § 299) - NEW (2-3 weeks)

#### Backend
- [ ] **7.1** Create database migration for fiscal year shifts
  - File: `database/migrations/012_fiscal_year_shifts.sql`
  - Effort: 1 day

- [ ] **7.2** Create TypeORM entities (FiscalYearShift, update Company)
  - Effort: 0.5 days

- [ ] **7.3** Create fiscal year shift service
  - File: `backend/src/modules/consolidation/fiscal-year-shift.service.ts`
  - Effort: 2 days

- [ ] **7.4** Create time period mapping service
  - File: `backend/src/modules/consolidation/time-period-mapping.service.ts`
  - Effort: 2 days

- [ ] **7.5** Create fiscal year shift controller
  - File: `backend/src/modules/consolidation/fiscal-year-shift.controller.ts`
  - Effort: 1 day

#### Frontend
- [ ] **7.6** Create fiscal year shift UI
  - File: `frontend/src/pages/FiscalYearShifts.tsx`
  - Effort: 3 days

#### Testing
- [ ] **7.7** Write unit tests
  - Effort: 1.5 days

#### Documentation
- [ ] **7.8** Document fiscal year shifts
  - Effort: 0.5 days

---

### 8. Währungsumrechnung-UI (HGB § 308a) - Enhanced (1-2 weeks)

#### Backend
- [ ] **8.1** Enhance exchange rate tables with audit trail
  - File: `database/migrations/013_fx_audit_trail.sql`
  - Effort: 0.5 days

- [ ] **8.2** Enhance exchange rate service
  - File: `backend/src/modules/consolidation/exchange-rate.service.ts`
  - Effort: 1.5 days

- [ ] **8.3** Create FX translation controller
  - File: `backend/src/modules/consolidation/fx-translation.controller.ts`
  - Effort: 1 day

#### Frontend
- [ ] **8.4** Create FX translation UI
  - File: `frontend/src/pages/FxTranslation.tsx`
  - Effort: 3 days

#### Testing
- [ ] **8.5** Write unit tests
  - Effort: 1 day

#### Documentation
- [ ] **8.6** Document FX translation
  - Effort: 0.5 days

---

### 9. Konzernlagebericht (HGB § 315) - Moved from Low (2-3 weeks)

#### Backend
- [ ] **9.1** Create database migration for Lagebericht
  - File: `database/migrations/014_konzernlagebericht.sql`
  - Effort: 1 day

- [ ] **9.2** Create Lagebericht service
  - File: `backend/src/modules/consolidation/management-report.service.ts`
  - Effort: 3 days

- [ ] **9.3** Create narrative generation service
  - File: `backend/src/modules/consolidation/narrative-generation.service.ts`
  - Effort: 3 days

- [ ] **9.4** Create management report controller
  - File: `backend/src/modules/consolidation/management-report.controller.ts`
  - Effort: 1 day

#### Frontend
- [ ] **9.5** Create Lagebericht UI
  - File: `frontend/src/pages/ManagementReport.tsx`
  - Effort: 3 days

#### Testing
- [ ] **9.6** Write unit tests
  - Effort: 1.5 days

#### Documentation
- [ ] **9.7** Document Lagebericht
  - Effort: 0.5 days

---

### 10. ERP Integration Patterns (4-5 weeks)

#### Backend
- [ ] **10.1** Create database migration for ERP integrations
  - File: `database/migrations/011_erp_integration.sql`
  - Effort: 1 day

- [ ] **10.2** Create TypeORM entities (ErpConnection, ErpSyncJob, DataQualityRule, DataQualityCheck)
  - Effort: 1 day

- [ ] **10.3** Create ERP integration service (abstract)
  - File: `backend/src/modules/integration/erp-integration.service.ts`
  - Effort: 2 days

- [ ] **10.4** Create SAP integration service
  - File: `backend/src/modules/integration/sap-integration.service.ts`
  - Effort: 3 days

- [ ] **10.5** Create Oracle integration service
  - File: `backend/src/modules/integration/oracle-integration.service.ts`
  - Effort: 3 days

- [ ] **10.6** Create NetSuite integration service
  - File: `backend/src/modules/integration/netsuite-integration.service.ts`
  - Effort: 3 days

- [ ] **10.7** Create data quality service
  - File: `backend/src/modules/integration/data-quality.service.ts`
  - Effort: 2 days

- [ ] **10.8** Create integration controller
  - File: `backend/src/modules/integration/integration.controller.ts`
  - Effort: 2 days

- [ ] **10.9** Seed default data quality rules
  - File: `database/seeds/006_data_quality_rules_seed.sql`
  - Effort: 1 day

#### Frontend
- [ ] **10.10** Create ERP integration UI
  - File: `frontend/src/pages/ErpIntegration.tsx`
  - Effort: 4 days

#### Testing
- [ ] **10.11** Write unit tests for integration services
  - Effort: 3 days

- [ ] **10.12** Write integration tests
  - Effort: 2 days

#### Documentation
- [ ] **10.13** Document ERP integration
  - Effort: 2 days

---

## LOW PRIORITY (Defer)

### 11. RBAC (Role-Based Access Control) System (3-4 weeks)
**When to implement:** When adding multiple users with different permission levels

### 12. Controls & Governance Framework (4-5 weeks)
**When to implement:** When audit compliance requires formal control framework documentation

### 13. Event-Driven Architecture (3-4 weeks)
**When to implement:** When scaling to multiple concurrent users

---

## Summary

### High Priority: 16-20 weeks
- Data Lineage + Prüfpfad-Dokumentation
- Konzernanhang-Generierung
- Plausibility & Controls Engine
- Accounting Policy & Rules Layer
- Close Calendar Orchestration
- Data Intake & Reporting Packages

### Medium Priority: 16-22 weeks
- Stichtagsverschiebungen
- Währungsumrechnung-UI
- Konzernlagebericht
- ERP Integration Patterns

### Low Priority: Defer
- RBAC System
- Controls & Governance Framework
- Event-Driven Architecture

**Total Estimated Timeline:** 38 weeks (~9.5 months) for high and medium priority

---

**Last Updated:** 2026-01-XX  
**Next Review:** After Phase 1 completion
