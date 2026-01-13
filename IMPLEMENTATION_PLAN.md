# Implementation Plan: Consultant Recommendations

**Based on:** CONSULTANT_GAP_ANALYSIS.md  
**Created:** 2026-01-XX  
**Status:** Planning Phase

---

## Overview

This implementation plan translates the gap analysis recommendations into actionable tasks organized by priority. Each priority level includes detailed to-do lists with estimated effort, dependencies, and acceptance criteria.

---

## Priority Levels

- **HIGH PRIORITY:** Critical for usability, error detection, and workflow efficiency (single-user focused)
- **MEDIUM PRIORITY:** Important for data quality, integration, and advanced features
- **LOW PRIORITY:** Enterprise-grade features (RBAC, complex governance) - defer for multi-user scenarios

---

## HIGH PRIORITY IMPLEMENTATION PLAN

### Estimated Timeline: 16-20 weeks

**Focus:** Usability, transparency, error detection, HGB compliance, and audit readiness (Wirtschaftsprüfer perspective)

**Note:** This plan incorporates HGB-specific requirements and audit trail needs for Wirtschaftsprüfer (German auditor) workflows.

---

### 1. Data Lineage Tracking + Prüfpfad-Dokumentation

**Goal:** Implement comprehensive data lineage from source to consolidated numbers with drill-down capabilities AND audit trail documentation (Prüfungsnachweis).

**Business Value:** Transparency, error tracing, audit readiness (IDW PS 240), understanding where numbers come from (critical for single-user workflow and audit)

**HGB/IDW Relevance:** IDW Prüfungsstandard 240 (Prüfungsnachweise) - every number must be traceable

**Estimated Effort:** 3-4 weeks (enhanced with audit trail)

#### To-Do List

##### Backend Tasks

- [ ] **1.1** Create database migration for data lineage + audit trail
  - [ ] Create `data_lineage` table (id, consolidated_value_id, source_type, source_id, source_value, transformation_type, transformation_rule_id, adjustment_entry_id, lineage_path_json, source_document_id, source_document_version, transformation_rationale, hgb_reference, created_at)
  - [ ] Create `lineage_trace` table (id, financial_statement_id, account_id, consolidated_amount, source_amount, adjustment_amount, trace_path_json, created_at)
  - [ ] Create `audit_trail_exports` table (id, financial_statement_id, export_type, exported_at, exported_by_user_id, file_path, created_at)
  - [ ] Add foreign key to `document_attachments` for source_document_id
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/004_data_lineage_audit_trail.sql`
  - **Effort:** 1.5 days

- [ ] **1.2** Create TypeORM entities
  - [ ] `DataLineage` entity (`backend/src/entities/data-lineage.entity.ts`)
  - [ ] `LineageTrace` entity (`backend/src/entities/lineage-trace.entity.ts`)
  - **Effort:** 1 day

- [ ] **1.3** Create lineage service with audit trail
  - [ ] `LineageService` with methods:
    - [ ] `traceConsolidatedValue(accountId, financialStatementId)` - Trace consolidated value to sources
    - [ ] `traceSourceValue(sourceId, sourceType)` - Trace source value to consolidated
    - [ ] `buildLineagePath(consolidatedValueId)` - Build complete lineage path
    - [ ] `getLineageForAccount(accountId, financialStatementId)` - Get lineage for account
    - [ ] `recordLineage(consolidatedValueId, sourceData, transformations, sourceDocumentId, hgbReference)` - Record lineage with audit trail
    - [ ] `exportAuditTrail(financialStatementId, exportType)` - Export audit trail (Excel/PDF) for external audit
    - [ ] `getAuditTrailForConsolidation(financialStatementId)` - Get complete audit trail
  - **File:** `backend/src/modules/lineage/lineage.service.ts`
  - **Effort:** 4 days

- [ ] **1.4** Integrate lineage tracking into consolidation with audit trail
  - [ ] Record lineage when creating consolidation entries
  - [ ] Link source balances to consolidated balances
  - [ ] Track transformations (adjustments, eliminations) with HGB references
  - [ ] Link source documents (Excel files, ERP exports) to lineage
  - [ ] Record transformation rationale (why adjustment was made)
  - [ ] Build lineage path during consolidation
  - [ ] Store document versions and timestamps
  - **Effort:** 4 days

- [ ] **1.5** Create lineage controller with audit export
  - [ ] `GET /api/lineage/trace/:accountId/:financialStatementId` - Trace consolidated value
  - [ ] `GET /api/lineage/source/:sourceId/:sourceType` - Trace source value
  - [ ] `GET /api/lineage/path/:consolidatedValueId` - Get lineage path
  - [ ] `GET /api/lineage/account/:accountId/:financialStatementId` - Get account lineage
  - [ ] `GET /api/lineage/audit-trail/:financialStatementId` - Get complete audit trail
  - [ ] `POST /api/lineage/audit-trail/:financialStatementId/export` - Export audit trail (Excel/PDF)
  - **File:** `backend/src/modules/lineage/lineage.controller.ts`
  - **Effort:** 1.5 days

##### Frontend Tasks

- [ ] **1.6** Create lineage visualization UI with audit trail
  - [ ] Lineage trace viewer (`frontend/src/pages/DataLineage.tsx`)
  - [ ] Drill-down from consolidated to source
  - [ ] Transformation visualization with HGB references
  - [ ] Lineage path tree view
  - [ ] Source document links and versions
  - [ ] Audit trail export button (Excel/PDF)
  - [ ] Prüfungsnachweis view (audit trail view)
  - **Effort:** 5 days

- [ ] **1.7** Add lineage to consolidation review
  - [ ] Show lineage link for each consolidated value
  - [ ] Enable drill-down from consolidated balance sheet
  - [ ] Show transformation details
  - **Effort:** 2 days

##### Testing

- [ ] **1.8** Write unit tests for lineage service
  - [ ] Test lineage recording
  - [ ] Test lineage tracing
  - [ ] Test path building
  - **Effort:** 2 days

- [ ] **1.9** Write integration tests
  - [ ] Test lineage during consolidation
  - [ ] Test drill-down functionality
  - [ ] Test transformation tracking
  - **Effort:** 1 day

##### Documentation

- [ ] **1.10** Document data lineage and audit trail
  - [ ] Lineage system documentation
  - [ ] Drill-down procedures
  - [ ] Transformation tracking guide
  - [ ] Audit trail export procedures (for Wirtschaftsprüfer)
  - [ ] Prüfungsnachweis documentation (IDW PS 240)
  - **Effort:** 1.5 days

**Total Effort:** ~3-4 weeks (enhanced with audit trail)

---

### 2. Konzernanhang-Generierung (HGB § 313-314) - Enhanced

**Goal:** Enhance existing ConsolidatedNotesService with audit trail, versioning, and comprehensive HGB § 313-314 coverage for audit readiness.

**Business Value:** HGB compliance, audit readiness, automatic generation of legally required disclosures (critical for Wirtschaftsprüfer)

**HGB Relevance:** § 313-314 HGB (Pflichtangaben im Konzernanhang) - legally required, missing disclosures = audit qualification

**Estimated Effort:** 2-3 weeks (enhancement of existing implementation)

#### To-Do List

##### Backend Tasks

- [ ] **2.1** Enhance database schema for audit trail
  - [ ] Add columns to consolidated_notes: `audit_trail JSONB`, `generated_at TIMESTAMPTZ`, `generated_by_user_id UUID`, `version INTEGER`
  - [ ] Create `consolidated_notes_versions` table (id, consolidated_note_id, version, content_json, changes_description, created_at, created_by_user_id)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/005_konzernanhang_audit_trail.sql`
  - **Effort:** 1 day

- [ ] **2.2** Enhance ConsolidatedNotesService
  - [ ] `generateWithAuditTrail(financialStatementId, userId)` - Generate with audit trail
  - [ ] `getVersionHistory(consolidatedNoteId)` - Get version history
  - [ ] `createVersion(consolidatedNoteId, changesDescription, userId)` - Create new version
  - [ ] `exportForAudit(financialStatementId, format)` - Export for audit (Word/PDF with audit trail)
  - [ ] Ensure complete coverage of all § 313 requirements:
    - [ ] § 313 Abs. 1 Nr. 1: Konsolidierungskreis (complete)
    - [ ] § 313 Abs. 1 Nr. 2: Konsolidierungsmethoden (complete)
    - [ ] § 313 Abs. 1 Nr. 3: Goodwill-Aufschlüsselung (enhance per subsidiary)
    - [ ] § 313 Abs. 1 Nr. 4: Minderheitsanteile (enhance per subsidiary)
    - [ ] § 313 Abs. 1 Nr. 5: Zwischengesellschaftsgeschäfte (complete)
    - [ ] § 313 Abs. 2: Bilanzierungs- und Bewertungsmethoden (enhance)
  - **File:** `backend/src/modules/consolidation/consolidated-notes.service.ts`
  - **Effort:** 3 days

