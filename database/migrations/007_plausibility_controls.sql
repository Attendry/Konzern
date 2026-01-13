-- =============================================
-- Phase 4 Migration: Plausibility & Controls Engine (HGB-Specific)
-- Automated validation rules, variance analysis, and exception reporting
-- Based on HGB requirements and German accounting standards
-- =============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. ENUM TYPES
-- =============================================

-- Rule Category (HGB-specific areas)
DO $$ BEGIN
    CREATE TYPE plausibility_rule_category AS ENUM (
        'balance_sheet_structure',      -- Bilanzstrukturprüfungen
        'income_statement_structure',   -- GuV-Strukturprüfungen
        'balance_equation',             -- Bilanzgleichung (Aktiva = Passiva)
        'intercompany_consistency',     -- IC-Konsistenz
        'capital_consolidation',        -- Kapitalkonsolidierung § 301 HGB
        'debt_consolidation',           -- Schuldenkonsolidierung § 303 HGB
        'intercompany_profit',          -- Zwischenergebniseliminierung § 304 HGB
        'income_expense_consolidation', -- Aufwands-/Ertragskonsolidierung § 305 HGB
        'deferred_tax',                 -- Latente Steuern § 306 HGB
        'currency_translation',         -- Währungsumrechnung § 308a HGB
        'minority_interest',            -- Minderheitenanteile § 307 HGB
        'equity_method',                -- At-Equity-Bewertung § 312 HGB
        'proportional_consolidation',   -- Quotenkonsolidierung § 310 HGB
        'year_over_year',               -- Vorjahresvergleich
        'materiality',                  -- Wesentlichkeitsprüfungen
        'disclosure_completeness',      -- Vollständigkeit der Angaben
        'custom'                        -- Benutzerdefinierte Regeln
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rule Severity
DO $$ BEGIN
    CREATE TYPE plausibility_rule_severity AS ENUM (
        'error',        -- Fehler - muss korrigiert werden
        'warning',      -- Warnung - sollte überprüft werden
        'info'          -- Information - zur Kenntnisnahme
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Check Result Status
DO $$ BEGIN
    CREATE TYPE plausibility_check_status AS ENUM (
        'passed',           -- Prüfung bestanden
        'failed',           -- Prüfung nicht bestanden
        'warning',          -- Warnung ausgelöst
        'skipped',          -- Übersprungen (nicht anwendbar)
        'acknowledged',     -- Zur Kenntnis genommen (aber nicht behoben)
        'waived'            -- Ausnahme genehmigt
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Variance Type
DO $$ BEGIN
    CREATE TYPE variance_type AS ENUM (
        'absolute',         -- Absolute Abweichung in EUR
        'percentage',       -- Prozentuale Abweichung
        'both'              -- Beide Arten
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Variance Significance
DO $$ BEGIN
    CREATE TYPE variance_significance AS ENUM (
        'material',         -- Wesentliche Abweichung
        'significant',      -- Signifikante Abweichung
        'minor',            -- Geringe Abweichung
        'immaterial'        -- Unwesentliche Abweichung
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Exception Status
DO $$ BEGIN
    CREATE TYPE exception_status AS ENUM (
        'open',             -- Offen
        'in_review',        -- In Prüfung
        'resolved',         -- Gelöst
        'escalated',        -- Eskaliert
        'waived',           -- Genehmigt ohne Korrektur
        'closed'            -- Geschlossen
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Exception Priority
DO $$ BEGIN
    CREATE TYPE exception_priority AS ENUM (
        'critical',         -- Kritisch - sofortige Bearbeitung
        'high',             -- Hoch - zeitnah bearbeiten
        'medium',           -- Mittel - im Rahmen des Close bearbeiten
        'low'               -- Niedrig - zur Kenntnisnahme
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. PLAUSIBILITY RULES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS plausibility_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category plausibility_rule_category NOT NULL,
    severity plausibility_rule_severity NOT NULL DEFAULT 'warning',
    
    -- HGB Reference
    hgb_reference VARCHAR(100),
    hgb_description TEXT,
    
    -- Rule Definition
    rule_type VARCHAR(50) NOT NULL, -- 'formula', 'comparison', 'threshold', 'custom'
    rule_expression TEXT NOT NULL, -- JSON expression defining the rule logic
    
    -- Thresholds
    threshold_absolute DECIMAL(15, 2),    -- Absolute threshold in EUR
    threshold_percentage DECIMAL(8, 4),   -- Percentage threshold
    tolerance_amount DECIMAL(15, 2) DEFAULT 0.01, -- Tolerance for rounding differences
    
    -- Applicability
    applies_to_entity_types TEXT[], -- 'parent', 'subsidiary', 'joint_venture', 'associate'
    applies_to_consolidation_types TEXT[], -- 'full', 'proportional', 'equity'
    applies_to_statement_types TEXT[], -- 'balance_sheet', 'income_statement', 'cash_flow', 'notes'
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_mandatory BOOLEAN DEFAULT FALSE,
    is_hgb_required BOOLEAN DEFAULT FALSE,
    
    -- Ordering
    execution_order INTEGER DEFAULT 100,
    
    -- Metadata
    created_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plausibility_rules_category ON plausibility_rules(category);
CREATE INDEX IF NOT EXISTS idx_plausibility_rules_severity ON plausibility_rules(severity);
CREATE INDEX IF NOT EXISTS idx_plausibility_rules_active ON plausibility_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_plausibility_rules_mandatory ON plausibility_rules(is_mandatory);
CREATE INDEX IF NOT EXISTS idx_plausibility_rules_hgb ON plausibility_rules(is_hgb_required);

-- =============================================
-- 3. PLAUSIBILITY CHECKS TABLE (Execution Results)
-- =============================================

CREATE TABLE IF NOT EXISTS plausibility_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES plausibility_rules(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Execution Details
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by_user_id UUID,
    
    -- Result
    status plausibility_check_status NOT NULL DEFAULT 'passed',
    
    -- Values
    expected_value DECIMAL(15, 2),
    actual_value DECIMAL(15, 2),
    difference_value DECIMAL(15, 2),
    difference_percentage DECIMAL(8, 4),
    
    -- Context
    context JSONB, -- Additional context data for the check
    affected_accounts TEXT[],
    affected_entries UUID[],
    
    -- Messages
    message TEXT,
    details TEXT,
    
    -- Resolution
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by_user_id UUID,
    acknowledgment_comment TEXT,
    waived_at TIMESTAMPTZ,
    waived_by_user_id UUID,
    waiver_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plausibility_checks_fs ON plausibility_checks(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_plausibility_checks_rule ON plausibility_checks(rule_id);
CREATE INDEX IF NOT EXISTS idx_plausibility_checks_company ON plausibility_checks(company_id);
CREATE INDEX IF NOT EXISTS idx_plausibility_checks_status ON plausibility_checks(status);
CREATE INDEX IF NOT EXISTS idx_plausibility_checks_executed ON plausibility_checks(executed_at);

-- =============================================
-- 4. VARIANCE ANALYSES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS variance_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    prior_financial_statement_id UUID REFERENCES financial_statements(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Variance Type
    variance_type variance_type NOT NULL DEFAULT 'both',
    analysis_level VARCHAR(50) NOT NULL, -- 'total', 'company', 'account', 'line_item'
    
    -- Identification
    account_number VARCHAR(50),
    account_name VARCHAR(255),
    line_item_code VARCHAR(50),
    line_item_name VARCHAR(255),
    
    -- Current Period Values
    current_period_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    current_period_year INTEGER NOT NULL,
    
    -- Prior Period Values
    prior_period_value DECIMAL(15, 2) DEFAULT 0,
    prior_period_year INTEGER,
    
    -- Variance Calculations
    absolute_variance DECIMAL(15, 2) DEFAULT 0,
    percentage_variance DECIMAL(8, 4) DEFAULT 0,
    
    -- Thresholds
    threshold_absolute DECIMAL(15, 2),
    threshold_percentage DECIMAL(8, 4),
    
    -- Significance
    significance variance_significance NOT NULL DEFAULT 'immaterial',
    is_material BOOLEAN DEFAULT FALSE,
    
    -- Explanation
    explanation TEXT,
    explanation_category VARCHAR(100), -- 'business_activity', 'accounting_change', 'consolidation_circle', 'one_time', 'currency', 'other'
    explained_by_user_id UUID,
    explained_at TIMESTAMPTZ,
    
    -- Review
    reviewed_by_user_id UUID,
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_variance_fs ON variance_analyses(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_variance_prior_fs ON variance_analyses(prior_financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_variance_company ON variance_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_variance_significance ON variance_analyses(significance);
CREATE INDEX IF NOT EXISTS idx_variance_material ON variance_analyses(is_material);
CREATE INDEX IF NOT EXISTS idx_variance_account ON variance_analyses(account_number);

-- =============================================
-- 5. EXCEPTION REPORTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS exception_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Source
    source_type VARCHAR(50) NOT NULL, -- 'plausibility_check', 'variance_analysis', 'validation_error', 'manual'
    source_id UUID, -- Reference to plausibility_check or variance_analysis
    
    -- Exception Details
    exception_code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Classification
    category plausibility_rule_category,
    priority exception_priority NOT NULL DEFAULT 'medium',
    status exception_status NOT NULL DEFAULT 'open',
    
    -- Impact
    impact_amount DECIMAL(15, 2),
    impact_description TEXT,
    affects_disclosure BOOLEAN DEFAULT FALSE,
    affects_audit_opinion BOOLEAN DEFAULT FALSE,
    
    -- Assignment
    assigned_to_user_id UUID,
    assigned_at TIMESTAMPTZ,
    assigned_by_user_id UUID,
    
    -- Resolution
    resolution TEXT,
    resolution_type VARCHAR(50), -- 'correction', 'adjustment', 'waiver', 'explanation'
    resolved_at TIMESTAMPTZ,
    resolved_by_user_id UUID,
    
    -- Escalation
    escalated_at TIMESTAMPTZ,
    escalated_to_user_id UUID,
    escalation_reason TEXT,
    
    -- Audit Trail
    action_log JSONB DEFAULT '[]'::JSONB,
    
    -- Due Date
    due_date DATE,
    
    -- HGB Reference
    hgb_reference VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exception_fs ON exception_reports(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_exception_company ON exception_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_exception_status ON exception_reports(status);
CREATE INDEX IF NOT EXISTS idx_exception_priority ON exception_reports(priority);
CREATE INDEX IF NOT EXISTS idx_exception_assigned ON exception_reports(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_exception_source ON exception_reports(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_exception_due ON exception_reports(due_date);

-- =============================================
-- 6. PLAUSIBILITY CHECK RUNS TABLE (Batch Execution)
-- =============================================

CREATE TABLE IF NOT EXISTS plausibility_check_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    -- Execution
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    executed_by_user_id UUID,
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
    
    -- Results Summary
    total_rules INTEGER DEFAULT 0,
    passed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    
    -- Categories
    categories_checked TEXT[],
    
    -- Error Information
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_check_runs_fs ON plausibility_check_runs(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_check_runs_status ON plausibility_check_runs(status);
CREATE INDEX IF NOT EXISTS idx_check_runs_started ON plausibility_check_runs(started_at);

-- =============================================
-- 7. MATERIALITY THRESHOLDS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS materiality_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    -- Basis for Materiality
    basis_type VARCHAR(50) NOT NULL, -- 'total_assets', 'total_revenue', 'equity', 'profit_before_tax', 'custom'
    basis_amount DECIMAL(15, 2) NOT NULL,
    
    -- Materiality Levels
    planning_materiality DECIMAL(15, 2) NOT NULL, -- Planungswesentlichkeit
    performance_materiality DECIMAL(15, 2) NOT NULL, -- Durchführungswesentlichkeit
    trivial_threshold DECIMAL(15, 2) NOT NULL, -- Clearly trivial threshold
    
    -- Percentages
    planning_percentage DECIMAL(8, 4) NOT NULL,
    performance_percentage DECIMAL(8, 4) NOT NULL,
    trivial_percentage DECIMAL(8, 4) NOT NULL,
    
    -- Qualitative Factors
    qualitative_factors JSONB,
    
    -- Notes
    notes TEXT,
    
    -- Approval
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_materiality_fs ON materiality_thresholds(financial_statement_id);

-- =============================================
-- 8. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on new tables
ALTER TABLE plausibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE plausibility_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE variance_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE exception_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE plausibility_check_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiality_thresholds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all for plausibility_rules" ON plausibility_rules;
DROP POLICY IF EXISTS "Enable all for plausibility_checks" ON plausibility_checks;
DROP POLICY IF EXISTS "Enable all for variance_analyses" ON variance_analyses;
DROP POLICY IF EXISTS "Enable all for exception_reports" ON exception_reports;
DROP POLICY IF EXISTS "Enable all for plausibility_check_runs" ON plausibility_check_runs;
DROP POLICY IF EXISTS "Enable all for materiality_thresholds" ON materiality_thresholds;

-- Create policies
CREATE POLICY "Enable all for plausibility_rules" ON plausibility_rules
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for plausibility_checks" ON plausibility_checks
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for variance_analyses" ON variance_analyses
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for exception_reports" ON exception_reports
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for plausibility_check_runs" ON plausibility_check_runs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for materiality_thresholds" ON materiality_thresholds
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 9. TRIGGERS FOR UPDATED_AT
-- =============================================

-- Trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
DROP TRIGGER IF EXISTS update_plausibility_rules_updated_at ON plausibility_rules;
CREATE TRIGGER update_plausibility_rules_updated_at
    BEFORE UPDATE ON plausibility_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plausibility_checks_updated_at ON plausibility_checks;
CREATE TRIGGER update_plausibility_checks_updated_at
    BEFORE UPDATE ON plausibility_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_variance_analyses_updated_at ON variance_analyses;
CREATE TRIGGER update_variance_analyses_updated_at
    BEFORE UPDATE ON variance_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exception_reports_updated_at ON exception_reports;
CREATE TRIGGER update_exception_reports_updated_at
    BEFORE UPDATE ON exception_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plausibility_check_runs_updated_at ON plausibility_check_runs;
CREATE TRIGGER update_plausibility_check_runs_updated_at
    BEFORE UPDATE ON plausibility_check_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_materiality_thresholds_updated_at ON materiality_thresholds;
CREATE TRIGGER update_materiality_thresholds_updated_at
    BEFORE UPDATE ON materiality_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 10. COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE plausibility_rules IS 'Plausibilitätsregeln für automatisierte Prüfungen (HGB-konform)';
COMMENT ON TABLE plausibility_checks IS 'Ergebnisse der Plausibilitätsprüfungen';
COMMENT ON TABLE variance_analyses IS 'Vorjahresvergleiche und Abweichungsanalysen';
COMMENT ON TABLE exception_reports IS 'Ausnahmeberichte und offene Punkte';
COMMENT ON TABLE plausibility_check_runs IS 'Protokoll der Prüfläufe';
COMMENT ON TABLE materiality_thresholds IS 'Wesentlichkeitsgrenzen für Prüfungen';

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
