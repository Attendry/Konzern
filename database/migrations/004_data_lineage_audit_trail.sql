-- =============================================
-- Phase 4 Migration: Data Lineage + Prüfpfad (Audit Trail)
-- Complete traceability from source to consolidated figures
-- HGB-compliant audit trail for Wirtschaftsprüfer
-- =============================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. ENUM TYPES
-- =============================================

-- Lineage Node Type - what kind of data element
DO $$ BEGIN
    CREATE TYPE lineage_node_type AS ENUM (
        'source_data',                -- Original imported/entered data
        'account_balance',            -- Single account balance
        'aggregation',                -- Sum of multiple values
        'intercompany_elimination',   -- IC transaction elimination
        'capital_consolidation',      -- Capital consolidation adjustment
        'debt_consolidation',         -- Debt consolidation adjustment
        'currency_translation',       -- FX translation
        'minority_interest',          -- Minority share calculation
        'deferred_tax',              -- Deferred tax calculation
        'consolidated_value',         -- Final consolidated value
        'reclassification',          -- Account reclassification
        'valuation_adjustment',      -- HGB § 308 uniform valuation
        'proportional_share',        -- § 310 proportional consolidation
        'equity_method'              -- § 312 equity method
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Lineage Transformation Type - what operation was performed
DO $$ BEGIN
    CREATE TYPE lineage_transformation_type AS ENUM (
        'import',           -- Data import from file/ERP
        'manual_entry',     -- Manual data entry
        'sum',              -- Summation
        'subtract',         -- Subtraction
        'multiply',         -- Multiplication (e.g., FX rate)
        'percentage',       -- Percentage calculation
        'elimination',      -- Elimination (set to zero)
        'offset',           -- Offsetting (both sides)
        'allocation',       -- Allocation to accounts
        'reversal',         -- Reversal of prior entry
        'carry_forward',    -- Prior period carry forward
        'pro_rata',         -- Pro-rata calculation
        'mapping'           -- Chart of accounts mapping
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Prüfpfad (Audit Trail) Status
DO $$ BEGIN
    CREATE TYPE pruefpfad_status AS ENUM (
        'documented',           -- Fully documented
        'partially_documented', -- Some documentation missing
        'undocumented',        -- No documentation
        'verified',            -- Verified by auditor
        'requires_review'      -- Flagged for review
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Audit Evidence Type
DO $$ BEGIN
    CREATE TYPE audit_evidence_type AS ENUM (
        'source_document',     -- Original document (invoice, contract)
        'calculation',         -- Calculation worksheet
        'system_log',          -- Automated system log
        'reconciliation',      -- Reconciliation report
        'confirmation',        -- Third-party confirmation
        'management_assertion', -- Management representation
        'analytical_review',   -- Analytical review documentation
        'sampling',            -- Sample testing documentation
        'walkthrough'          -- Process walkthrough
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. DATA LINEAGE NODES TABLE
-- Central registry of all data points in consolidation
-- =============================================

CREATE TABLE IF NOT EXISTS data_lineage_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Context
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Node identification
    node_type lineage_node_type NOT NULL,
    node_code VARCHAR(100) NOT NULL,  -- Unique code within context
    node_name VARCHAR(500) NOT NULL,
    
    -- Value tracking
    value_amount DECIMAL(15, 2) NOT NULL,
    value_currency VARCHAR(3) DEFAULT 'EUR',
    value_in_group_currency DECIMAL(15, 2),
    
    -- Account reference (if applicable)
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    account_code VARCHAR(50),
    
    -- Source reference
    source_entity_type VARCHAR(100),  -- 'account_balance', 'consolidation_entry', etc.
    source_entity_id UUID,
    
    -- Consolidation entry reference (if from adjustment)
    consolidation_entry_id UUID REFERENCES consolidation_entries(id) ON DELETE SET NULL,
    
    -- HGB reference
    hgb_section VARCHAR(50),  -- e.g., '§ 301 HGB'
    
    -- Metadata
    fiscal_year INTEGER,
    reporting_period VARCHAR(20),  -- 'Q1', 'Q2', 'Q3', 'Q4', 'FY'
    is_audited BOOLEAN DEFAULT FALSE,
    is_final BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(financial_statement_id, company_id, node_type, node_code)
);

-- Indexes for data_lineage_nodes
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_fs ON data_lineage_nodes(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_company ON data_lineage_nodes(company_id);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_type ON data_lineage_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_account ON data_lineage_nodes(account_id);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_entry ON data_lineage_nodes(consolidation_entry_id);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_source ON data_lineage_nodes(source_entity_type, source_entity_id);

-- =============================================
-- 3. DATA LINEAGE TRACES TABLE
-- Records the transformation relationships between nodes
-- =============================================

CREATE TABLE IF NOT EXISTS data_lineage_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- The nodes involved
    source_node_id UUID NOT NULL REFERENCES data_lineage_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES data_lineage_nodes(id) ON DELETE CASCADE,
    
    -- Transformation details
    transformation_type lineage_transformation_type NOT NULL,
    transformation_description TEXT,
    
    -- Calculation details
    transformation_factor DECIMAL(15, 6),  -- e.g., FX rate, percentage
    transformation_formula TEXT,           -- Human-readable formula
    
    -- Contribution to target
    contribution_amount DECIMAL(15, 2),    -- How much this source contributed
    contribution_percentage DECIMAL(7, 4), -- Percentage of target value
    
    -- Consolidation context
    consolidation_entry_id UUID REFERENCES consolidation_entries(id) ON DELETE SET NULL,
    
    -- Ordering (for display and calculation sequence)
    sequence_order INTEGER DEFAULT 0,
    
    -- Metadata
    is_reversible BOOLEAN DEFAULT TRUE,
    reversed_at TIMESTAMPTZ,
    reversed_by_trace_id UUID REFERENCES data_lineage_traces(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate traces
    UNIQUE(source_node_id, target_node_id, transformation_type)
);

-- Indexes for data_lineage_traces
CREATE INDEX IF NOT EXISTS idx_lineage_traces_source ON data_lineage_traces(source_node_id);
CREATE INDEX IF NOT EXISTS idx_lineage_traces_target ON data_lineage_traces(target_node_id);
CREATE INDEX IF NOT EXISTS idx_lineage_traces_type ON data_lineage_traces(transformation_type);
CREATE INDEX IF NOT EXISTS idx_lineage_traces_entry ON data_lineage_traces(consolidation_entry_id);

-- =============================================
-- 4. PRÜFPFAD (AUDIT TRAIL DOCUMENTATION) TABLE
-- Comprehensive audit documentation for WP
-- =============================================

CREATE TABLE IF NOT EXISTS pruefpfad_documentation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to what is being documented
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,  -- 'lineage_node', 'consolidation_entry', etc.
    entity_id UUID NOT NULL,
    
    -- Documentation status
    status pruefpfad_status DEFAULT 'undocumented',
    
    -- HGB reference and compliance
    hgb_section VARCHAR(50),
    hgb_requirement TEXT,
    compliance_notes TEXT,
    
    -- Audit working paper reference
    working_paper_ref VARCHAR(100),
    audit_program_ref VARCHAR(100),
    
    -- Documentation content
    documentation_summary TEXT NOT NULL,
    detailed_description TEXT,
    calculation_basis TEXT,
    assumptions TEXT,
    
    -- Evidence references (stored as JSON array)
    evidence_references JSONB DEFAULT '[]'::jsonb,
    
    -- Risk assessment
    risk_level VARCHAR(20),  -- 'low', 'medium', 'high'
    material_risk_factors TEXT,
    
    -- Prepared by
    prepared_by_user_id UUID,
    prepared_by_name VARCHAR(255),
    prepared_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Reviewed by (4-eyes principle)
    reviewed_by_user_id UUID,
    reviewed_by_name VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Verified by (auditor)
    verified_by_user_id UUID,
    verified_by_name VARCHAR(255),
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pruefpfad_documentation
CREATE INDEX IF NOT EXISTS idx_pruefpfad_fs ON pruefpfad_documentation(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_pruefpfad_entity ON pruefpfad_documentation(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pruefpfad_status ON pruefpfad_documentation(status);
CREATE INDEX IF NOT EXISTS idx_pruefpfad_hgb ON pruefpfad_documentation(hgb_section);
CREATE INDEX IF NOT EXISTS idx_pruefpfad_wp ON pruefpfad_documentation(working_paper_ref);

-- =============================================
-- 5. AUDIT EVIDENCE TABLE
-- Supporting documents and evidence for audit trail
-- =============================================

CREATE TABLE IF NOT EXISTS audit_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Link to documentation
    pruefpfad_id UUID NOT NULL REFERENCES pruefpfad_documentation(id) ON DELETE CASCADE,
    
    -- Evidence details
    evidence_type audit_evidence_type NOT NULL,
    evidence_ref VARCHAR(255),        -- Reference number
    evidence_description TEXT NOT NULL,
    
    -- Document reference (if attached)
    document_attachment_id UUID REFERENCES document_attachments(id) ON DELETE SET NULL,
    
    -- External reference
    external_system VARCHAR(100),     -- e.g., 'SAP', 'bank_portal'
    external_ref VARCHAR(255),
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by_user_id UUID,
    verified_at TIMESTAMPTZ,
    verification_method VARCHAR(100),
    verification_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_evidence
CREATE INDEX IF NOT EXISTS idx_audit_evidence_pruefpfad ON audit_evidence(pruefpfad_id);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_type ON audit_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_audit_evidence_doc ON audit_evidence(document_attachment_id);

-- =============================================
-- 6. LINEAGE SUMMARY VIEW
-- Aggregated view for reporting
-- =============================================

CREATE OR REPLACE VIEW v_lineage_summary AS
SELECT 
    fs.id AS financial_statement_id,
    fs.fiscal_year,
    c.id AS company_id,
    c.name AS company_name,
    dln.node_type,
    COUNT(dln.id) AS node_count,
    SUM(ABS(dln.value_amount)) AS total_absolute_value,
    SUM(dln.value_amount) AS net_value,
    COUNT(DISTINCT dlt.id) AS trace_count,
    COUNT(DISTINCT pd.id) AS documentation_count,
    COUNT(CASE WHEN pd.status = 'verified' THEN 1 END) AS verified_count,
    CASE 
        WHEN COUNT(dln.id) = 0 THEN 0
        ELSE ROUND(COUNT(CASE WHEN pd.status = 'verified' THEN 1 END)::NUMERIC / COUNT(dln.id) * 100, 2)
    END AS verification_percentage
FROM financial_statements fs
LEFT JOIN data_lineage_nodes dln ON dln.financial_statement_id = fs.id
LEFT JOIN companies c ON c.id = dln.company_id
LEFT JOIN data_lineage_traces dlt ON dlt.source_node_id = dln.id OR dlt.target_node_id = dln.id
LEFT JOIN pruefpfad_documentation pd ON pd.entity_id = dln.id AND pd.entity_type = 'lineage_node'
GROUP BY fs.id, fs.fiscal_year, c.id, c.name, dln.node_type;

-- =============================================
-- 7. TRANSFORMATION AUDIT TRAIL VIEW
-- Complete audit trail for each consolidation transformation
-- =============================================

CREATE OR REPLACE VIEW v_transformation_audit_trail AS
SELECT 
    dlt.id AS trace_id,
    dlt.transformation_type,
    dlt.transformation_description,
    dlt.contribution_amount,
    
    -- Source details
    src.id AS source_node_id,
    src.node_name AS source_name,
    src.node_type AS source_type,
    src.value_amount AS source_value,
    src_c.name AS source_company,
    
    -- Target details
    tgt.id AS target_node_id,
    tgt.node_name AS target_name,
    tgt.node_type AS target_type,
    tgt.value_amount AS target_value,
    tgt_c.name AS target_company,
    
    -- Context
    fs.id AS financial_statement_id,
    fs.fiscal_year,
    
    -- Documentation status
    pd.status AS documentation_status,
    pd.working_paper_ref,
    
    -- Timestamps
    dlt.created_at AS transformation_at
    
FROM data_lineage_traces dlt
JOIN data_lineage_nodes src ON src.id = dlt.source_node_id
JOIN data_lineage_nodes tgt ON tgt.id = dlt.target_node_id
JOIN financial_statements fs ON fs.id = src.financial_statement_id
LEFT JOIN companies src_c ON src_c.id = src.company_id
LEFT JOIN companies tgt_c ON tgt_c.id = tgt.company_id
LEFT JOIN pruefpfad_documentation pd ON pd.entity_id = dlt.id AND pd.entity_type = 'lineage_trace'
ORDER BY dlt.created_at DESC;

-- =============================================
-- 8. ROW LEVEL SECURITY
-- =============================================

ALTER TABLE data_lineage_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lineage_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE pruefpfad_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_evidence ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all for data_lineage_nodes" ON data_lineage_nodes;
DROP POLICY IF EXISTS "Enable all for data_lineage_traces" ON data_lineage_traces;
DROP POLICY IF EXISTS "Enable all for pruefpfad_documentation" ON pruefpfad_documentation;
DROP POLICY IF EXISTS "Enable all for audit_evidence" ON audit_evidence;

-- Create policies (allow all for now - to be restricted with RBAC later)
CREATE POLICY "Enable all for data_lineage_nodes" ON data_lineage_nodes
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for data_lineage_traces" ON data_lineage_traces
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for pruefpfad_documentation" ON pruefpfad_documentation
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for audit_evidence" ON audit_evidence
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 9. TRIGGERS FOR UPDATED_AT
-- =============================================

DROP TRIGGER IF EXISTS update_data_lineage_nodes_updated_at ON data_lineage_nodes;
CREATE TRIGGER update_data_lineage_nodes_updated_at
    BEFORE UPDATE ON data_lineage_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pruefpfad_documentation_updated_at ON pruefpfad_documentation;
CREATE TRIGGER update_pruefpfad_documentation_updated_at
    BEFORE UPDATE ON pruefpfad_documentation
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 10. ADD LINEAGE TRACKING TO audit_entity_type ENUM
-- =============================================

-- Note: Adding new values to existing enum
DO $$ BEGIN
    ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'lineage_node';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'lineage_trace';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'pruefpfad';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 11. COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE data_lineage_nodes IS 'Datenpunkte im Konsolidierungsprozess mit vollständiger Nachverfolgbarkeit';
COMMENT ON TABLE data_lineage_traces IS 'Transformationsbeziehungen zwischen Datenpunkten (Prüfpfad)';
COMMENT ON TABLE pruefpfad_documentation IS 'Prüfungsdokumentation für Wirtschaftsprüfer nach HGB';
COMMENT ON TABLE audit_evidence IS 'Prüfungsnachweise und Belege für die Dokumentation';

COMMENT ON VIEW v_lineage_summary IS 'Zusammenfassung der Datenherkunft pro Geschäftsjahr und Gesellschaft';
COMMENT ON VIEW v_transformation_audit_trail IS 'Vollständiger Prüfpfad aller Konsolidierungstransformationen';

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