- [ ] **2.3** Create export service for audit formats
  - [ ] `exportToWord(financialStatementId, templateId)` - Word export with audit trail
  - [ ] `exportToPdf(financialStatementId)` - PDF export with audit trail
  - [ ] `exportToXbrl(financialStatementId)` - XBRL export (for electronic filing)
  - [ ] Include audit trail metadata in exports
  - **File:** `backend/src/modules/consolidation/consolidated-notes-export.service.ts`
  - **Effort:** 3 days

- [ ] **2.4** Enhance ConsolidatedNotesController
  - [ ] `GET /api/consolidation/notes/:financialStatementId` - Get notes (existing)
  - [ ] `POST /api/consolidation/notes/:financialStatementId/generate` - Generate with audit trail
  - [ ] `GET /api/consolidation/notes/:id/versions` - Get version history
  - [ ] `POST /api/consolidation/notes/:id/versions` - Create new version
  - [ ] `GET /api/consolidation/notes/:financialStatementId/export/word` - Word export
  - [ ] `GET /api/consolidation/notes/:financialStatementId/export/pdf` - PDF export
  - [ ] `GET /api/consolidation/notes/:financialStatementId/export/xbrl` - XBRL export
  - **File:** `backend/src/modules/consolidation/consolidated-notes.controller.ts`
  - **Effort:** 1 day

##### Frontend Tasks

- [ ] **2.5** Enhance ConsolidatedNotes page
  - [ ] Show version history
  - [ ] Display audit trail information
  - [ ] Add export buttons (Word, PDF, XBRL)
  - [ ] Show generation timestamp and user
  - [ ] Add "Generate with Audit Trail" button
  - **File:** `frontend/src/pages/ConsolidatedNotes.tsx`
  - **Effort:** 2 days

##### Testing

- [ ] **2.6** Write unit tests for enhanced service
  - [ ] Test audit trail generation
  - [ ] Test versioning
  - [ ] Test export functions
  - [ ] Test HGB § 313 completeness
  - **Effort:** 2 days

- [ ] **2.7** Write integration tests
  - [ ] Test complete workflow with audit trail
  - [ ] Test export formats
  - [ ] Test version history
  - **Effort:** 1 day

##### Documentation

- [ ] **2.8** Document Konzernanhang system
  - [ ] HGB § 313-314 coverage documentation
  - [ ] Audit trail procedures
  - [ ] Export procedures for Wirtschaftsprüfer
  - **Effort:** 1 day

**Total Effort:** ~2-3 weeks

---

### 3. Plausibility & Controls Engine (HGB-Specific)

**Goal:** Implement automated plausibility checks, variance analysis, and exception reporting with HGB-specific validation rules.

**Business Value:** Early error detection, data quality, HGB compliance validation, confidence in results (critical for single-user workflow and audit)

**HGB Relevance:** HGB requires balance sheet equality, proper consolidation, and consistency checks

**Estimated Effort:** 2-3 weeks

#### To-Do List

##### Backend Tasks

- [ ] **3.1** Create database migration for plausibility rules (HGB-specific)
  - [ ] Create `control_objectives` table (id, name, description, category, hgb_reference, created_at, updated_at)
  - [ ] Create `controls` table (id, control_objective_id, name, description, control_type, frequency, raci_responsible, raci_accountable, raci_consulted, raci_informed, is_mandatory, created_at, updated_at)
  - [ ] Create `control_executions` table (id, control_id, financial_statement_id, executed_by_user_id, execution_date, status, result, evidence_ids, notes, created_at)
  - [ ] Create `control_evidence` table (id, control_execution_id, document_attachment_id, evidence_type, description, created_at)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/005_control_framework.sql`
  - **Effort:** 2 days

- [ ] **2.2** Create TypeORM entities
  - [ ] `ControlObjective` entity
  - [ ] `Control` entity
  - [ ] `ControlExecution` entity
  - [ ] `ControlEvidence` entity
  - **Effort:** 1 day

- [ ] **2.3** Create control framework service
  - [ ] `ControlFrameworkService` with methods:
    - [ ] `getControlObjectives()`
    - [ ] `getControlsForObjective(objectiveId)`
    - [ ] `executeControl(controlId, financialStatementId, executedBy)`
    - [ ] `recordControlExecution(execution)`
    - [ ] `getControlExecutions(financialStatementId)`
    - [ ] `linkEvidence(executionId, evidenceId)`
    - [ ] `getRACIForControl(controlId)`
  - **File:** `backend/src/modules/governance/control-framework.service.ts`
  - **Effort:** 3 days

- [ ] **2.4** Create control controller
  - [ ] `GET /api/governance/control-objectives` - List all objectives
  - [ ] `GET /api/governance/controls` - List controls (with filters)
  - [ ] `GET /api/governance/controls/:id` - Get control details
  - [ ] `POST /api/governance/controls/:id/execute` - Execute control
    - [ ] Validate user has permission
    - [ ] Check RACI (user must be responsible/accountable)
    - [ ] Record execution
  - [ ] `GET /api/governance/control-executions` - List executions
  - [ ] `POST /api/governance/control-executions/:id/evidence` - Link evidence
  - **File:** `backend/src/modules/governance/control-framework.controller.ts`
  - **Effort:** 2 days

- [ ] **2.5** Seed default control objectives and controls
  - [ ] Create seed script with HGB-based control objectives:
    - [ ] Consolidation Scope (HGB § 290-292)
    - [ ] Capital Consolidation (HGB § 301)
    - [ ] Debt Consolidation (HGB § 303)
    - [ ] Intercompany Eliminations (HGB § 304)
    - [ ] Income/Expense Consolidation (HGB § 305)
    - [ ] Deferred Taxes (HGB § 306)
    - [ ] Minority Interests (HGB § 301)
    - [ ] Currency Translation (HGB § 308a)
    - [ ] Disclosures (HGB § 313-314)
  - [ ] Create seed script with controls for each objective
  - [ ] Assign RACI for each control
  - **File:** `database/seeds/002_control_framework_seed.sql`
  - **Effort:** 3 days

- [ ] **2.6** Integrate controls into consolidation workflow
  - [ ] Add control execution checkpoints in consolidation process
  - [ ] Require control execution before consolidation approval
  - [ ] Link consolidation entries to control executions
  - **Effort:** 2 days

- [ ] **2.7** Implement segregation of duties rules
  - [ ] Create `segregation_rules` table (id, rule_name, conflicting_roles, description)
  - [ ] Create `SegregationOfDutiesService` with:
    - [ ] `checkSegregation(userId, action)` - Check if user can perform action
    - [ ] `validateUserAssignment(userId, roleId)` - Check if role assignment violates SoD
  - [ ] Integrate into RBAC system
  - **File:** `backend/src/modules/governance/segregation-of-duties.service.ts`
  - **Effort:** 2 days

##### Frontend Tasks

- [ ] **2.8** Create control framework UI
  - [ ] Control objectives list page (`frontend/src/pages/ControlFramework.tsx`)
  - [ ] Control detail page with RACI display
  - [ ] Control execution form
  - [ ] Control execution history
  - [ ] Evidence linking UI
  - **Effort:** 4 days

- [ ] **2.9** Create control dashboard
  - [ ] Control execution status dashboard
  - [ ] Overdue controls alert
  - [ ] Control effectiveness metrics
  - **Effort:** 2 days

- [ ] **2.10** Add control execution to consolidation workflow
  - [ ] Show required controls in consolidation wizard
  - [ ] Block consolidation if controls not executed
  - [ ] Display control execution status
  - **Effort:** 2 days

##### Testing

- [ ] **2.11** Write unit tests for control framework service
  - [ ] Test control execution
  - [ ] Test RACI validation
  - [ ] Test evidence linking
  - **Effort:** 2 days

- [ ] **2.12** Write integration tests
  - [ ] Test control execution workflow
  - [ ] Test segregation of duties enforcement
  - [ ] Test control blocking consolidation
  - **Effort:** 2 days

##### Documentation

- [ ] **2.13** Document control framework
  - [ ] Control framework architecture
  - [ ] RACI matrix documentation
  - [ ] Control execution procedures
  - **Effort:** 1 day

**Total Effort:** ~4-5 weeks

---

### 3. Accounting Policy & Rules Layer

**Goal:** Create configurable policy and rules layer with versioning, GAAP→HGB mappings, and rule management.

**Business Value:** Configurability, institutional memory, easier rule changes (no code changes needed)

**Estimated Effort:** 3-4 weeks

**Goal:** Create configurable policy and rules layer with versioning, GAAP→HGB mappings, and rule management.

**Business Value:** Institutional memory, policy consistency, auditability of rule changes

**Estimated Effort:** 3-4 weeks

#### To-Do List

##### Backend Tasks

- [ ] **4.1** Create database migration for policy & rules (with HGB restrictions)
  - [ ] Create `accounting_policies` table (id, name, description, policy_type, effective_date, expiry_date, status, version, parent_policy_id, is_hgb_mandatory BOOLEAN DEFAULT FALSE, created_by_user_id, approved_by_user_id, created_at, updated_at)
  - [ ] Create `consolidation_rules` table (id, policy_id, rule_name, rule_type, rule_definition_json, priority, is_active, is_hgb_mandatory BOOLEAN DEFAULT FALSE, hgb_reference VARCHAR(20), effective_date, created_at, updated_at)
  - [ ] Create `gaap_hgb_mappings` table (id, gaap_account_code, hgb_account_code, mapping_type, transformation_rule_json, effective_date, created_at, updated_at)
  - [ ] Create `policy_versions` table (id, policy_id, version, content_json, effective_date, created_by_user_id, created_at)
  - [ ] Add constraint: HGB-mandatory rules cannot be modified (enforced in application layer)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/006_policy_rules_layer_hgb.sql`
  - **Effort:** 2 days

