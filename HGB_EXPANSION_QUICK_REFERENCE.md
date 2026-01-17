# HGB Expansion: Quick Reference Guide

**Date:** January 2026  
**Purpose:** Quick reference for the HGB expansion architecture and development plan

---

## Strategic Expansion Vectors (Ranked by Leverage)

### 1. Governance & Documentation Layer (Highest Leverage)
**Why:** Locks in institutional memory, creates switching costs, audit defensibility

**Key Features:**
- Judgment capture for consolidation entries
- Approval workflows with state machine
- Assumption documentation with versioning
- Precedent tracking ("We handled this in 2020")
- Policy library with versioning

**Implementation:** Phase 1 (Months 1-3)

---

### 2. Pre-Close Intelligence (High Leverage)
**Why:** Reduces close-time surprises, enables proactive management

**Key Features:**
- Automatic ownership change detection
- Entity lifecycle tracking
- Auto-triggered consolidation obligation reassessment
- Early warning system for intercompany mismatches
- Pre-close dashboard

**Implementation:** Phase 2 (Months 4-6)

---

### 3. Tax & Transfer Pricing Integration (High Leverage)
**Why:** Regulatory urgency (Growth Opportunities Act 2024), decision support

**Key Features:**
- Tax impact analysis ("if we change this entry, what's the tax impact?")
- Transfer pricing compliance (business purpose, debt serviceability)
- Intercompany financing compliance (Growth Opportunities Act 2024)
- Tax-consolidation alignment
- Tax disclosure generation

**Implementation:** Phase 3 (Months 7-9)

---

### 4. ESG/Sustainability Integration (Medium-High Leverage)
**Why:** Regulatory mandate (CSRD, IDW FAB 15), market demand

**Key Features:**
- ESG data consolidation
- Emissions accounting (IDW FAB 15: emissions trading, GHG quotas)
- CSRD compliance
- Sustainability-audit alignment
- Integrated financial + non-financial reporting

**Implementation:** Phase 4 (Months 10-12)

---

### 5. Post-Close Decision Surfaces (Medium Leverage)
**Why:** Decision support, strategic value

**Key Features:**
- Audit query resolution workflow
- Scenario analysis (what-if planning)
- Variance analysis enhancement
- Decision trade-off surfaces
- Impact analysis across dimensions

**Implementation:** Phase 5 (Months 13-15)

---

### 6. Structural Complexity Management (Medium Leverage)
**Why:** Entity complexity, dual GAAP support

**Key Features:**
- Advanced entity lifecycle management
- Ownership structure snapshots and visualization
- Dual GAAP management (HGB + IFRS)
- Structural complexity analyzer
- Complexity dashboard

**Implementation:** Phase 6 (Months 16-18)

---

## Architecture Patterns

### Event-Driven Architecture
- **Purpose:** Automatic triggers for pre-close intelligence
- **Key Events:** OwnershipChangeDetected, EntityCreated, PolicyChanged
- **Implementation:** `EventOrchestratorService`

### Judgment-First Data Model
- **Purpose:** Capture judgments as first-class entities
- **Key Entities:** `ConsolidationJudgment`, `Assumption`, `Precedent`, `PolicyVersion`
- **Implementation:** New tables + `JudgmentCaptureService`

### Workflow Engine Pattern
- **Purpose:** Approval workflows and cross-functional processes
- **Workflow Types:** Judgment approval, exception approval, policy change
- **Implementation:** `WorkflowEngineService` with state machine

### Policy & Rules Engine
- **Purpose:** Centralize policies with versioning
- **Policy Types:** Consolidation methods, exception handling, valuation, tax alignment
- **Implementation:** `PolicyEngineService` + `policy_versions` table

---

## Database Schema Highlights

### Governance Tables
- `consolidation_judgments` - Judgment capture
- `assumptions` - Assumption documentation with versioning
- `precedents` - Historical decision tracking
- `workflow_instances` - Workflow state tracking
- `workflow_steps` - Workflow step history

### Pre-Close Intelligence Tables
- `entity_lifecycle_events` - Entity creation, restructuring, liquidation
- `ownership_change_events` - Ownership change tracking with triggers
- `pre_close_alerts` - Early warning system

### Tax & Transfer Pricing Tables
- `tax_impact_analyses` - Tax impact calculations
- `transfer_pricing_documentation` - TP compliance
- `intercompany_financing_compliance` - Growth Opportunities Act 2024

### ESG Tables
- `esg_data_points` - ESG metrics per entity
- `emissions_accounting` - IDW FAB 15 compliance
- `csrd_disclosures` - CSRD compliance tracking

---

## Key Services by Phase

### Phase 1: Governance
- `JudgmentCaptureService` - Capture judgments
- `WorkflowEngineService` - Approval workflows
- `AssumptionService` - Assumption management
- `PrecedentTrackerService` - Precedent tracking
- `PolicyEngineService` - Policy management

