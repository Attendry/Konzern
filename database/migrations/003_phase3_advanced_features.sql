-- =============================================
-- Phase 3 Migration: Advanced Consolidation Features
-- HGB § 306 (Deferred Taxes), § 310 (Proportional), § 312 (Equity Method)
-- Audit Trail, Compliance Checklist, Document Attachments
-- =============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. ENUM TYPES
-- =============================================

-- Deferred Tax Types
DO $$ BEGIN
    CREATE TYPE temporary_difference_type AS ENUM ('deductible', 'taxable');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE deferred_tax_source AS ENUM (
        'capital_consolidation', 'debt_consolidation', 'intercompany_profit',
        'income_expense', 'hidden_reserves', 'goodwill', 'pension_provisions',
        'valuation_adjustment', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE deferred_tax_status AS ENUM ('active', 'reversed', 'written_off');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Audit Types
DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        'create', 'update', 'delete', 'approve', 'reject', 'reverse', 
        'submit', 'import', 'export', 'calculate', 'login', 'logout'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_entity_type AS ENUM (
        'company', 'financial_statement', 'account_balance', 'consolidation_entry',
        'participation', 'exchange_rate', 'intercompany_transaction', 
        'deferred_tax', 'ic_reconciliation', 'user', 'system'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Compliance Types
DO $$ BEGIN
    CREATE TYPE checklist_item_status AS ENUM (
        'not_started', 'in_progress', 'completed', 'not_applicable', 'requires_review'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE compliance_category AS ENUM (
        'capital_consolidation', 'debt_consolidation', 'intercompany_profit',
        'income_expense', 'deferred_tax', 'minority_interest', 'uniform_valuation',
        'currency_translation', 'consolidation_circle', 'equity_method',
        'notes_disclosure', 'general_compliance'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Document Types
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM (
        'supporting_document', 'calculation', 'approval', 'contract',
        'valuation_report', 'audit_confirmation', 'bank_statement', 'invoice', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE attachable_entity_type AS ENUM (
        'consolidation_entry', 'participation', 'intercompany_transaction',
        'deferred_tax', 'ic_reconciliation', 'financial_statement', 'company'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. DEFERRED TAXES TABLE (§ 306 HGB)
-- =============================================

CREATE TABLE IF NOT EXISTS deferred_taxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    difference_type temporary_difference_type NOT NULL,
    source deferred_tax_source NOT NULL,
    description TEXT NOT NULL,
    temporary_difference_amount DECIMAL(15, 2) NOT NULL,
    tax_rate DECIMAL(5, 2) NOT NULL,
    deferred_tax_amount DECIMAL(15, 2) NOT NULL,
    prior_year_amount DECIMAL(15, 2),
    change_amount DECIMAL(15, 2),
    affects_equity BOOLEAN DEFAULT FALSE,
    expected_reversal_year INTEGER,
    originating_entry_id UUID REFERENCES consolidation_entries(id) ON DELETE SET NULL,
    deferred_tax_entry_id UUID REFERENCES consolidation_entries(id) ON DELETE SET NULL,
    status deferred_tax_status DEFAULT 'active',
    hgb_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for deferred_taxes
CREATE INDEX IF NOT EXISTS idx_deferred_taxes_fs ON deferred_taxes(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_deferred_taxes_company ON deferred_taxes(company_id);
CREATE INDEX IF NOT EXISTS idx_deferred_taxes_source ON deferred_taxes(source);
CREATE INDEX IF NOT EXISTS idx_deferred_taxes_status ON deferred_taxes(status);

-- =============================================
-- 3. AUDIT LOGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    action audit_action NOT NULL,
    entity_type audit_entity_type NOT NULL,
    entity_id UUID,
    entity_name VARCHAR(500),
    financial_statement_id UUID,
    company_id UUID,
    before_state JSONB,
    after_state JSONB,
    changes JSONB,
    metadata JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    session_id VARCHAR(255),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_logs (optimized for common queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_fs ON audit_logs(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- =============================================
-- 4. COMPLIANCE CHECKLISTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS compliance_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    category compliance_category NOT NULL,
    item_code VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    hgb_reference VARCHAR(50),
    requirement TEXT,
    status checklist_item_status DEFAULT 'not_started',
    is_mandatory BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 5,
    notes TEXT,
    evidence TEXT,
    related_entity_ids UUID[],
    completed_by_user_id UUID,
    completed_at TIMESTAMPTZ,
    reviewed_by_user_id UUID,
    reviewed_at TIMESTAMPTZ,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(financial_statement_id, item_code)
);

-- Indexes for compliance_checklists
CREATE INDEX IF NOT EXISTS idx_compliance_fs ON compliance_checklists(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_category ON compliance_checklists(category);
CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_checklists(status);
CREATE INDEX IF NOT EXISTS idx_compliance_mandatory ON compliance_checklists(is_mandatory);
CREATE INDEX IF NOT EXISTS idx_compliance_due ON compliance_checklists(due_date);

-- =============================================
-- 5. DOCUMENT ATTACHMENTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS document_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type attachable_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    document_type document_type NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    public_url VARCHAR(1000),
    description TEXT,
    uploaded_by_user_id UUID,
    uploaded_by_user_name VARCHAR(255),
    document_date DATE,
    reference_number VARCHAR(255),
    checksum VARCHAR(64),
    is_required BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by_user_id UUID,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for document_attachments
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON document_attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_doc_type ON document_attachments(document_type);
CREATE INDEX IF NOT EXISTS idx_attachments_verified ON document_attachments(is_verified);

-- =============================================
-- 6. EQUITY METHOD TRACKING TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS equity_method_valuations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    participation_id UUID NOT NULL REFERENCES participations(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    opening_carrying_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    share_of_profit DECIMAL(15, 2) NOT NULL DEFAULT 0,
    dividends_received DECIMAL(15, 2) NOT NULL DEFAULT 0,
    goodwill_amortization DECIMAL(15, 2) NOT NULL DEFAULT 0,
    other_adjustments DECIMAL(15, 2) NOT NULL DEFAULT 0,
    closing_carrying_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    consolidation_entry_ids UUID[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(financial_statement_id, participation_id, fiscal_year)
);

-- Indexes for equity_method_valuations
CREATE INDEX IF NOT EXISTS idx_equity_method_fs ON equity_method_valuations(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_equity_method_participation ON equity_method_valuations(participation_id);
CREATE INDEX IF NOT EXISTS idx_equity_method_year ON equity_method_valuations(fiscal_year);

-- =============================================
-- 7. PROPORTIONAL CONSOLIDATION TRACKING TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS proportional_consolidation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    joint_venture_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    participation_percentage DECIMAL(5, 2) NOT NULL,
    total_assets DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_liabilities DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_equity DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_expenses DECIMAL(15, 2) NOT NULL DEFAULT 0,
    proportional_assets DECIMAL(15, 2) NOT NULL DEFAULT 0,
    proportional_liabilities DECIMAL(15, 2) NOT NULL DEFAULT 0,
    proportional_equity DECIMAL(15, 2) NOT NULL DEFAULT 0,
    proportional_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
    proportional_expenses DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ic_eliminations_assets DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ic_eliminations_liabilities DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ic_eliminations_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ic_eliminations_expenses DECIMAL(15, 2) NOT NULL DEFAULT 0,
    consolidation_entry_ids UUID[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(financial_statement_id, joint_venture_id, fiscal_year)
);

-- Indexes for proportional_consolidation_records
CREATE INDEX IF NOT EXISTS idx_proportional_fs ON proportional_consolidation_records(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_proportional_jv ON proportional_consolidation_records(joint_venture_id);
CREATE INDEX IF NOT EXISTS idx_proportional_year ON proportional_consolidation_records(fiscal_year);

-- =============================================
-- 8. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on new tables
ALTER TABLE deferred_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_method_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE proportional_consolidation_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe recreation)
DROP POLICY IF EXISTS "Enable all for deferred_taxes" ON deferred_taxes;
DROP POLICY IF EXISTS "Enable all for audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Enable all for compliance_checklists" ON compliance_checklists;
DROP POLICY IF EXISTS "Enable all for document_attachments" ON document_attachments;
DROP POLICY IF EXISTS "Enable all for equity_method_valuations" ON equity_method_valuations;
DROP POLICY IF EXISTS "Enable all for proportional_consolidation_records" ON proportional_consolidation_records;

-- Create policies for authenticated users
CREATE POLICY "Enable all for deferred_taxes" ON deferred_taxes
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for audit_logs" ON audit_logs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for compliance_checklists" ON compliance_checklists
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for document_attachments" ON document_attachments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for equity_method_valuations" ON equity_method_valuations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for proportional_consolidation_records" ON proportional_consolidation_records
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

-- Add triggers to new tables
DROP TRIGGER IF EXISTS update_deferred_taxes_updated_at ON deferred_taxes;
CREATE TRIGGER update_deferred_taxes_updated_at
    BEFORE UPDATE ON deferred_taxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_compliance_checklists_updated_at ON compliance_checklists;
CREATE TRIGGER update_compliance_checklists_updated_at
    BEFORE UPDATE ON compliance_checklists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_attachments_updated_at ON document_attachments;
CREATE TRIGGER update_document_attachments_updated_at
    BEFORE UPDATE ON document_attachments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_equity_method_valuations_updated_at ON equity_method_valuations;
CREATE TRIGGER update_equity_method_valuations_updated_at
    BEFORE UPDATE ON equity_method_valuations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proportional_consolidation_records_updated_at ON proportional_consolidation_records;
CREATE TRIGGER update_proportional_consolidation_records_updated_at
    BEFORE UPDATE ON proportional_consolidation_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 10. COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE deferred_taxes IS 'Latente Steuern aus Konsolidierungsmaßnahmen (§ 306 HGB)';
COMMENT ON TABLE audit_logs IS 'Vollständiger Audit-Trail für alle Änderungen im System';
COMMENT ON TABLE compliance_checklists IS 'HGB-Compliance-Checkliste für Konzernabschlüsse';
COMMENT ON TABLE document_attachments IS 'Belege und Dokumente zu Buchungen und Transaktionen';
COMMENT ON TABLE equity_method_valuations IS 'At-Equity-Bewertung assoziierter Unternehmen (§ 312 HGB)';
COMMENT ON TABLE proportional_consolidation_records IS 'Quotenkonsolidierung für Gemeinschaftsunternehmen (§ 310 HGB)';

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