- [ ] **4.2** Create TypeORM entities
  - [ ] `AccountingPolicy` entity (with is_hgb_mandatory field)
  - [ ] `ConsolidationRule` entity (with is_hgb_mandatory and hgb_reference fields)
  - [ ] `GaapHgbMapping` entity
  - [ ] `PolicyVersion` entity
  - **Effort:** 1 day

- [ ] **4.3** Create policy service (with HGB restrictions)
  - [ ] `PolicyService` with methods:
    - [ ] `createPolicy(policyData)` - Cannot create HGB-mandatory policies (system only)
    - [ ] `updatePolicy(policyId, updates)` (creates new version) - **BLOCKS** if is_hgb_mandatory = true
    - [ ] `getPolicy(policyId, version?)`
    - [ ] `getActivePolicies(policyType?)`
    - [ ] `approvePolicy(policyId, approvedBy)`
    - [ ] `getPolicyVersions(policyId)`
    - [ ] `validatePolicyChange(policyId, updates)` - Validates that HGB-mandatory rules are not changed
  - **File:** `backend/src/modules/policy/policy.service.ts`
  - **Effort:** 3 days

- [ ] **4.4** Create rules engine service
  - [ ] `RulesEngineService` with methods:
    - [ ] `getRulesForType(ruleType, effectiveDate)`
    - [ ] `evaluateRule(ruleId, context)` - Evaluate rule against context
    - [ ] `applyRules(ruleType, data, context)` - Apply all applicable rules
    - [ ] `validateRule(ruleDefinition)` - Validate rule definition JSON
    - [ ] `checkHgbMandatoryRules()` - Ensure all HGB-mandatory rules are active
  - **File:** `backend/src/modules/policy/rules-engine.service.ts`
  - **Effort:** 3 days

- [ ] **4.5** Create GAAP→HGB mapping service
  - [ ] `GaapHgbMappingService` with methods:
    - [ ] `getMapping(gaapAccountCode, effectiveDate)`
    - [ ] `transformAccount(gaapAccount, effectiveDate)` - Transform GAAP account to HGB
    - [ ] `bulkTransform(gaapAccounts, effectiveDate)` - Transform multiple accounts
    - [ ] `createMapping(mappingData)`
  - **File:** `backend/src/modules/policy/gaap-hgb-mapping.service.ts`
  - **Effort:** 2 days

- [ ] **4.6** Create policy controller
  - [ ] `GET /api/policy/policies` - List policies
  - [ ] `GET /api/policy/policies/:id` - Get policy
  - [ ] `POST /api/policy/policies` - Create policy (blocks if HGB-mandatory)
  - [ ] `PUT /api/policy/policies/:id` - Update policy (creates version, blocks if HGB-mandatory)
  - [ ] `POST /api/policy/policies/:id/approve` - Approve policy
  - [ ] `GET /api/policy/policies/:id/versions` - Get policy versions
  - [ ] `GET /api/policy/rules` - List rules
  - [ ] `POST /api/policy/rules` - Create rule (blocks if HGB-mandatory)
  - [ ] `GET /api/policy/mappings` - List GAAP→HGB mappings
  - [ ] `POST /api/policy/mappings` - Create mapping
  - **File:** `backend/src/modules/policy/policy.controller.ts`
  - **Effort:** 2 days

- [ ] **4.7** Refactor consolidation services to use rules engine (HGB-mandatory rules enforced)
  - [ ] Update `CapitalConsolidationService` to use rules (HGB § 301 - mandatory)
  - [ ] Update `DebtConsolidationService` to use rules (HGB § 303 - mandatory)
  - [ ] Update `IncomeStatementConsolidationService` to use rules (HGB § 305 - mandatory)
  - [ ] Replace hardcoded logic with rule evaluation
  - [ ] **Enforce:** HGB-mandatory rules cannot be bypassed or modified
  - [ ] Add validation: All HGB-mandatory rules must be active
  - **Effort:** 4 days

- [ ] **4.8** Seed default policies and rules (HGB-mandatory marked)
  - [ ] Create seed script with HGB-mandatory policies (is_hgb_mandatory = TRUE):
    - [ ] Capital consolidation policy (HGB § 301) - **MANDATORY**
    - [ ] Debt consolidation policy (HGB § 303) - **MANDATORY**
    - [ ] Intercompany elimination policy (HGB § 304) - **MANDATORY**
    - [ ] Income/expense consolidation policy (HGB § 305) - **MANDATORY**
    - [ ] Deferred tax policy (HGB § 306) - **MANDATORY**
    - [ ] Currency translation policy (HGB § 308a) - **MANDATORY**
  - [ ] Create seed script with optional policies (is_hgb_mandatory = FALSE):
    - [ ] Goodwill amortization method (optional)
    - [ ] Valuation methods (optional, within HGB framework)
  - [ ] Create seed script with default rules for each policy (marked as mandatory/optional)
  - [ ] Create seed script with common GAAP→HGB mappings
  - **File:** `database/seeds/003_policy_rules_hgb_seed.sql`
  - **Effort:** 2.5 days

##### Frontend Tasks

- [ ] **4.9** Create policy management UI (with HGB restrictions)
  - [ ] Policy list page (`frontend/src/pages/PolicyManagement.tsx`)
  - [ ] Policy detail/edit page
  - [ ] **Disable edit** for HGB-mandatory policies (visual indicator)
  - [ ] Policy version history viewer
  - [ ] Policy approval workflow UI
  - [ ] Show HGB reference and mandatory status
  - **Effort:** 3 days

- [ ] **3.10** Create rules management UI
  - [ ] Rules list page
  - [ ] Rule editor (JSON editor with validation)
  - [ ] Rule testing interface
  - **Effort:** 3 days

- [ ] **3.11** Create GAAP→HGB mapping UI
  - [ ] Mapping list page
  - [ ] Mapping editor
  - [ ] Bulk import/export mappings
  - **Effort:** 2 days

##### Testing

- [ ] **3.12** Write unit tests for policy service
  - [ ] Test policy creation/update
  - [ ] Test versioning
  - [ ] Test approval workflow
  - **Effort:** 2 days

- [ ] **3.13** Write unit tests for rules engine
  - [ ] Test rule evaluation
  - [ ] Test rule application
  - [ ] Test rule validation
  - **Effort:** 2 days

- [ ] **3.14** Write integration tests
  - [ ] Test policy workflow end-to-end
  - [ ] Test rules engine integration with consolidation
  - [ ] Test GAAP→HGB transformation
  - **Effort:** 2 days

##### Documentation

- [ ] **4.15** Document policy & rules layer (HGB restrictions)
  - [ ] Policy management guide
  - [ ] Rules engine documentation
  - [ ] GAAP→HGB mapping guide
  - [ ] Rule definition JSON schema
  - [ ] **HGB-mandatory rules documentation** (which rules cannot be changed)
  - [ ] HGB compliance guide
  - **Effort:** 2 days

**Total Effort:** ~3-4 weeks

---

### 5. Close Calendar Orchestration (with HGB Deadlines)

**Goal:** Implement close calendar with task scheduling, dependencies, deadline management, and HGB-specific deadlines.

**Business Value:** Organized close process, progress tracking, HGB deadline management (helps single user stay on track and meet legal deadlines)

**HGB Relevance:** § 325 HGB (Offenlegungsfristen) - 12 months for filing, 5 months for audit completion

**Estimated Effort:** 2-3 weeks

**Goal:** Implement close calendar with task scheduling, dependencies, and deadline management.

**Business Value:** Organized close process, progress tracking, deadline management (helps single user stay on track)

**Estimated Effort:** 2-3 weeks

#### To-Do List

##### Backend Tasks