### Phase 2: Pre-Close Intelligence
- `EventOrchestratorService` - Event-driven architecture
- `OwnershipChangeMonitorService` - Ownership change detection
- `EntityLifecycleTrackerService` - Entity lifecycle tracking
- `PreCloseIntelligenceService` - Pre-close dashboard
- `AutoReassessmentService` - Automatic reassessment

### Phase 3: Tax & Transfer Pricing
- `TaxImpactAnalyzerService` - Tax impact analysis
- `TransferPricingComplianceService` - TP compliance
- `IntercompanyFinancingComplianceService` - Growth Opportunities Act 2024
- `TaxConsolidationAlignmentService` - Tax-consolidation alignment
- `TaxDisclosureService` - Tax disclosure generation

### Phase 4: ESG
- `ESGDataConsolidationService` - ESG data consolidation
- `EmissionsAccountingService` - IDW FAB 15 compliance
- `CSRDComplianceService` - CSRD compliance
- `SustainabilityAuditAlignmentService` - Sustainability-audit alignment

### Phase 5: Decision Surfaces
- `AuditQueryResolutionService` - Audit query management
- `ScenarioAnalysisService` - Scenario analysis
- `VarianceAnalysisService` - Enhanced variance analysis
- `DecisionTradeoffService` - Decision trade-offs

### Phase 6: Structural Complexity
- `EntityLifecycleManagerService` - Advanced entity lifecycle
- `OwnershipStructureManagerService` - Ownership structure management
- `DualGAAPManagerService` - Dual GAAP management
- `StructuralComplexityAnalyzerService` - Complexity analysis

---

## Success Metrics

### Phase 1: Governance
- 80% of consolidation judgments captured
- 50% reduction in WP query resolution time
- 90% of consolidation policies documented

### Phase 2: Pre-Close Intelligence
- 70% of ownership changes detected automatically
- 60% reduction in close-time surprises
- 80% of consolidation obligation assessments documented

### Phase 3: Tax & Transfer Pricing
- 60% of tax impact questions answered in tool
- 70% of transfer pricing compliance documented
- 50% reduction in tax-consolidation misalignments

### Phase 4: ESG
- 70% of ESG data consolidated in tool
- 80% of emissions accounting compliant with IDW FAB 15
- 60% of CSRD disclosures prepared in tool

### Phase 5: Decision Surfaces
- 50% reduction in WP query resolution time
- 40% of strategic decisions supported by tool
- 60% of variance analyses done in tool

### Phase 6: Structural Complexity
- 90% of entity lifecycle events tracked automatically
- 80% of ownership changes detected automatically
- 70% of structural complexity questions answered in tool

---

## Integration Points

### With Existing Consolidation Services
- Hook into `ConsolidationService.createEntry()` for judgment capture
- Enhance `ConsolidationObligationService` for exception justifications
- Extend `FirstConsolidationService` for goodwill calculation judgments

### With AI System
- Precedent suggestions based on situation similarity
- Judgment summary generation
- Policy compliance checking
- Anomaly detection for pre-close data
- Tax optimization suggestions

### With Participation Service
- Hook into `ParticipationService.recordOwnershipChange()` to emit events
- Auto-trigger consolidation obligation reassessment

---

## Technical Stack

### Backend
- **Framework:** NestJS (existing)
- **Database:** Supabase/PostgreSQL (existing)
- **State Machine:** XState or similar (new)
- **Event Store:** Supabase or EventStore (new)

### Frontend
- **Framework:** React + TypeScript (existing)
- **State Management:** React Context + hooks, consider Zustand/Redux Toolkit
- **UI Components:** Extend existing component library

### AI Integration
- **LLM:** Google Gemini (existing)
- **New Tools:** PrecedentSuggestionTool, TaxOptimizationSuggestionTool
- **Enhancements:** Precedent matching with embeddings, anomaly detection

---

## Risk Mitigation

### Technical Risks
- **Event-driven complexity:** Start simple, use proven patterns
- **Workflow engine complexity:** Use state machine library, start with simple workflows
- **Performance impact:** Async processing, optional features, caching

### Business Risks
- **User adoption:** Make features optional initially, provide value proposition, training
- **Regulatory changes:** Design for flexibility, version policies, maintain expertise
- **Integration complexity:** Start with manual integration, build APIs for automation

### Data Risks
- **Migration complexity:** Incremental migration, rollback capability, thorough testing
- **Data quality:** Validation, quality checks, human-in-the-loop for critical decisions

---

## Next Steps

1. **Review & Validation**
   - Review architecture with domain experts
   - Validate expansion vectors with stakeholders
   - Prioritize Phase 1 tasks

2. **Phase 1 Preparation**
   - Set up development environment
   - Create database migration templates
   - Set up state machine library
   - Design judgment capture UI mockups

3. **Phase 1 Implementation**
   - Database migrations for governance tables
   - Backend services: JudgmentCaptureService, WorkflowEngineService
   - Frontend components: JudgmentCaptureForm, ApprovalWorkflowUI
   - Integration with existing consolidation services

---

**Full Documentation:** See `HGB_EXPANSION_ARCHITECTURE_AND_PLAN.md` for complete details.
