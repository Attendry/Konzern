-- =============================================
-- Phase 5 Migration: Konzernanhang Enhancement (HGB § 313-314)
-- Enhanced Notes Generation with Audit Trail
-- Full compliance with German Commercial Code disclosures
-- =============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. ENUM TYPES
-- =============================================

-- Disclosure types for Konzernanhang
DO $$ BEGIN
    CREATE TYPE disclosure_type AS ENUM (
        'consolidation_scope',           -- § 313 Abs. 2 Nr. 1-3
        'consolidation_methods',         -- § 313 Abs. 1 Nr. 1
        'accounting_policies',           -- § 313 Abs. 1 Nr. 2
        'goodwill',                      -- § 313 Abs. 1 Nr. 3
        'minority_interests',            -- § 307 HGB
        'intercompany_transactions',     -- § 313 Abs. 2 Nr. 5
        'currency_translation',          -- § 313 Abs. 1 Nr. 2
        'deferred_taxes',               -- § 306, § 314 Abs. 1 Nr. 21
        'contingent_liabilities',        -- § 314 Abs. 1 Nr. 2
        'financial_instruments',         -- § 314 Abs. 1 Nr. 10-11
        'employees',                     -- § 314 Abs. 1 Nr. 4
        'board_compensation',           -- § 314 Abs. 1 Nr. 6
        'significant_events',            -- § 314 Abs. 1 Nr. 25
        'subsequent_events',             -- § 314 Abs. 1 Nr. 25
        'related_parties',              -- § 314 Abs. 1 Nr. 13
        'segment_reporting',             -- § 314 Abs. 1 Nr. 3
        'research_development',          -- § 314 Abs. 1 Nr. 9
        'other_mandatory',               -- Other mandatory disclosures
        'voluntary'                      -- Voluntary disclosures
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Note section status
DO $$ BEGIN
    CREATE TYPE note_section_status AS ENUM (
        'draft',                -- Being prepared
        'review_pending',       -- Awaiting review
        'reviewed',             -- Reviewed, not finalized
        'finalized',            -- Finalized for publication
        'superseded'            -- Replaced by newer version
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Export format types
DO $$ BEGIN
    CREATE TYPE export_format AS ENUM (
        'json',
        'text',
        'markdown',
        'html',
        'pdf',
        'word_docx',
        'xbrl'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. KONZERNANHANG DOCUMENTS TABLE
-- Main document tracking for each fiscal year
-- =============================================

CREATE TABLE IF NOT EXISTS konzernanhang_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    -- Version control
    version INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN DEFAULT TRUE,
    superseded_by_id UUID REFERENCES konzernanhang_documents(id),
    
    -- Document metadata
    fiscal_year INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    document_title VARCHAR(500) DEFAULT 'Konzernanhang',
    
    -- Status
    status note_section_status DEFAULT 'draft',
    
    -- Content summary
    total_sections INTEGER DEFAULT 0,
    completed_sections INTEGER DEFAULT 0,
    
    -- Generation metadata
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by_user_id UUID,
    generated_by_name VARCHAR(255),
    
    -- Review workflow
    reviewed_by_user_id UUID,
    reviewed_by_name VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Final approval
    approved_by_user_id UUID,
    approved_by_name VARCHAR(255),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Audit metadata
    last_exported_at TIMESTAMPTZ,
    last_export_format export_format,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(financial_statement_id, version)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_konzernanhang_docs_fs ON konzernanhang_documents(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_konzernanhang_docs_year ON konzernanhang_documents(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_konzernanhang_docs_status ON konzernanhang_documents(status);
CREATE INDEX IF NOT EXISTS idx_konzernanhang_docs_current ON konzernanhang_documents(is_current) WHERE is_current = TRUE;

-- =============================================
-- 3. KONZERNANHANG SECTIONS TABLE
-- Individual disclosure sections
-- =============================================

CREATE TABLE IF NOT EXISTS konzernanhang_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES konzernanhang_documents(id) ON DELETE CASCADE,
    
    -- Section identification
    disclosure_type disclosure_type NOT NULL,
    section_number VARCHAR(20),          -- e.g., "1", "2.1", "3.2.1"
    section_title VARCHAR(500) NOT NULL,
    
    -- HGB reference
    hgb_section VARCHAR(100),            -- e.g., "§ 313 Abs. 2 Nr. 1"
    is_mandatory BOOLEAN DEFAULT TRUE,
    
    -- Content
    content_text TEXT,                   -- Narrative text
    content_json JSONB,                  -- Structured data (tables, breakdowns)
    content_html TEXT,                   -- Formatted HTML content
    
    -- Auto-generated vs manual
    is_auto_generated BOOLEAN DEFAULT FALSE,
    auto_generation_source VARCHAR(100), -- Which service generated this
    manual_override BOOLEAN DEFAULT FALSE,
    
    -- Status
    status note_section_status DEFAULT 'draft',
    
    -- Change tracking
    has_changes_from_prior_year BOOLEAN DEFAULT FALSE,
    prior_year_comparison TEXT,
    
    -- Ordering
    display_order INTEGER DEFAULT 0,
    
    -- Prepared by
    prepared_by_user_id UUID,
    prepared_by_name VARCHAR(255),
    prepared_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Reviewed by
    reviewed_by_user_id UUID,
    reviewed_by_name VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_konzernanhang_sections_doc ON konzernanhang_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_konzernanhang_sections_type ON konzernanhang_sections(disclosure_type);
CREATE INDEX IF NOT EXISTS idx_konzernanhang_sections_order ON konzernanhang_sections(display_order);
CREATE INDEX IF NOT EXISTS idx_konzernanhang_sections_status ON konzernanhang_sections(status);

-- =============================================
-- 4. KONZERNANHANG EXPORTS TABLE
-- Track all exports for audit trail
-- =============================================

CREATE TABLE IF NOT EXISTS konzernanhang_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES konzernanhang_documents(id) ON DELETE CASCADE,
    
    -- Export details
    export_format export_format NOT NULL,
    file_name VARCHAR(500),
    file_size BIGINT,
    file_path VARCHAR(1000),
    
    -- Content hash for integrity
    content_hash VARCHAR(64),
    
    -- Export metadata
    exported_by_user_id UUID,
    exported_by_name VARCHAR(255),
    exported_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Purpose
    export_purpose VARCHAR(255),         -- 'audit', 'publication', 'review', etc.
    recipient VARCHAR(255),              -- Who received this export
    
    -- Download tracking
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_konzernanhang_exports_doc ON konzernanhang_exports(document_id);
CREATE INDEX IF NOT EXISTS idx_konzernanhang_exports_format ON konzernanhang_exports(export_format);
CREATE INDEX IF NOT EXISTS idx_konzernanhang_exports_date ON konzernanhang_exports(exported_at DESC);

-- =============================================
-- 5. KONZERNANHANG TEMPLATES TABLE
-- Reusable templates for note sections
-- =============================================

CREATE TABLE IF NOT EXISTS konzernanhang_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Template identification
    disclosure_type disclosure_type NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    template_description TEXT,
    
    -- Template content
    content_template TEXT NOT NULL,      -- Template with placeholders
    placeholder_schema JSONB,            -- Schema for placeholders
    
    -- HGB reference
    hgb_section VARCHAR(100),
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    -- Ownership
    created_by_user_id UUID,
    is_system_template BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_konzernanhang_templates_type ON konzernanhang_templates(disclosure_type);
CREATE INDEX IF NOT EXISTS idx_konzernanhang_templates_default ON konzernanhang_templates(is_default);

-- =============================================
-- 6. ADDITIONAL DISCLOSURE DATA TABLES
-- =============================================

-- Employee information disclosure (§ 314 Abs. 1 Nr. 4)
CREATE TABLE IF NOT EXISTS disclosure_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    
    fiscal_year INTEGER NOT NULL,
    average_employees INTEGER,
    employees_by_category JSONB,  -- {"management": 5, "production": 100, "administration": 20}
    personnel_expenses DECIMAL(15, 2),
    social_security_expenses DECIMAL(15, 2),
    pension_expenses DECIMAL(15, 2),
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(financial_statement_id, company_id, fiscal_year)
);

-- Board compensation disclosure (§ 314 Abs. 1 Nr. 6)
CREATE TABLE IF NOT EXISTS disclosure_board_compensation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    fiscal_year INTEGER NOT NULL,
    board_type VARCHAR(50),              -- 'vorstand', 'aufsichtsrat', 'beirat'
    total_compensation DECIMAL(15, 2),
    fixed_compensation DECIMAL(15, 2),
    variable_compensation DECIMAL(15, 2),
    pension_provisions DECIMAL(15, 2),
    other_benefits DECIMAL(15, 2),
    
    -- Former members
    former_members_compensation DECIMAL(15, 2),
    pension_obligations_former DECIMAL(15, 2),
    
    notes TEXT,
    waiver_applied BOOLEAN DEFAULT FALSE,  -- § 314 Abs. 3 waiver
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(financial_statement_id, fiscal_year, board_type)
);

-- Contingent liabilities disclosure (§ 314 Abs. 1 Nr. 2)
CREATE TABLE IF NOT EXISTS disclosure_contingent_liabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    liability_type VARCHAR(100),         -- 'warranty', 'guarantee', 'litigation', etc.
    description TEXT NOT NULL,
    maximum_exposure DECIMAL(15, 2),
    expected_amount DECIMAL(15, 2),
    probability VARCHAR(50),             -- 'probable', 'possible', 'remote'
    
    related_company_id UUID REFERENCES companies(id),
    third_party VARCHAR(255),
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subsequent events disclosure (§ 314 Abs. 1 Nr. 25)
CREATE TABLE IF NOT EXISTS disclosure_subsequent_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    event_date DATE NOT NULL,
    event_type VARCHAR(100),
    description TEXT NOT NULL,
    financial_impact DECIMAL(15, 2),
    requires_adjustment BOOLEAN DEFAULT FALSE,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for disclosure tables
CREATE INDEX IF NOT EXISTS idx_disclosure_employees_fs ON disclosure_employees(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_board_fs ON disclosure_board_compensation(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_contingent_fs ON disclosure_contingent_liabilities(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_events_fs ON disclosure_subsequent_events(financial_statement_id);

-- =============================================
-- 7. ROW LEVEL SECURITY
-- =============================================

ALTER TABLE konzernanhang_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE konzernanhang_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE konzernanhang_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE konzernanhang_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosure_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosure_board_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosure_contingent_liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosure_subsequent_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all for konzernanhang_documents" ON konzernanhang_documents;
DROP POLICY IF EXISTS "Enable all for konzernanhang_sections" ON konzernanhang_sections;
DROP POLICY IF EXISTS "Enable all for konzernanhang_exports" ON konzernanhang_exports;
DROP POLICY IF EXISTS "Enable all for konzernanhang_templates" ON konzernanhang_templates;
DROP POLICY IF EXISTS "Enable all for disclosure_employees" ON disclosure_employees;
DROP POLICY IF EXISTS "Enable all for disclosure_board_compensation" ON disclosure_board_compensation;
DROP POLICY IF EXISTS "Enable all for disclosure_contingent_liabilities" ON disclosure_contingent_liabilities;
DROP POLICY IF EXISTS "Enable all for disclosure_subsequent_events" ON disclosure_subsequent_events;

-- Create policies
CREATE POLICY "Enable all for konzernanhang_documents" ON konzernanhang_documents
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for konzernanhang_sections" ON konzernanhang_sections
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for konzernanhang_exports" ON konzernanhang_exports
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for konzernanhang_templates" ON konzernanhang_templates
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for disclosure_employees" ON disclosure_employees
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for disclosure_board_compensation" ON disclosure_board_compensation
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for disclosure_contingent_liabilities" ON disclosure_contingent_liabilities
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for disclosure_subsequent_events" ON disclosure_subsequent_events
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 8. TRIGGERS FOR UPDATED_AT
-- =============================================

DROP TRIGGER IF EXISTS update_konzernanhang_documents_updated_at ON konzernanhang_documents;
CREATE TRIGGER update_konzernanhang_documents_updated_at
    BEFORE UPDATE ON konzernanhang_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_konzernanhang_sections_updated_at ON konzernanhang_sections;
CREATE TRIGGER update_konzernanhang_sections_updated_at
    BEFORE UPDATE ON konzernanhang_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_konzernanhang_templates_updated_at ON konzernanhang_templates;
CREATE TRIGGER update_konzernanhang_templates_updated_at
    BEFORE UPDATE ON konzernanhang_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_disclosure_employees_updated_at ON disclosure_employees;
CREATE TRIGGER update_disclosure_employees_updated_at
    BEFORE UPDATE ON disclosure_employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_disclosure_board_updated_at ON disclosure_board_compensation;
CREATE TRIGGER update_disclosure_board_updated_at
    BEFORE UPDATE ON disclosure_board_compensation
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 9. DEFAULT TEMPLATES INSERT
-- =============================================

INSERT INTO konzernanhang_templates (disclosure_type, template_name, hgb_section, content_template, placeholder_schema, is_default, is_system_template)
VALUES
    ('consolidation_scope', 'Konsolidierungskreis Standard', '§ 313 Abs. 2 Nr. 1-3', 
     'In den Konzernabschluss wurden neben dem Mutterunternehmen {{parent_company}} insgesamt {{subsidiary_count}} Tochterunternehmen einbezogen. Die nachfolgende Übersicht zeigt die zum Konzern gehörenden Unternehmen:\n\n{{subsidiaries_table}}\n\nVon der Einbeziehung in den Konzernabschluss wurden {{excluded_count}} Unternehmen gemäß § 296 HGB ausgenommen.',
     '{"parent_company": "string", "subsidiary_count": "number", "subsidiaries_table": "table", "excluded_count": "number"}',
     TRUE, TRUE),
    
    ('consolidation_methods', 'Konsolidierungsgrundsätze Standard', '§ 313 Abs. 1 Nr. 1',
     'Der Konzernabschluss wird nach den Vorschriften des Handelsgesetzbuches (HGB) aufgestellt.\n\nDie Kapitalkonsolidierung erfolgt nach der Neubewertungsmethode gemäß § 301 Abs. 1 HGB. Dabei werden die Anschaffungskosten der Beteiligungen mit dem anteiligen Eigenkapital der Tochterunternehmen zum Zeitpunkt des Erwerbs verrechnet.\n\nForderungen und Verbindlichkeiten zwischen den in den Konzernabschluss einbezogenen Unternehmen werden gemäß § 303 HGB eliminiert.\n\nZwischenergebnisse aus konzerninternen Lieferungen und Leistungen werden gemäß § 304 HGB eliminiert.\n\nAufwendungen und Erträge aus Geschäften zwischen den einbezogenen Unternehmen werden gemäß § 305 HGB eliminiert.',
     '{}',
     TRUE, TRUE),
    
    ('goodwill', 'Firmenwert Standard', '§ 313 Abs. 1 Nr. 3',
     'Die im Rahmen der Erstkonsolidierung entstandenen Unterschiedsbeträge setzen sich wie folgt zusammen:\n\n{{goodwill_table}}\n\nDer Firmenwert wird gemäß § 309 Abs. 1 HGB über die voraussichtliche Nutzungsdauer von {{useful_life}} Jahren abgeschrieben.',
     '{"goodwill_table": "table", "useful_life": "number"}',
     TRUE, TRUE),
    
    ('minority_interests', 'Anteile anderer Gesellschafter Standard', '§ 307 HGB',
     'Die Anteile anderer Gesellschafter am Eigenkapital und am Jahresergebnis der einbezogenen Tochterunternehmen werden in einem gesonderten Posten "Anteile anderer Gesellschafter" ausgewiesen.\n\n{{minority_table}}',
     '{"minority_table": "table"}',
     TRUE, TRUE),
    
    ('currency_translation', 'Währungsumrechnung Standard', '§ 308a HGB',
     'Die Jahresabschlüsse der ausländischen Konzernunternehmen werden nach der modifizierten Stichtagskursmethode gemäß § 308a HGB in Euro umgerechnet.\n\nVermögensgegenstände und Schulden werden zum Stichtagskurs, das Eigenkapital zum historischen Kurs und die Aufwendungen und Erträge zum Durchschnittskurs des Geschäftsjahres umgerechnet.\n\nDie sich ergebenden Umrechnungsdifferenzen werden erfolgsneutral in den Posten "Eigenkapitaldifferenz aus Währungsumrechnung" eingestellt.',
     '{}',
     TRUE, TRUE),
    
    ('employees', 'Arbeitnehmer Standard', '§ 314 Abs. 1 Nr. 4',
     'Die durchschnittliche Zahl der während des Geschäftsjahres beschäftigten Arbeitnehmer betrug:\n\n{{employees_table}}\n\nDie Personalaufwendungen beliefen sich auf insgesamt {{personnel_expenses}} EUR.',
     '{"employees_table": "table", "personnel_expenses": "number"}',
     TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- =============================================
-- 10. ADD TO AUDIT ENTITY TYPE
-- =============================================

DO $$ BEGIN
    ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'konzernanhang_document';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'konzernanhang_section';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 11. COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE konzernanhang_documents IS 'Konzernanhang-Dokumente mit Versionierung und Audit-Trail (HGB § 313-314)';
COMMENT ON TABLE konzernanhang_sections IS 'Einzelne Abschnitte des Konzernanhangs mit Pflichtangaben';
COMMENT ON TABLE konzernanhang_exports IS 'Exportprotokoll für Audit-Nachweise';
COMMENT ON TABLE konzernanhang_templates IS 'Wiederverwendbare Vorlagen für Konzernanhang-Abschnitte';
COMMENT ON TABLE disclosure_employees IS 'Arbeitnehmerangaben nach § 314 Abs. 1 Nr. 4 HGB';
COMMENT ON TABLE disclosure_board_compensation IS 'Organbezüge nach § 314 Abs. 1 Nr. 6 HGB';
COMMENT ON TABLE disclosure_contingent_liabilities IS 'Eventualverbindlichkeiten nach § 314 Abs. 1 Nr. 2 HGB';
COMMENT ON TABLE disclosure_subsequent_events IS 'Ereignisse nach dem Bilanzstichtag nach § 314 Abs. 1 Nr. 25 HGB';

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