- [ ] **5.1** Create database migration for close calendar (with HGB deadlines)
  - [ ] Create `plausibility_rules` table (id, name, description, rule_type, rule_definition_json, severity, is_active, created_at, updated_at)
  - [ ] Create `plausibility_checks` table (id, rule_id, financial_statement_id, check_date, status, result, variance_amount, variance_percentage, threshold, created_at)
  - [ ] Create `variance_analyses` table (id, financial_statement_id, account_id, current_amount, prior_amount, variance_amount, variance_percentage, analysis_type, explanation, created_at)
  - [ ] Create `exception_reports` table (id, financial_statement_id, exception_type, severity, description, related_entity_ids, status, resolved_by_user_id, resolved_at, created_at)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/007_plausibility_controls.sql`
  - **Effort:** 1 day

- [ ] **4.2** Create TypeORM entities
  - [ ] `PlausibilityRule` entity
  - [ ] `PlausibilityCheck` entity
  - [ ] `VarianceAnalysis` entity
  - [ ] `ExceptionReport` entity
  - **Effort:** 1 day

- [ ] **5.3** Create close calendar service (with HGB deadlines)
  - [ ] `PlausibilityService` with methods:
    - [ ] `runPlausibilityChecks(financialStatementId)` - Run all active rules
    - [ ] `checkBalanceSheetBalance(financialStatementId)` - Check Aktiva = Passiva
    - [ ] `checkIncomeStatementBalance(financialStatementId)` - Check GuV balance
    - [ ] `checkRatioPlausibility(financialStatementId)` - Check financial ratios
    - [ ] `checkVarianceThresholds(financialStatementId)` - Check variances vs. thresholds
    - [ ] `getPlausibilityResults(financialStatementId)` - Get all check results
  - **File:** `backend/src/modules/controls/plausibility.service.ts`
  - **Effort:** 3 days

- [ ] **4.4** Create variance analysis service
  - [ ] `VarianceAnalysisService` with methods:
    - [ ] `analyzeVariances(financialStatementId, priorFinancialStatementId)` - Compare current vs. prior
    - [ ] `calculateVariance(accountId, currentAmount, priorAmount)` - Calculate variance
    - [ ] `identifySignificantVariances(financialStatementId, threshold)` - Find significant variances
    - [ ] `getVarianceAnalysis(financialStatementId)` - Get all variances
  - **File:** `backend/src/modules/controls/variance-analysis.service.ts`
  - **Effort:** 2 days

- [ ] **4.5** Create exception reporting service
  - [ ] `ExceptionReportingService` with methods:
    - [ ] `createException(exceptionData)` - Create exception report
    - [ ] `getExceptions(financialStatementId, status?)` - Get exceptions
    - [ ] `resolveException(exceptionId, resolvedBy, resolution)` - Resolve exception
    - [ ] `generateExceptionReport(financialStatementId)` - Generate report
  - **File:** `backend/src/modules/controls/exception-reporting.service.ts`
  - **Effort:** 2 days

- [ ] **4.6** Create plausibility controller
  - [ ] `POST /api/controls/plausibility/check/:financialStatementId` - Run checks
  - [ ] `GET /api/controls/plausibility/results/:financialStatementId` - Get results
  - [ ] `GET /api/controls/variance-analysis/:financialStatementId` - Get variance analysis
  - [ ] `GET /api/controls/exceptions/:financialStatementId` - Get exceptions
  - [ ] `POST /api/controls/exceptions/:id/resolve` - Resolve exception
  - **File:** `backend/src/modules/controls/controls.controller.ts`
  - **Effort:** 1 day

- [ ] **3.7** Seed default plausibility rules (HGB-specific)
  - [ ] Create seed script with HGB-specific rules:
    - [ ] **Bilanzgleichheit** (Aktiva = Passiva) - HGB requirement
    - [ ] **GuV-Abschluss** (Jahresüberschuss = Summe aller GuV-Positionen) - HGB requirement
    - [ ] **Konsolidierungskreis-Konsistenz** - All >50% participations are consolidated (HGB § 290)
    - [ ] **Intercompany-Abgleich** - Forderungen = Verbindlichkeiten within group (HGB § 303)
    - [ ] **Goodwill-Konsistenz** - Goodwill calculation matches capital consolidation (HGB § 301)
    - [ ] **Minderheitsanteile-Konsistenz** - NCI calculation matches participation percentages (HGB § 301)
    - [ ] Current ratio check (business logic)
    - [ ] Debt-to-equity ratio check (business logic)
    - [ ] Revenue growth variance check (business logic)
    - [ ] Expense variance check (business logic)
  - **File:** `database/seeds/004_plausibility_rules_hgb_seed.sql`
  - **Effort:** 1.5 days

- [ ] **3.8** Integrate HGB-specific plausibility checks into consolidation workflow
  - [ ] Run checks automatically after consolidation
  - [ ] Block approval if HGB-mandatory checks fail (Bilanzgleichheit, GuV-Abschluss)
  - [ ] Show check results in consolidation review with HGB references
  - [ ] Link failed checks to HGB paragraphs
  - [ ] Generate compliance report for audit
  - **Effort:** 1.5 days

##### Frontend Tasks

- [ ] **3.9** Create plausibility checks UI (HGB-focused)
  - [ ] Plausibility checks results page (`frontend/src/pages/PlausibilityChecks.tsx`)
  - [ ] Check result detail view with HGB references
  - [ ] Variance analysis dashboard
  - [ ] Exception report viewer
  - [ ] HGB compliance status indicator
  - [ ] Export compliance report for audit
  - **Effort:** 3 days

- [ ] **3.10** Add plausibility indicators to consolidation workflow
  - [ ] Show check status in consolidation wizard
  - [ ] Display warnings/errors with HGB references
  - [ ] Block progression if HGB-mandatory checks fail
  - **Effort:** 1 day

##### Testing

- [ ] **3.11** Write unit tests for plausibility service
  - [ ] Test balance checks
  - [ ] Test ratio checks
  - [ ] Test variance calculations
  - [ ] Test HGB-specific checks
  - **Effort:** 2 days

- [ ] **3.12** Write integration tests
  - [ ] Test plausibility check workflow
  - [ ] Test exception reporting
  - [ ] Test integration with consolidation
  - [ ] Test HGB compliance blocking
  - **Effort:** 1 day

##### Documentation

- [ ] **3.13** Document plausibility system (HGB-focused)
  - [ ] Plausibility rules documentation with HGB references
  - [ ] Variance analysis guide
  - [ ] Exception reporting procedures
  - [ ] HGB compliance validation guide
  - **Effort:** 1 day

**Total Effort:** ~2-3 weeks

---

### 6. Data Intake & Reporting Packages (with Audit Trail)

**Goal:** Implement formal package submission workflow with validation, reconciliation, re-submission handling, and audit trail documentation.

**Business Value:** Better workflow, validation tracking, clear data import process, audit trail for Wirtschaftsprüfer (improves usability and audit readiness)

**HGB/IDW Relevance:** IDW PS 240 - documentation of data sources and validation for audit

**Estimated Effort:** 3-4 weeks

#### To-Do List

##### Backend Tasks

- [ ] **6.1** Create database migration for reporting packages (with audit trail)
  - [ ] Create `reporting_packages` table (id, financial_statement_id, company_id, package_type, submission_date, status, submitted_by_user_id, validated_by_user_id, approved_by_user_id, validation_errors, reconciliation_status, resubmission_count, source_system VARCHAR(100), source_file_path VARCHAR(1000), source_file_hash VARCHAR(64), created_at, updated_at)
  - [ ] Create `package_submissions` table (id, package_id, submission_date, submitted_by_user_id, submission_data_json, source_document_id UUID REFERENCES document_attachments(id), created_at)
  - [ ] Create `package_validations` table (id, package_id, validation_date, validated_by_user_id, validation_result_json, errors, warnings, status, audit_trail JSONB, created_at)
  - [ ] Create `package_reconciliations` table (id, package_id, reconciliation_date, reconciled_by_user_id, reconciliation_result_json, differences, status, audit_trail JSONB, created_at)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/008_reporting_packages_audit.sql`
  - **Effort:** 2 days

- [ ] **5.2** Create TypeORM entities
  - [ ] `ReportingPackage` entity
  - [ ] `PackageSubmission` entity
  - [ ] `PackageValidation` entity
  - [ ] `PackageReconciliation` entity
  - **Effort:** 1 day

- [ ] **6.3** Create package service (with audit trail)
  - [ ] `PackageService` with methods:
    - [ ] `createPackage(packageData, sourceDocumentId)` - Create new package with source document
    - [ ] `submitPackage(packageId, submittedBy, sourceDocumentId)` - Submit package with audit trail
    - [ ] `validatePackage(packageId, validatedBy)` - Validate package, record audit trail
    - [ ] `reconcilePackage(packageId, reconciledBy)` - Reconcile package, record audit trail
    - [ ] `approvePackage(packageId, approvedBy)` - Approve package
    - [ ] `rejectPackage(packageId, rejectedBy, reason)` - Reject package
    - [ ] `resubmitPackage(packageId, resubmittedBy)` - Handle resubmission
    - [ ] `getPackageStatus(packageId)` - Get package status
    - [ ] `exportPackageAuditTrail(packageId)` - Export audit trail for audit
  - **File:** `backend/src/modules/packages/package.service.ts`
  - **Effort:** 3 days

