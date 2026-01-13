-- =============================================
-- Phase 4 Migration: Accounting Policy & Rules Layer (HGB-Specific)
-- Configurable accounting policies, consolidation rules, and GAAP→HGB mappings
-- Enforces HGB-mandatory requirements while allowing flexibility
-- =============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. ENUM TYPES
-- =============================================

-- Policy Category
DO $$ BEGIN
    CREATE TYPE policy_category AS ENUM (
        'valuation',                -- Bewertung
        'recognition',              -- Ansatz
        'consolidation',            -- Konsolidierung
        'presentation',             -- Ausweis
        'disclosure',               -- Anhangangaben
        'currency',                 -- Währung
        'deferred_tax',             -- Latente Steuern
        'goodwill',                 -- Geschäftswert
        'depreciation',             -- Abschreibungen
        'provisions',               -- Rückstellungen
        'leasing',                  -- Leasing
        'financial_instruments',    -- Finanzinstrumente
        'inventory',                -- Vorräte
        'revenue',                  -- Umsatzerlöse
        'other'                     -- Sonstiges
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy Status
DO $$ BEGIN
    CREATE TYPE policy_status AS ENUM (
        'draft',            -- Entwurf
        'active',           -- Aktiv
        'superseded',       -- Abgelöst
        'deprecated'        -- Veraltet
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rule Type
DO $$ BEGIN
    CREATE TYPE consolidation_rule_type AS ENUM (
        'capital_consolidation',        -- Kapitalkonsolidierung § 301 HGB
        'debt_consolidation',           -- Schuldenkonsolidierung § 303 HGB
        'intercompany_profit',          -- Zwischenergebniseliminierung § 304 HGB
        'income_expense',               -- Aufwands-/Ertragskonsolidierung § 305 HGB
        'deferred_tax',                 -- Latente Steuern § 306 HGB
        'minority_interest',            -- Minderheitenanteile § 307 HGB
        'uniform_valuation',            -- Einheitliche Bewertung § 308 HGB
        'currency_translation',         -- Währungsumrechnung § 308a HGB
        'goodwill_treatment',           -- Geschäftswertbehandlung § 309 HGB
        'equity_method',                -- At-Equity-Bewertung § 312 HGB
        'proportional_consolidation',   -- Quotenkonsolidierung § 310 HGB
        'consolidation_scope',          -- Konsolidierungskreis § 294-296 HGB
        'disclosure',                   -- Anhangangaben § 313-314 HGB
        'other'                         -- Sonstiges
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rule Flexibility
DO $$ BEGIN
    CREATE TYPE rule_flexibility AS ENUM (
        'mandatory',        -- Pflicht - keine Abweichung möglich (HGB zwingend)
        'recommended',      -- Empfohlen - Abweichung mit Begründung
        'optional',         -- Wahlrecht - frei wählbar
        'prohibited'        -- Verboten - darf nicht angewendet werden
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- GAAP Standard
DO $$ BEGIN
    CREATE TYPE gaap_standard AS ENUM (
        'hgb',              -- Handelsgesetzbuch
        'ifrs',             -- International Financial Reporting Standards
        'us_gaap',          -- US Generally Accepted Accounting Principles
        'local_gaap',       -- Lokales GAAP (länderspezifisch)
        'other'             -- Sonstige
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Mapping Direction
DO $$ BEGIN
    CREATE TYPE mapping_direction AS ENUM (
        'source_to_hgb',    -- Von Quell-GAAP nach HGB
        'hgb_to_source'     -- Von HGB nach Quell-GAAP (für Abstimmung)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Adjustment Type
DO $$ BEGIN
    CREATE TYPE gaap_adjustment_type AS ENUM (
        'recognition',          -- Ansatzunterschied
        'measurement',          -- Bewertungsunterschied
        'presentation',         -- Ausweisunterschied
        'disclosure',           -- Angabenunterschied
        'timing',               -- Zeitliche Unterschiede
        'permanent',            -- Permanente Unterschiede
        'reclassification'      -- Umgliederung
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. ACCOUNTING POLICIES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS accounting_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category policy_category NOT NULL,
    
    -- HGB Reference
    hgb_reference VARCHAR(100),
    hgb_section TEXT,
    is_hgb_mandatory BOOLEAN DEFAULT FALSE,
    
    -- Policy Details
    policy_text TEXT NOT NULL,
    effective_date DATE NOT NULL,
    expiration_date DATE,
    
    -- Version Control
    version INTEGER DEFAULT 1,
    supersedes_policy_id UUID REFERENCES accounting_policies(id),
    
    -- Status
    status policy_status DEFAULT 'draft',
    
    -- Approval
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    
    -- Audit
    created_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounting_policies_category ON accounting_policies(category);
CREATE INDEX IF NOT EXISTS idx_accounting_policies_status ON accounting_policies(status);
CREATE INDEX IF NOT EXISTS idx_accounting_policies_hgb_mandatory ON accounting_policies(is_hgb_mandatory);
CREATE INDEX IF NOT EXISTS idx_accounting_policies_effective ON accounting_policies(effective_date);

-- =============================================
-- 3. POLICY VERSIONS TABLE (History)
-- =============================================

CREATE TABLE IF NOT EXISTS policy_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES accounting_policies(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- Snapshot of policy at this version
    policy_text TEXT NOT NULL,
    effective_date DATE NOT NULL,
    
    -- Change Information
    change_reason TEXT,
    changed_by_user_id UUID,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Approval
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    
    UNIQUE(policy_id, version)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON policy_versions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_versions_version ON policy_versions(version);

-- =============================================
-- 4. CONSOLIDATION RULES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS consolidation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type consolidation_rule_type NOT NULL,
    
    -- HGB Reference
    hgb_reference VARCHAR(100),
    hgb_description TEXT,
    
    -- Rule Configuration
    flexibility rule_flexibility NOT NULL DEFAULT 'recommended',
    is_hgb_mandatory BOOLEAN DEFAULT FALSE,
    
    -- Rule Logic (JSON configuration)
    rule_config JSONB NOT NULL,
    
    -- Parameters (configurable values)
    parameters JSONB DEFAULT '{}',
    
    -- Thresholds
    threshold_amount DECIMAL(15, 2),
    threshold_percentage DECIMAL(8, 4),
    
    -- Applicability
    applies_to_entity_types TEXT[],      -- 'parent', 'subsidiary', 'joint_venture', 'associate'
    applies_to_industries TEXT[],         -- Industry codes if applicable
    
    -- Ordering
    execution_order INTEGER DEFAULT 100,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Related Policy
    policy_id UUID REFERENCES accounting_policies(id),
    
    -- Audit
    created_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consolidation_rules_type ON consolidation_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_consolidation_rules_flexibility ON consolidation_rules(flexibility);
CREATE INDEX IF NOT EXISTS idx_consolidation_rules_hgb_mandatory ON consolidation_rules(is_hgb_mandatory);
CREATE INDEX IF NOT EXISTS idx_consolidation_rules_active ON consolidation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_consolidation_rules_policy ON consolidation_rules(policy_id);

-- =============================================
-- 5. RULE PARAMETERS TABLE (Per Financial Statement)
-- =============================================

CREATE TABLE IF NOT EXISTS rule_parameter_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES consolidation_rules(id) ON DELETE CASCADE,
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    -- Override Values
    parameter_overrides JSONB NOT NULL,
    
    -- Justification (required for mandatory rules)
    justification TEXT,
    
    -- Approval (required for mandatory rule overrides)
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    
    -- Audit
    created_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(rule_id, financial_statement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rule_overrides_rule ON rule_parameter_overrides(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_overrides_fs ON rule_parameter_overrides(financial_statement_id);

-- =============================================
-- 6. GAAP-HGB MAPPINGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS gaap_hgb_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Source GAAP
    source_gaap gaap_standard NOT NULL,
    source_gaap_reference VARCHAR(100),
    source_gaap_description TEXT,
    
    -- Target (HGB)
    hgb_reference VARCHAR(100),
    hgb_description TEXT,
    
    -- Mapping Details
    direction mapping_direction DEFAULT 'source_to_hgb',
    adjustment_type gaap_adjustment_type NOT NULL,
    
    -- Adjustment Configuration
    adjustment_config JSONB NOT NULL,
    
    -- Affects
    affects_balance_sheet BOOLEAN DEFAULT FALSE,
    affects_income_statement BOOLEAN DEFAULT FALSE,
    affects_equity BOOLEAN DEFAULT FALSE,
    affects_deferred_tax BOOLEAN DEFAULT FALSE,
    
    -- Account Mapping
    source_accounts TEXT[],
    target_accounts TEXT[],
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_material BOOLEAN DEFAULT FALSE,
    
    -- Related Policy
    policy_id UUID REFERENCES accounting_policies(id),
    
    -- Audit
    created_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gaap_mappings_source ON gaap_hgb_mappings(source_gaap);
CREATE INDEX IF NOT EXISTS idx_gaap_mappings_type ON gaap_hgb_mappings(adjustment_type);
CREATE INDEX IF NOT EXISTS idx_gaap_mappings_active ON gaap_hgb_mappings(is_active);

-- =============================================
-- 7. GAAP ADJUSTMENTS TABLE (Per Financial Statement)
-- =============================================

CREATE TABLE IF NOT EXISTS gaap_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    mapping_id UUID NOT NULL REFERENCES gaap_hgb_mappings(id) ON DELETE CASCADE,
    
    -- Source Values (from local GAAP)
    source_gaap gaap_standard NOT NULL,
    source_amount DECIMAL(15, 2) NOT NULL,
    source_account VARCHAR(50),
    
    -- Adjustment
    adjustment_amount DECIMAL(15, 2) NOT NULL,
    adjustment_description TEXT,
    
    -- Target Values (HGB)
    target_amount DECIMAL(15, 2) NOT NULL,
    target_account VARCHAR(50),
    
    -- Deferred Tax Impact
    deferred_tax_impact DECIMAL(15, 2) DEFAULT 0,
    
    -- Consolidation Entry Created
    consolidation_entry_id UUID REFERENCES consolidation_entries(id),
    
    -- Status
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by_user_id UUID,
    reviewed_at TIMESTAMPTZ,
    
    -- Audit
    created_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gaap_adjustments_fs ON gaap_adjustments(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_gaap_adjustments_company ON gaap_adjustments(company_id);
CREATE INDEX IF NOT EXISTS idx_gaap_adjustments_mapping ON gaap_adjustments(mapping_id);
CREATE INDEX IF NOT EXISTS idx_gaap_adjustments_source ON gaap_adjustments(source_gaap);

-- =============================================
-- 8. POLICY APPLICATION LOG TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS policy_application_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    -- Policy or Rule Applied
    policy_id UUID REFERENCES accounting_policies(id),
    rule_id UUID REFERENCES consolidation_rules(id),
    
    -- Application Details
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by_user_id UUID,
    
    -- Result
    was_successful BOOLEAN DEFAULT TRUE,
    result_message TEXT,
    
    -- Values Affected
    affected_amount DECIMAL(15, 2),
    affected_accounts TEXT[],
    
    -- Parameters Used
    parameters_used JSONB,
    
    -- Consolidation Entry Created
    consolidation_entry_id UUID REFERENCES consolidation_entries(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_policy_logs_fs ON policy_application_logs(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_policy_logs_policy ON policy_application_logs(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_logs_rule ON policy_application_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_policy_logs_applied ON policy_application_logs(applied_at);

-- =============================================
-- 9. HGB WAHLRECHTE TABLE (Accounting Options)
-- =============================================

CREATE TABLE IF NOT EXISTS hgb_wahlrechte (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- HGB Reference
    hgb_reference VARCHAR(100) NOT NULL,
    hgb_section TEXT,
    
    -- Options
    option_type VARCHAR(50) NOT NULL,  -- 'recognition', 'measurement', 'presentation'
    available_options JSONB NOT NULL,   -- List of available choices
    default_option VARCHAR(100),
    
    -- Restrictions
    once_chosen_binding BOOLEAN DEFAULT FALSE,  -- Einmal gewählt, bindend
    change_requires_disclosure BOOLEAN DEFAULT TRUE,
    
    -- Documentation
    ifrs_equivalent VARCHAR(100),
    differences_to_ifrs TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wahlrechte_hgb ON hgb_wahlrechte(hgb_reference);
CREATE INDEX IF NOT EXISTS idx_wahlrechte_type ON hgb_wahlrechte(option_type);

-- =============================================
-- 10. WAHLRECHTE SELECTIONS TABLE (Per Company/FS)
-- =============================================

CREATE TABLE IF NOT EXISTS wahlrechte_selections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wahlrecht_id UUID NOT NULL REFERENCES hgb_wahlrechte(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    financial_statement_id UUID REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    -- Selection
    selected_option VARCHAR(100) NOT NULL,
    selection_reason TEXT,
    
    -- Effective Period
    effective_from DATE NOT NULL,
    effective_until DATE,
    
    -- Approval
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    
    -- Audit
    created_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(wahlrecht_id, company_id, effective_from)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wahlrechte_sel_wahlrecht ON wahlrechte_selections(wahlrecht_id);
CREATE INDEX IF NOT EXISTS idx_wahlrechte_sel_company ON wahlrechte_selections(company_id);
CREATE INDEX IF NOT EXISTS idx_wahlrechte_sel_fs ON wahlrechte_selections(financial_statement_id);

-- =============================================
-- 11. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS
ALTER TABLE accounting_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_parameter_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaap_hgb_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaap_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hgb_wahlrechte ENABLE ROW LEVEL SECURITY;
ALTER TABLE wahlrechte_selections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable all for accounting_policies" ON accounting_policies;
DROP POLICY IF EXISTS "Enable all for policy_versions" ON policy_versions;
DROP POLICY IF EXISTS "Enable all for consolidation_rules" ON consolidation_rules;
DROP POLICY IF EXISTS "Enable all for rule_parameter_overrides" ON rule_parameter_overrides;
DROP POLICY IF EXISTS "Enable all for gaap_hgb_mappings" ON gaap_hgb_mappings;
DROP POLICY IF EXISTS "Enable all for gaap_adjustments" ON gaap_adjustments;
DROP POLICY IF EXISTS "Enable all for policy_application_logs" ON policy_application_logs;
DROP POLICY IF EXISTS "Enable all for hgb_wahlrechte" ON hgb_wahlrechte;
DROP POLICY IF EXISTS "Enable all for wahlrechte_selections" ON wahlrechte_selections;

-- Create policies
CREATE POLICY "Enable all for accounting_policies" ON accounting_policies
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for policy_versions" ON policy_versions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for consolidation_rules" ON consolidation_rules
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for rule_parameter_overrides" ON rule_parameter_overrides
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for gaap_hgb_mappings" ON gaap_hgb_mappings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for gaap_adjustments" ON gaap_adjustments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for policy_application_logs" ON policy_application_logs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for hgb_wahlrechte" ON hgb_wahlrechte
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for wahlrechte_selections" ON wahlrechte_selections
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 12. TRIGGERS FOR UPDATED_AT
-- =============================================

-- Trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
DROP TRIGGER IF EXISTS update_accounting_policies_updated_at ON accounting_policies;
CREATE TRIGGER update_accounting_policies_updated_at
    BEFORE UPDATE ON accounting_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_consolidation_rules_updated_at ON consolidation_rules;
CREATE TRIGGER update_consolidation_rules_updated_at
    BEFORE UPDATE ON consolidation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rule_parameter_overrides_updated_at ON rule_parameter_overrides;
CREATE TRIGGER update_rule_parameter_overrides_updated_at
    BEFORE UPDATE ON rule_parameter_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gaap_hgb_mappings_updated_at ON gaap_hgb_mappings;
CREATE TRIGGER update_gaap_hgb_mappings_updated_at
    BEFORE UPDATE ON gaap_hgb_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gaap_adjustments_updated_at ON gaap_adjustments;
CREATE TRIGGER update_gaap_adjustments_updated_at
    BEFORE UPDATE ON gaap_adjustments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hgb_wahlrechte_updated_at ON hgb_wahlrechte;
CREATE TRIGGER update_hgb_wahlrechte_updated_at
    BEFORE UPDATE ON hgb_wahlrechte
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wahlrechte_selections_updated_at ON wahlrechte_selections;
CREATE TRIGGER update_wahlrechte_selections_updated_at
    BEFORE UPDATE ON wahlrechte_selections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 13. COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE accounting_policies IS 'Bilanzierungs- und Bewertungsmethoden (HGB-konform)';
COMMENT ON TABLE policy_versions IS 'Versionierung der Bilanzierungsmethoden';
COMMENT ON TABLE consolidation_rules IS 'Konsolidierungsregeln mit HGB-Pflichtangaben';
COMMENT ON TABLE rule_parameter_overrides IS 'Regelparameter-Überschreibungen pro Abschluss';
COMMENT ON TABLE gaap_hgb_mappings IS 'GAAP-zu-HGB-Anpassungen (z.B. IFRS nach HGB)';
COMMENT ON TABLE gaap_adjustments IS 'Durchgeführte GAAP-Anpassungen pro Gesellschaft';
COMMENT ON TABLE policy_application_logs IS 'Protokoll der Regelanwendungen';
COMMENT ON TABLE hgb_wahlrechte IS 'HGB-Wahlrechte und Optionen';
COMMENT ON TABLE wahlrechte_selections IS 'Gewählte Optionen pro Gesellschaft/Abschluss';

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