- [ ] **5.4** Create package validation service
  - [ ] `PackageValidationService` with methods:
    - [ ] `validatePackageData(packageId)` - Run validation rules
    - [ ] `checkDataCompleteness(packageId)` - Check required fields
    - [ ] `checkDataAccuracy(packageId)` - Check calculations
    - [ ] `checkDataConsistency(packageId)` - Check consistency
    - [ ] `generateValidationReport(packageId)` - Generate report
  - **File:** `backend/src/modules/packages/package-validation.service.ts`
  - **Effort:** 2 days

- [ ] **5.5** Create package reconciliation service
  - [ ] `PackageReconciliationService` with methods:
    - [ ] `reconcilePackage(packageId)` - Reconcile package data
    - [ ] `compareWithPriorPeriod(packageId)` - Compare with prior period
    - [ ] `identifyDifferences(packageId)` - Identify differences
    - [ ] `explainDifferences(packageId)` - Explain differences
  - **File:** `backend/src/modules/packages/package-reconciliation.service.ts`
  - **Effort:** 2 days

- [ ] **5.6** Create package controller
  - [ ] `GET /api/packages` - List packages
  - [ ] `GET /api/packages/:id` - Get package details
  - [ ] `POST /api/packages` - Create package
  - [ ] `POST /api/packages/:id/submit` - Submit package
  - [ ] `POST /api/packages/:id/validate` - Validate package
  - [ ] `POST /api/packages/:id/reconcile` - Reconcile package
  - [ ] `POST /api/packages/:id/approve` - Approve package
  - [ ] `POST /api/packages/:id/reject` - Reject package
  - [ ] `POST /api/packages/:id/resubmit` - Resubmit package
  - **File:** `backend/src/modules/packages/package.controller.ts`
  - **Effort:** 2 days

- [ ] **5.7** Refactor import service to use packages
  - [ ] Update `ImportService` to create packages
    - [ ] Create package on import start
    - [ ] Link imported data to package
    - [ ] Update package status on import completion
  - **Effort:** 2 days

##### Frontend Tasks

- [ ] **6.8** Create package management UI (with audit trail)
  - [ ] Package list page (`frontend/src/pages/PackageManagement.tsx`)
  - [ ] Package detail page with status
  - [ ] Package submission form with source document upload
  - [ ] Validation results viewer with audit trail
  - [ ] Reconciliation results viewer with audit trail
  - [ ] Audit trail export button
  - [ ] Source document links
  - **Effort:** 4 days

- [ ] **6.9** Update import workflow to use packages
  - [ ] Create package before import
    - [ ] Show package status during import
    - [ ] Link import to package
    - [ ] Update package status after import
  - **Effort:** 2 days

- [ ] **6.10** Add package status indicators
  - [ ] Package status badges
  - [ ] Package workflow visualization
  - [ ] Package timeline view
  - **Effort:** 2 days

##### Testing

- [ ] **6.11** Write unit tests for package service
  - [ ] Test package creation
  - [ ] Test submission workflow
  - [ ] Test validation
  - [ ] Test reconciliation
  - [ ] Test audit trail recording
  - **Effort:** 2 days

- [ ] **6.12** Write integration tests
  - [ ] Test package workflow end-to-end
  - [ ] Test resubmission handling
  - [ ] Test integration with import
  - [ ] Test audit trail export
  - **Effort:** 2 days

##### Documentation

- [ ] **6.13** Document package system (with audit trail)
  - [ ] Package workflow documentation
  - [ ] Validation rules guide
  - [ ] Reconciliation procedures
  - [ ] Audit trail documentation procedures (IDW PS 240)
  - **Effort:** 1 day

**Total Effort:** ~3-4 weeks

---

## MEDIUM PRIORITY IMPLEMENTATION PLAN

### Estimated Timeline: 16-22 weeks

---

### 7. Stichtagsverschiebungen (HGB § 299) - NEW

**Goal:** Implement fiscal year end shift management for multinational groups with different fiscal year ends.

**Business Value:** Proper handling of different fiscal year ends, HGB compliance, documentation for audit

**HGB Relevance:** § 299 HGB (Stichtagsverschiebung bei abweichenden Geschäftsjahren) - max. 3 months shift allowed

**Estimated Effort:** 2-3 weeks

#### To-Do List

##### Backend Tasks

- [ ] **7.1** Create database migration for fiscal year shifts
  - [ ] Add columns to `companies`: `fiscal_year_end_month INTEGER`, `fiscal_year_shift_months INTEGER`, `fiscal_year_shift_justification TEXT`
  - [ ] Create `fiscal_year_shifts` table (id, company_id, financial_statement_id, shift_months, justification, approved_by_user_id, created_at)
  - [ ] Add constraint: shift_months <= 3 (HGB § 299 Abs. 2)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/012_fiscal_year_shifts.sql`
  - **Effort:** 1 day

- [ ] **7.2** Create TypeORM entities
  - [ ] `FiscalYearShift` entity
  - [ ] Update `Company` entity with fiscal year fields
  - **Effort:** 0.5 days

- [ ] **7.3** Create fiscal year shift service
  - [ ] `FiscalYearShiftService` with methods:
    - [ ] `calculateFiscalYearShift(companyId, groupFiscalYearEnd)` - Calculate shift needed
    - [ ] `validateShift(shiftMonths)` - Validate shift <= 3 months (HGB § 299)
    - [ ] `recordShift(companyId, financialStatementId, shiftMonths, justification)` - Record shift
    - [ ] `getShiftsForGroup(financialStatementId)` - Get all shifts for group
    - [ ] `warnExcessiveShifts(financialStatementId)` - Warn if shifts > 3 months
  - **File:** `backend/src/modules/consolidation/fiscal-year-shift.service.ts`
  - **Effort:** 2 days

- [ ] **7.4** Create time period mapping service
  - [ ] `TimePeriodMappingService` with methods:
    - [ ] `mapSubsidiaryPeriodToGroupPeriod(companyId, subsidiaryPeriod, groupFiscalYearEnd)` - Map periods
    - [ ] `getInterimPeriods(companyId, groupFiscalYearEnd)` - Get interim periods needed
    - [ ] `validatePeriodMapping(financialStatementId)` - Validate all mappings
  - **File:** `backend/src/modules/consolidation/time-period-mapping.service.ts`
  - **Effort:** 2 days

- [ ] **7.5** Create fiscal year shift controller
  - [ ] `GET /api/consolidation/fiscal-year-shifts/:financialStatementId` - Get shifts
  - [ ] `POST /api/consolidation/fiscal-year-shifts` - Record shift
  - [ ] `GET /api/consolidation/fiscal-year-shifts/:financialStatementId/validate` - Validate shifts
  - [ ] `GET /api/consolidation/fiscal-year-shifts/:financialStatementId/warnings` - Get warnings
  - **File:** `backend/src/modules/consolidation/fiscal-year-shift.controller.ts`
  - **Effort:** 1 day

##### Frontend Tasks

- [ ] **7.6** Create fiscal year shift UI
  - [ ] Fiscal year shift management page (`frontend/src/pages/FiscalYearShifts.tsx`)
  - [ ] Shift calculation and display
  - [ ] Warning display for excessive shifts (>3 months)
  - [ ] Justification input
  - [ ] Period mapping visualization
  - **Effort:** 3 days

##### Testing

- [ ] **7.7** Write unit tests
  - [ ] Test shift calculation
  - [ ] Test validation (3-month limit)
  - [ ] Test period mapping
  - **Effort:** 1.5 days

##### Documentation

- [ ] **7.8** Document fiscal year shifts
  - [ ] HGB § 299 documentation
  - [ ] Shift calculation guide
  - [ ] Period mapping procedures
  - **Effort:** 0.5 days

**Total Effort:** ~2-3 weeks

---

### 8. Währungsumrechnung-UI (HGB § 308a) - Enhanced

**Goal:** Create comprehensive UI for currency translation with audit trail and exchange rate documentation.

**Business Value:** Better visibility into FX translations, audit trail for exchange rates, compliance with HGB § 308a

**HGB Relevance:** § 308a HGB (Währungsumrechnung) - requires documentation of exchange rates and methods

**Estimated Effort:** 1-2 weeks

#### To-Do List

##### Backend Tasks

- [ ] **8.1** Enhance exchange rate tables with audit trail
  - [ ] Add columns to `exchange_rates`: `rate_source_detail TEXT`, `rate_justification TEXT`, `approved_by_user_id UUID`, `approved_at TIMESTAMPTZ`
  - [ ] Add columns to `currency_translation_differences`: `translation_method VARCHAR(50)`, `cumulative_difference_history JSONB`
  - [ ] **File:** `database/migrations/013_fx_audit_trail.sql`
  - **Effort:** 0.5 days

- [ ] **8.2** Enhance exchange rate service
  - [ ] `ExchangeRateService` with methods:
    - [ ] `recordExchangeRate(rateData, source, justification, approvedBy)` - Record with audit trail
    - [ ] `getExchangeRatesForPeriod(financialStatementId)` - Get all rates for period
    - [ ] `validateExchangeRates(financialStatementId)` - Validate rate sources
    - [ ] `exportFXAuditTrail(financialStatementId)` - Export for audit
  - **File:** `backend/src/modules/consolidation/exchange-rate.service.ts` (enhance existing)
  - **Effort:** 1.5 days

- [ ] **8.3** Create FX translation controller
  - [ ] `GET /api/consolidation/fx-rates/:financialStatementId` - Get all rates
  - [ ] `POST /api/consolidation/fx-rates` - Create/update rate with audit trail
  - [ ] `GET /api/consolidation/fx-translations/:financialStatementId` - Get translation details
  - [ ] `GET /api/consolidation/fx-audit-trail/:financialStatementId` - Get audit trail
  - [ ] `POST /api/consolidation/fx-audit-trail/:financialStatementId/export` - Export audit trail
  - **File:** `backend/src/modules/consolidation/fx-translation.controller.ts`
  - **Effort:** 1 day

##### Frontend Tasks

- [ ] **8.4** Create FX translation UI
  - [ ] FX translation overview page (`frontend/src/pages/FxTranslation.tsx`)
  - [ ] Exchange rate management (with source documentation)
  - [ ] Translation differences dashboard
  - [ ] Cumulative differences tracking
  - [ ] Audit trail viewer
  - [ ] Export audit trail button
  - **Effort:** 3 days

##### Testing

- [ ] **8.5** Write unit tests
  - [ ] Test exchange rate recording with audit trail
  - [ ] Test translation calculations
  - [ ] Test audit trail export
  - **Effort:** 1 day

##### Documentation

- [ ] **8.6** Document FX translation
  - [ ] HGB § 308a documentation
  - [ ] Exchange rate source documentation procedures
  - [ ] Translation method selection guide
  - **Effort:** 0.5 days

**Total Effort:** ~1-2 weeks

---

### 9. Konzernlagebericht (HGB § 315) - Moved from Low

**Goal:** Implement automated generation of management report (Konzernlagebericht) with narrative sections.

**Business Value:** Legal requirement, time savings, audit readiness

**HGB Relevance:** § 315 HGB (Konzernlagebericht) - legally required, Wirtschaftsprüfer also audits this

**Estimated Effort:** 2-3 weeks

#### To-Do List

##### Backend Tasks

- [ ] **9.1** Create database migration for Lagebericht
  - [ ] Create `management_reports` table (id, financial_statement_id, status, generated_at, generated_by_user_id, version, created_at, updated_at)
  - [ ] Create `narrative_sections` table (id, management_report_id, section_type, title, content, data_source_json, created_at, updated_at)
  - [ ] Create `narrative_templates` table (id, section_type, template_name, template_content, is_default, created_at, updated_at)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/014_konzernlagebericht.sql`
  - **Effort:** 1 day

- [ ] **9.2** Create Lagebericht service
  - [ ] `ManagementReportService` with methods:
    - [ ] `generateManagementReport(financialStatementId, userId)` - Generate complete report
    - [ ] `generateSection(sectionType, financialStatementId)` - Generate specific section
    - [ ] `populateNarratives(financialStatementId)` - Populate from consolidation data
    - [ ] `applyTemplate(sectionId, templateId)` - Apply template
    - [ ] `getVersionHistory(managementReportId)` - Get versions
  - **File:** `backend/src/modules/consolidation/management-report.service.ts`
  - **Effort:** 3 days

- [ ] **9.3** Create narrative generation service
  - [ ] `NarrativeGenerationService` with methods:
    - [ ] `generateBusinessDevelopment(financialStatementId)` - Geschäftsverlauf
    - [ ] `generateGroupPosition(financialStatementId)` - Lage des Konzerns
    - [ ] `generateRisksAndOpportunities(financialStatementId)` - Risiken und Chancen
    - [ ] `generateOutlook(financialStatementId)` - Zukunftsaussichten
    - [ ] `generateFromData(sectionType, data)` - Generate from consolidation data
  - **File:** `backend/src/modules/consolidation/narrative-generation.service.ts`
  - **Effort:** 3 days

- [ ] **9.4** Create management report controller
  - [ ] `GET /api/consolidation/management-report/:financialStatementId` - Get report
  - [ ] `POST /api/consolidation/management-report/:financialStatementId/generate` - Generate report
  - [ ] `PUT /api/consolidation/management-report/sections/:id` - Update section
  - [ ] `GET /api/consolidation/management-report/:id/versions` - Get versions
  - [ ] `GET /api/consolidation/management-report/:financialStatementId/export/word` - Word export
  - [ ] `GET /api/consolidation/management-report/:financialStatementId/export/pdf` - PDF export
  - **File:** `backend/src/modules/consolidation/management-report.controller.ts`
  - **Effort:** 1 day

##### Frontend Tasks

- [ ] **9.5** Create Lagebericht UI
  - [ ] Management report viewer (`frontend/src/pages/ManagementReport.tsx`)
  - [ ] Narrative editor
  - [ ] Template management
  - [ ] Version history viewer
  - [ ] Export buttons (Word, PDF)
  - **Effort:** 3 days

##### Testing

- [ ] **9.6** Write unit tests
  - [ ] Test report generation
  - [ ] Test narrative generation
  - [ ] Test template application
  - **Effort:** 1.5 days

##### Documentation

- [ ] **9.7** Document Lagebericht
  - [ ] HGB § 315 documentation
  - [ ] Narrative generation guide
  - [ ] Template management procedures
  - **Effort:** 0.5 days

**Total Effort:** ~2-3 weeks

---

### 10. ERP Integration Patterns

**Goal:** Implement close calendar with task scheduling, dependencies, and deadline management.

**Business Value:** Predictable close process, deadline management, resource planning

**Estimated Effort:** 2-3 weeks

#### To-Do List

##### Backend Tasks

- [ ] **6.1** Create database migration for close calendar
  - [ ] Create `close_calendars` table (id, financial_statement_id, fiscal_year, close_start_date, target_close_date, actual_close_date, status, created_at, updated_at)
  - [ ] Create `close_tasks` table (id, close_calendar_id, task_name, task_type, description, assigned_to_user_id, due_date, completed_date, status, dependencies, created_at, updated_at)
  - [ ] Create `close_task_dependencies` table (id, task_id, depends_on_task_id, dependency_type, created_at)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/009_close_calendar.sql`
  - **Effort:** 1 day

- [ ] **6.2** Create TypeORM entities
  - [ ] `CloseCalendar` entity
  - [ ] `CloseTask` entity
  - [ ] `CloseTaskDependency` entity
  - **Effort:** 1 day

- [ ] **6.3** Create close calendar service
  - [ ] `CloseCalendarService` with methods:
    - [ ] `createCloseCalendar(financialStatementId, fiscalYear)` - Create calendar
    - [ ] `getCloseCalendar(financialStatementId)` - Get calendar
    - [ ] `addTask(closeCalendarId, taskData)` - Add task
    - [ ] `updateTaskStatus(taskId, status)` - Update task status
    - [ ] `completeTask(taskId, completedBy)` - Complete task
    - [ ] `getTasks(closeCalendarId, status?)` - Get tasks
    - [ ] `getTaskDependencies(taskId)` - Get dependencies
    - [ ] `checkTaskReadiness(taskId)` - Check if task can start
    - [ ] `calculateCloseProgress(closeCalendarId)` - Calculate progress
  - **File:** `backend/src/modules/close/close-calendar.service.ts`
  - **Effort:** 3 days

- [ ] **6.4** Create close calendar controller
  - [ ] `GET /api/close/calendars/:financialStatementId` - Get calendar
  - [ ] `POST /api/close/calendars` - Create calendar
  - [ ] `GET /api/close/tasks/:closeCalendarId` - Get tasks
  - [ ] `POST /api/close/tasks` - Create task
  - [ ] `PUT /api/close/tasks/:id` - Update task
  - [ ] `POST /api/close/tasks/:id/complete` - Complete task
  - [ ] `GET /api/close/progress/:closeCalendarId` - Get progress
  - **File:** `backend/src/modules/close/close-calendar.controller.ts`
  - **Effort:** 1 day

- [ ] **6.5** Create default close calendar templates
  - [ ] Create seed script with default task templates:
    - [ ] Package submission tasks
    - [ ] Validation tasks
    - [ ] Reconciliation tasks
    - [ ] Consolidation tasks
    - [ ] Review tasks
    - [ ] Approval tasks
  - [ ] Create task dependencies
  - **File:** `database/seeds/005_close_calendar_templates.sql`
  - **Effort:** 1 day

- [ ] **6.6** Integrate close calendar with consolidation workflow
  - [ ] Create calendar on financial statement creation
  - [ ] Link consolidation tasks to calendar
  - [ ] Update task status on workflow events
  - **Effort:** 2 days

##### Frontend Tasks

- [ ] **6.7** Create close calendar UI
  - [ ] Close calendar view (`frontend/src/pages/CloseCalendar.tsx`)
  - [ ] Task list with status
  - [ ] Task dependency visualization
  - [ ] Progress dashboard
  - [ ] Task assignment UI
  - **Effort:** 4 days

- [ ] **6.8** Add close calendar to consolidation workflow
  - [ ] Show calendar in consolidation wizard
  - [ ] Display task status
  - [ ] Show dependencies
  - [ ] Block progression if tasks incomplete
  - **Effort:** 2 days

##### Testing

- [ ] **6.9** Write unit tests for close calendar service
  - [ ] Test calendar creation
  - [ ] Test task management
  - [ ] Test dependency checking
  - [ ] Test progress calculation
  - **Effort:** 2 days

- [ ] **6.10** Write integration tests
  - [ ] Test close calendar workflow
  - [ ] Test task dependencies
  - [ ] Test integration with consolidation
  - **Effort:** 1 day

##### Documentation

- [ ] **6.11** Document close calendar
  - [ ] Close calendar guide
  - [ ] Task management procedures
  - [ ] Dependency management
  - **Effort:** 1 day

**Total Effort:** ~2-3 weeks

---

### 11. ERP Integration Patterns

#### To-Do List

##### Backend Tasks

- [ ] **7.1** Create database migration for data lineage
  - [ ] Create `data_lineage` table (id, consolidated_value_id, source_type, source_id, source_value, transformation_type, transformation_rule_id, adjustment_entry_id, lineage_path_json, created_at)
  - [ ] Create `lineage_trace` table (id, financial_statement_id, account_id, consolidated_amount, source_amount, adjustment_amount, trace_path_json, created_at)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/010_data_lineage.sql`
  - **Effort:** 1 day

- [ ] **7.2** Create TypeORM entities
  - [ ] `DataLineage` entity
  - [ ] `LineageTrace` entity
  - **Effort:** 1 day

- [ ] **7.3** Create lineage service
  - [ ] `LineageService` with methods:
    - [ ] `traceConsolidatedValue(accountId, financialStatementId)` - Trace consolidated value to sources
    - [ ] `traceSourceValue(sourceId, sourceType)` - Trace source value to consolidated
    - [ ] `buildLineagePath(consolidatedValueId)` - Build complete lineage path
    - [ ] `getLineageForAccount(accountId, financialStatementId)` - Get lineage for account
    - [ ] `recordLineage(consolidatedValueId, sourceData, transformations)` - Record lineage
  - **File:** `backend/src/modules/lineage/lineage.service.ts`
  - **Effort:** 3 days

- [ ] **7.4** Integrate lineage tracking into consolidation
  - [ ] Record lineage when creating consolidation entries
  - [ ] Link source balances to consolidated balances
  - [ ] Track transformations (adjustments, eliminations)
  - [ ] Build lineage path during consolidation
  - **Effort:** 3 days

- [ ] **7.5** Create lineage controller
  - [ ] `GET /api/lineage/trace/:accountId/:financialStatementId` - Trace consolidated value
  - [ ] `GET /api/lineage/source/:sourceId/:sourceType` - Trace source value
  - [ ] `GET /api/lineage/path/:consolidatedValueId` - Get lineage path
  - [ ] `GET /api/lineage/account/:accountId/:financialStatementId` - Get account lineage
  - **File:** `backend/src/modules/lineage/lineage.controller.ts`
  - **Effort:** 1 day

##### Frontend Tasks

- [ ] **7.6** Create lineage visualization UI
  - [ ] Lineage trace viewer (`frontend/src/pages/DataLineage.tsx`)
  - [ ] Drill-down from consolidated to source
  - [ ] Transformation visualization
  - [ ] Lineage path tree view
  - **Effort:** 4 days

- [ ] **7.7** Add lineage to consolidation review
  - [ ] Show lineage link for each consolidated value
  - [ ] Enable drill-down from consolidated balance sheet
  - [ ] Show transformation details
  - **Effort:** 2 days

##### Testing

- [ ] **7.8** Write unit tests for lineage service
  - [ ] Test lineage recording
  - [ ] Test lineage tracing
  - [ ] Test path building
  - **Effort:** 2 days

- [ ] **7.9** Write integration tests
  - [ ] Test lineage during consolidation
  - [ ] Test drill-down functionality
  - [ ] Test transformation tracking
  - **Effort:** 1 day

##### Documentation

- [ ] **7.10** Document data lineage
  - [ ] Lineage system documentation
  - [ ] Drill-down procedures
  - [ ] Transformation tracking guide
  - **Effort:** 1 day

**Total Effort:** ~2-3 weeks

---

### 10. ERP Integration Patterns

**Goal:** Implement integration patterns for SAP, Oracle, and NetSuite with data quality framework.

**Business Value:** Automated data intake, reduced manual work, better data quality

**Estimated Effort:** 4-5 weeks

#### To-Do List

##### Backend Tasks

- [ ] **10.1** Create database migration for ERP integrations
  - [ ] Create `erp_connections` table (id, erp_type, connection_name, connection_config_json, is_active, created_at, updated_at)
  - [ ] Create `erp_sync_jobs` table (id, erp_connection_id, sync_type, status, started_at, completed_at, records_synced, errors_json, created_at)
  - [ ] Create `data_quality_rules` table (id, rule_name, rule_type, rule_definition_json, severity, is_active, created_at, updated_at)
  - [ ] Create `data_quality_checks` table (id, sync_job_id, rule_id, check_result, errors, warnings, created_at)
  - [ ] Add indexes and RLS
  - **File:** `database/migrations/011_erp_integration.sql`
  - **Effort:** 1 day

- [ ] **8.2** Create TypeORM entities
  - [ ] `ErpConnection` entity
  - [ ] `ErpSyncJob` entity
  - [ ] `DataQualityRule` entity
  - [ ] `DataQualityCheck` entity
  - **Effort:** 1 day

- [ ] **8.3** Create ERP integration service (abstract)
  - [ ] `ErpIntegrationService` abstract class with methods:
    - [ ] `connect(connectionConfig)` - Connect to ERP
    - [ ] `syncFinancialData(companyId, fiscalYear)` - Sync financial data
    - [ ] `syncAccountMaster(companyId)` - Sync account master
    - [ ] `syncIntercompanyTransactions(companyId, fiscalYear)` - Sync IC transactions
    - [ ] `disconnect()` - Disconnect from ERP
  - **File:** `backend/src/modules/integration/erp-integration.service.ts`
  - **Effort:** 2 days

- [ ] **8.4** Create SAP integration service
  - [ ] `SapIntegrationService` extending `ErpIntegrationService`
    - [ ] Implement RFC connection
    - [ ] Implement IDoc processing
    - [ ] Map SAP data to internal format
  - **File:** `backend/src/modules/integration/sap-integration.service.ts`
  - **Effort:** 3 days

- [ ] **8.5** Create Oracle integration service
  - [ ] `OracleIntegrationService` extending `ErpIntegrationService`
    - [ ] Implement Oracle DB connection
    - [ ] Implement API integration
    - [ ] Map Oracle data to internal format
  - **File:** `backend/src/modules/integration/oracle-integration.service.ts`
  - **Effort:** 3 days

- [ ] **8.6** Create NetSuite integration service
  - [ ] `NetSuiteIntegrationService` extending `ErpIntegrationService`
    - [ ] Implement REST API connection
    - [ ] Implement OAuth authentication
    - [ ] Map NetSuite data to internal format
  - **File:** `backend/src/modules/integration/netsuite-integration.service.ts`
  - **Effort:** 3 days

- [ ] **8.7** Create data quality service
  - [ ] `DataQualityService` with methods:
    - [ ] `runQualityChecks(syncJobId)` - Run all quality rules
    - [ ] `checkCompleteness(data)` - Check data completeness
    - [ ] `checkAccuracy(data)` - Check data accuracy
    - [ ] `checkConsistency(data)` - Check data consistency
    - [ ] `checkValidity(data)` - Check data validity
    - [ ] `generateQualityReport(syncJobId)` - Generate report
  - **File:** `backend/src/modules/integration/data-quality.service.ts`
  - **Effort:** 2 days

- [ ] **8.8** Create integration controller
  - [ ] `GET /api/integration/erp-connections` - List connections
  - [ ] `POST /api/integration/erp-connections` - Create connection
  - [ ] `POST /api/integration/sync/:connectionId` - Trigger sync
  - [ ] `GET /api/integration/sync-jobs` - List sync jobs
  - [ ] `GET /api/integration/data-quality/rules` - List quality rules
  - [ ] `POST /api/integration/data-quality/rules` - Create quality rule
  - **File:** `backend/src/modules/integration/integration.controller.ts`
  - **Effort:** 2 days

- [ ] **8.9** Seed default data quality rules
  - [ ] Create seed script with default rules:
    - [ ] Balance completeness check
    - [ ] Account code validation
    - [ ] Currency validation
    - [ ] Date range validation
    - [ ] Duplicate detection
  - **File:** `database/seeds/006_data_quality_rules_seed.sql`
  - **Effort:** 1 day

##### Frontend Tasks

- [ ] **8.10** Create ERP integration UI
  - [ ] ERP connection management page (`frontend/src/pages/ErpIntegration.tsx`)
  - [ ] Connection configuration form
  - [ ] Sync job monitoring
  - [ ] Data quality dashboard
  - **Effort:** 4 days

##### Testing

- [ ] **8.11** Write unit tests for integration services
  - [ ] Test SAP integration
  - [ ] Test Oracle integration
  - [ ] Test NetSuite integration
  - [ ] Test data quality service
  - **Effort:** 3 days

- [ ] **8.12** Write integration tests
  - [ ] Test ERP sync workflow
  - [ ] Test data quality checks
  - [ ] Test error handling
  - **Effort:** 2 days

##### Documentation

- [ ] **8.13** Document ERP integration
  - [ ] Integration setup guides (SAP, Oracle, NetSuite)
  - [ ] Data quality framework documentation
  - [ ] Sync job procedures
  - **Effort:** 2 days

**Total Effort:** ~4-5 weeks

---

## LOW PRIORITY IMPLEMENTATION PLAN

### Estimated Timeline: 8-12 weeks

**Note:** These enterprise-grade features are deferred for single-user scenarios. Implement when adding multiple users or when audit compliance requires them.

---

### 9. RBAC (Role-Based Access Control) System

**Goal:** Implement comprehensive role-based access control with permissions, user roles, and auditor read-only access.

**Business Value:** Security compliance, segregation of duties, audit readiness (only needed for multi-user scenarios)

**Estimated Effort:** 3-4 weeks

**When to Implement:** When adding multiple users with different permission levels

**Note:** For single-user scenarios, basic authentication is sufficient. This can be deferred until you need to manage multiple users.

---

### 10. Controls & Governance Framework

**Goal:** Implement formal control framework with control objectives, controls, RACI matrix, and control execution logging.

**Business Value:** Audit compliance, SOX-like discipline, evidence capture (only needed for formal audit requirements)

**Estimated Effort:** 4-5 weeks

**When to Implement:** When audit compliance requires formal control framework documentation

**Note:** Basic audit logging already exists. This formal framework is only needed for large organizations or strict audit requirements.

---

### 11. Event-Driven Architecture

**Goal:** Implement event model with event-driven processing for close orchestration.

**Business Value:** Decoupled architecture, scalability, auditability

**Estimated Effort:** 3-4 weeks

#### To-Do List

- [ ] **9.1** Design event model
  - [ ] Define event types (PackageSubmitted, ValidationFailed, etc.)
  - [ ] Define event schema
  - [ ] Design event store
  - **Effort:** 2 days

- [ ] **9.2** Implement event bus
  - [ ] Create event bus service
  - [ ] Implement event publishing
  - [ ] Implement event subscription
  - **Effort:** 3 days

- [ ] **9.3** Create event handlers
  - [ ] Package submission handler
  - [ ] Validation handler
  - [ ] Consolidation handler
  - [ ] Approval handler
  - **Effort:** 4 days

- [ ] **9.4** Refactor services to use events
  - [ ] Update package service to publish events
  - [ ] Update consolidation service to publish events
  - [ ] Update approval workflow to use events
  - **Effort:** 5 days

- [ ] **9.5** Create event monitoring UI
  - [ ] Event log viewer
  - [ ] Event timeline
  - [ ] Event filtering
  - **Effort:** 3 days

**Total Effort:** ~3-4 weeks

---

### 12. Lagebericht (Management Report) Generation

**Goal:** Implement automated generation of management report with narrative sections.

**Estimated Effort:** 2-3 weeks

#### To-Do List

- [ ] **10.1** Create database migration for Lagebericht
  - [ ] Create `management_reports` table
  - [ ] Create `narrative_sections` table
  - [ ] Create `narrative_templates` table
  - **Effort:** 1 day

- [ ] **10.2** Create Lagebericht service
  - [ ] Generate report structure
  - [ ] Populate narrative sections
  - [ ] Apply templates
  - **Effort:** 3 days

- [ ] **10.3** Create narrative generation service
  - [ ] Generate narratives from data
  - [ ] Apply templates
  - [ ] Customize narratives
  - **Effort:** 3 days

- [ ] **10.4** Create Lagebericht UI
  - [ ] Report viewer
  - [ ] Narrative editor
  - [ ] Template management
  - **Effort:** 3 days

**Total Effort:** ~2-3 weeks

---

## Implementation Timeline Summary

### Phase 1: High Priority - HGB Compliance & Usability (Weeks 1-20)
- Week 1-4: Data Lineage Tracking + Prüfpfad-Dokumentation
- Week 5-7: Konzernanhang-Generierung (HGB § 313-314) - Enhanced
- Week 8-10: Plausibility & Controls Engine (HGB-specific)
- Week 11-14: Accounting Policy & Rules Layer (with HGB restrictions)
- Week 15-17: Close Calendar Orchestration (with HGB deadlines)
- Week 18-20: Data Intake & Reporting Packages (with audit trail)

### Phase 2: Medium Priority - HGB Features & Integration (Weeks 21-38)
- Week 21-23: Stichtagsverschiebungen (HGB § 299) - NEW
- Week 24-25: Währungsumrechnung-UI (HGB § 308a) - Enhanced
- Week 26-28: Konzernlagebericht (HGB § 315) - Moved from Low
- Week 29-33: ERP Integration Patterns (if needed)
- Week 34-38: Buffer for additional enhancements

### Phase 3: Low Priority - Enterprise Features (Defer)
- RBAC System (implement when adding multiple users)
- Controls & Governance Framework (implement when audit requires formal framework)
- Event-Driven Architecture (implement when scaling significantly)

**Total Estimated Timeline:** 38 weeks (~9.5 months) for high and medium priority

**Note:** 
- Low priority items can be deferred indefinitely for single-user scenarios
- HGB-specific features (Konzernanhang, Stichtagsverschiebungen, Währungsumrechnung) are critical for audit readiness
- All high-priority items include audit trail functionality for Wirtschaftsprüfer workflows

---

## Success Criteria

### High Priority Items
- ✅ Data Lineage with Prüfpfad-Dokumentation fully functional
- ✅ Konzernanhang-Generierung with audit trail and versioning
- ✅ HGB-specific plausibility checks running automatically
- ✅ Policy & rules layer functional with HGB restrictions enforced
- ✅ Close calendar with HGB deadlines integrated
- ✅ Package workflow with audit trail documentation

### Medium Priority Items
- ✅ Stichtagsverschiebungen (HGB § 299) implemented
- ✅ Währungsumrechnung-UI (HGB § 308a) with audit trail
- ✅ Konzernlagebericht (HGB § 315) generation functional
- ✅ ERP integrations functional (at least one, if needed)

### Low Priority Items
- ✅ Event model implemented
- ✅ Lagebericht generation functional

---

## Risk Mitigation

### Technical Risks
- **Risk:** Refactoring existing services may break functionality
  - **Mitigation:** Comprehensive testing, feature flags, gradual rollout
- **Risk:** ERP integration complexity
  - **Mitigation:** Start with one ERP, use proven libraries, vendor support

### Resource Risks
- **Risk:** Timeline too aggressive
  - **Mitigation:** Prioritize high-priority items, defer low-priority if needed
- **Risk:** Missing expertise
  - **Mitigation:** Training, external consultants, documentation

### Business Risks
- **Risk:** User adoption
  - **Mitigation:** User training, change management, gradual rollout
- **Risk:** Performance impact
  - **Mitigation:** Performance testing, optimization, monitoring

---

## Next Steps

1. **Review and Approve Plan**
   - Review with stakeholders
   - Adjust priorities if needed
   - Approve timeline

2. **Set Up Project Management**
   - Create project in Jira/Asana/etc.
   - Create tasks from to-do lists
   - Assign resources

3. **Start Phase 1**
   - Begin Data Lineage + Prüfpfad-Dokumentation implementation
   - Set up development environment
   - Create feature branch

4. **Establish Communication**
   - Weekly status updates
   - Monthly stakeholder reviews
   - Issue tracking and resolution

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-XX  
**Next Review:** After Phase 1 completion
