-- ============================================
-- PHASE: Priority Features Implementation
-- Migration Script for Supabase/PostgreSQL
-- ============================================
-- 
-- Features Implemented:
-- 1. User Authentication Tables (Supabase Auth Integration)
-- 2. Fiscal Year Adjustments (§ 299 HGB)
-- 3. Goodwill Amortization Schedules
-- 4. Management Reports (Konzernlagebericht § 315 HGB)
-- 5. Currency Translation UI Support
--
-- Created: 2026-01-14
-- ============================================

-- ============================================
-- PART 1: User Profile Extension (for Supabase Auth)
-- ============================================

-- User profiles table to extend Supabase auth.users
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'auditor', 'preparer', 'viewer'
    department VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- PART 2: Fiscal Year Adjustments (§ 299 HGB)
-- ============================================

-- Enum for adjustment methods
DO $$ BEGIN
    CREATE TYPE fiscal_adjustment_method AS ENUM (
        'pro_rata',         -- Pro-rata temporis (zeitanteilig)
        'interim_statement', -- Zwischenabschluss
        'estimate',         -- Schätzung
        'none'              -- Keine Anpassung erforderlich
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum for adjustment status
DO $$ BEGIN
    CREATE TYPE fiscal_adjustment_status AS ENUM (
        'pending',      -- Ausstehend
        'in_progress',  -- In Bearbeitung
        'completed',    -- Abgeschlossen
        'approved',     -- Freigegeben
        'rejected'      -- Abgelehnt
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Fiscal year adjustments table
CREATE TABLE IF NOT EXISTS fiscal_year_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    financial_statement_id UUID REFERENCES financial_statements(id) ON DELETE SET NULL,
    group_financial_statement_id UUID REFERENCES financial_statements(id) ON DELETE SET NULL,
    
    -- Date information
    subsidiary_fiscal_year_end DATE NOT NULL,
    group_reporting_date DATE NOT NULL,
    difference_days INTEGER, -- Computed by trigger
    difference_months INTEGER, -- Computed by trigger
    
    -- Adjustment details
    adjustment_method fiscal_adjustment_method NOT NULL DEFAULT 'none',
    is_hgb_compliant BOOLEAN DEFAULT TRUE, -- Computed by trigger (max 3 months per HGB)
    
    -- Status
    status fiscal_adjustment_status DEFAULT 'pending',
    
    -- Adjustment entries
    adjustment_entries JSONB DEFAULT '[]', -- Array of adjustment entries
    
    -- Significant events between dates
    significant_events JSONB DEFAULT '[]', -- Events that need to be considered
    
    -- Documentation
    justification TEXT, -- Begründung für die Anpassungsmethode
    hgb_reference VARCHAR(50) DEFAULT '§ 299 HGB',
    
    -- Audit trail
    created_by_user_id UUID,
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fiscal year adjustments
CREATE INDEX IF NOT EXISTS idx_fiscal_year_adjustments_company 
    ON fiscal_year_adjustments(company_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_year_adjustments_financial_statement 
    ON fiscal_year_adjustments(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_year_adjustments_status 
    ON fiscal_year_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_fiscal_year_adjustments_compliance 
    ON fiscal_year_adjustments(is_hgb_compliant);

-- Enable RLS
ALTER TABLE fiscal_year_adjustments ENABLE ROW LEVEL SECURITY;

-- Policy for fiscal year adjustments
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON fiscal_year_adjustments;
CREATE POLICY "Enable all access for authenticated users" ON fiscal_year_adjustments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Function to compute fiscal year adjustment derived fields
CREATE OR REPLACE FUNCTION compute_fiscal_year_adjustment_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate difference in days
    NEW.difference_days := NEW.group_reporting_date - NEW.subsidiary_fiscal_year_end;
    
    -- Calculate difference in months (approximate)
    NEW.difference_months := ROUND(ABS(NEW.difference_days) / 30.44);
    
    -- Check HGB compliance (max 3 months difference)
    NEW.is_hgb_compliant := ABS(NEW.difference_months) <= 3;
    
    -- Update timestamp
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for fiscal year adjustment computation
DROP TRIGGER IF EXISTS trigger_compute_fiscal_adjustment ON fiscal_year_adjustments;
CREATE TRIGGER trigger_compute_fiscal_adjustment
    BEFORE INSERT OR UPDATE OF subsidiary_fiscal_year_end, group_reporting_date
    ON fiscal_year_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION compute_fiscal_year_adjustment_fields();

-- ============================================
-- PART 3: Goodwill Amortization Schedules
-- ============================================

-- Enum for amortization method
DO $$ BEGIN
    CREATE TYPE amortization_method AS ENUM (
        'linear',       -- Lineare Abschreibung
        'declining',    -- Degressive Abschreibung
        'custom'        -- Benutzerdefiniert
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Goodwill amortization schedules table
CREATE TABLE IF NOT EXISTS goodwill_amortization_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    subsidiary_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    participation_id UUID REFERENCES participations(id) ON DELETE SET NULL,
    
    -- Goodwill information
    initial_goodwill DECIMAL(15,2) NOT NULL,
    acquisition_date DATE,
    
    -- Amortization settings
    useful_life_years INTEGER NOT NULL DEFAULT 10, -- HGB: max 10 Jahre, oft 5 Jahre
    amortization_method amortization_method DEFAULT 'linear',
    
    -- Current status
    accumulated_amortization DECIMAL(15,2) DEFAULT 0,
    remaining_goodwill DECIMAL(15,2),
    annual_amortization DECIMAL(15,2),
    
    -- Impairment
    impairment_amount DECIMAL(15,2) DEFAULT 0,
    impairment_date DATE,
    impairment_reason TEXT,
    
    -- Documentation
    hgb_reference VARCHAR(50) DEFAULT '§ 309 HGB',
    notes TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Goodwill amortization entries (yearly entries)
CREATE TABLE IF NOT EXISTS goodwill_amortization_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to schedule
    schedule_id UUID NOT NULL REFERENCES goodwill_amortization_schedules(id) ON DELETE CASCADE,
    financial_statement_id UUID REFERENCES financial_statements(id) ON DELETE SET NULL,
    
    -- Year information
    fiscal_year INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Amounts
    opening_balance DECIMAL(15,2) NOT NULL,
    amortization_amount DECIMAL(15,2) NOT NULL,
    impairment_amount DECIMAL(15,2) DEFAULT 0,
    closing_balance DECIMAL(15,2) NOT NULL,
    
    -- Linked consolidation entry
    consolidation_entry_id UUID REFERENCES consolidation_entries(id) ON DELETE SET NULL,
    
    -- Status
    is_booked BOOLEAN DEFAULT FALSE,
    booked_at TIMESTAMPTZ,
    booked_by_user_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for goodwill tables
CREATE INDEX IF NOT EXISTS idx_goodwill_schedules_subsidiary 
    ON goodwill_amortization_schedules(subsidiary_company_id);
CREATE INDEX IF NOT EXISTS idx_goodwill_schedules_parent 
    ON goodwill_amortization_schedules(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_goodwill_entries_schedule 
    ON goodwill_amortization_entries(schedule_id);
CREATE INDEX IF NOT EXISTS idx_goodwill_entries_fiscal_year 
    ON goodwill_amortization_entries(fiscal_year);

-- Enable RLS
ALTER TABLE goodwill_amortization_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE goodwill_amortization_entries ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable all access" ON goodwill_amortization_schedules;
CREATE POLICY "Enable all access" ON goodwill_amortization_schedules
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON goodwill_amortization_entries;
CREATE POLICY "Enable all access" ON goodwill_amortization_entries
    FOR ALL USING (true) WITH CHECK (true);

-- Function to calculate remaining goodwill
CREATE OR REPLACE FUNCTION calculate_remaining_goodwill()
RETURNS TRIGGER AS $$
BEGIN
    NEW.remaining_goodwill := NEW.initial_goodwill - NEW.accumulated_amortization - NEW.impairment_amount;
    NEW.annual_amortization := CASE 
        WHEN NEW.amortization_method = 'linear' THEN NEW.initial_goodwill / NEW.useful_life_years
        ELSE NEW.initial_goodwill / NEW.useful_life_years -- Simplified, could be enhanced
    END;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for goodwill calculation
DROP TRIGGER IF EXISTS trigger_calculate_goodwill ON goodwill_amortization_schedules;
CREATE TRIGGER trigger_calculate_goodwill
    BEFORE INSERT OR UPDATE OF initial_goodwill, accumulated_amortization, impairment_amount, useful_life_years
    ON goodwill_amortization_schedules
    FOR EACH ROW
    EXECUTE FUNCTION calculate_remaining_goodwill();

-- ============================================
-- PART 4: Management Reports (Konzernlagebericht § 315 HGB)
-- ============================================

-- Enum for report status
DO $$ BEGIN
    CREATE TYPE report_status AS ENUM (
        'draft',        -- Entwurf
        'in_review',    -- In Prüfung
        'approved',     -- Freigegeben
        'published',    -- Veröffentlicht
        'archived'      -- Archiviert
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Management reports table
CREATE TABLE IF NOT EXISTS management_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    -- Report metadata
    report_title VARCHAR(255) DEFAULT 'Konzernlagebericht',
    fiscal_year INTEGER NOT NULL,
    report_date DATE DEFAULT CURRENT_DATE,
    
    -- Status
    status report_status DEFAULT 'draft',
    
    -- Report sections (structured content)
    sections JSONB NOT NULL DEFAULT '{
        "business_overview": {
            "title": "Geschäfts- und Rahmenbedingungen",
            "content": "",
            "order": 1
        },
        "financial_performance": {
            "title": "Ertragslage",
            "content": "",
            "order": 2
        },
        "financial_position": {
            "title": "Vermögenslage",
            "content": "",
            "order": 3
        },
        "liquidity": {
            "title": "Finanzlage",
            "content": "",
            "order": 4
        },
        "risk_report": {
            "title": "Risiko- und Chancenbericht",
            "content": "",
            "order": 5
        },
        "forecast": {
            "title": "Prognosebericht",
            "content": "",
            "order": 6
        },
        "subsequent_events": {
            "title": "Nachtragsbericht",
            "content": "",
            "order": 7
        }
    }',
    
    -- Key figures (auto-generated from financial data)
    key_figures JSONB DEFAULT '{}',
    
    -- Generated text suggestions
    generated_content JSONB DEFAULT '{}',
    
    -- HGB reference
    hgb_reference VARCHAR(50) DEFAULT '§ 315 HGB',
    
    -- Audit trail
    created_by_user_id UUID,
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Management report versions (for audit trail)
CREATE TABLE IF NOT EXISTS management_report_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to report
    report_id UUID NOT NULL REFERENCES management_reports(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    
    -- Snapshot of content
    sections_snapshot JSONB NOT NULL,
    key_figures_snapshot JSONB,
    
    -- Change tracking
    change_description TEXT,
    changed_by_user_id UUID,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for management reports
CREATE INDEX IF NOT EXISTS idx_management_reports_financial_statement 
    ON management_reports(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_management_reports_status 
    ON management_reports(status);
CREATE INDEX IF NOT EXISTS idx_management_report_versions_report 
    ON management_report_versions(report_id);

-- Enable RLS
ALTER TABLE management_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_report_versions ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable all access" ON management_reports;
CREATE POLICY "Enable all access" ON management_reports
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON management_report_versions;
CREATE POLICY "Enable all access" ON management_report_versions
    FOR ALL USING (true) WITH CHECK (true);

-- Function to create version on update
CREATE OR REPLACE FUNCTION create_report_version()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM management_report_versions
    WHERE report_id = OLD.id;
    
    -- Create version entry
    INSERT INTO management_report_versions (
        report_id,
        version_number,
        sections_snapshot,
        key_figures_snapshot,
        change_description,
        changed_by_user_id
    ) VALUES (
        OLD.id,
        next_version,
        OLD.sections,
        OLD.key_figures,
        'Automatic version on update',
        NEW.created_by_user_id
    );
    
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for version creation
DROP TRIGGER IF EXISTS trigger_create_report_version ON management_reports;
CREATE TRIGGER trigger_create_report_version
    BEFORE UPDATE OF sections, status
    ON management_reports
    FOR EACH ROW
    WHEN (OLD.sections IS DISTINCT FROM NEW.sections OR OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION create_report_version();

-- ============================================
-- PART 5: Currency Translation UI Support
-- ============================================

-- Add UI-relevant fields to existing exchange_rates table if not exists
ALTER TABLE exchange_rates 
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual', -- 'ecb', 'bundesbank', 'manual'
    ADD COLUMN IF NOT EXISTS is_closing_rate BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_average_rate BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Currency translation configurations per company
CREATE TABLE IF NOT EXISTS currency_translation_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Configuration
    functional_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    translation_method VARCHAR(50) DEFAULT 'closing_rate', -- 'closing_rate', 'temporal', 'current_rate'
    
    -- Rate sources
    preferred_rate_source VARCHAR(50) DEFAULT 'ecb', -- 'ecb', 'bundesbank', 'manual'
    auto_fetch_rates BOOLEAN DEFAULT TRUE,
    
    -- Balance sheet translation
    assets_rate_type VARCHAR(20) DEFAULT 'closing', -- 'closing', 'historical', 'average'
    liabilities_rate_type VARCHAR(20) DEFAULT 'closing',
    equity_rate_type VARCHAR(20) DEFAULT 'historical',
    
    -- Income statement translation
    revenue_rate_type VARCHAR(20) DEFAULT 'average',
    expenses_rate_type VARCHAR(20) DEFAULT 'average',
    
    -- HGB reference
    hgb_reference VARCHAR(50) DEFAULT '§ 308a HGB',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Currency translation summaries per period
CREATE TABLE IF NOT EXISTS currency_translation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Period
    fiscal_year INTEGER NOT NULL,
    period_start DATE,
    period_end DATE,
    
    -- Source and target currencies
    source_currency VARCHAR(3) NOT NULL,
    target_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    
    -- Rates used
    closing_rate DECIMAL(15,6),
    average_rate DECIMAL(15,6),
    opening_rate DECIMAL(15,6),
    
    -- Amounts
    total_assets_source DECIMAL(15,2),
    total_assets_target DECIMAL(15,2),
    total_liabilities_source DECIMAL(15,2),
    total_liabilities_target DECIMAL(15,2),
    total_equity_source DECIMAL(15,2),
    total_equity_target DECIMAL(15,2),
    
    -- Translation differences
    translation_difference DECIMAL(15,2),
    cumulative_translation_difference DECIMAL(15,2),
    
    -- Where differences are posted
    difference_posted_to VARCHAR(50) DEFAULT 'equity_reserve', -- 'equity_reserve', 'income_statement'
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_currency_translation_configs_company 
    ON currency_translation_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_currency_translation_summaries_fs 
    ON currency_translation_summaries(financial_statement_id);

-- Enable RLS
ALTER TABLE currency_translation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_translation_summaries ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable all access" ON currency_translation_configs;
CREATE POLICY "Enable all access" ON currency_translation_configs
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON currency_translation_summaries;
CREATE POLICY "Enable all access" ON currency_translation_summaries
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- PART 6: Update Audit Log with User References
-- ============================================

-- Add user reference to audit_logs if not exists
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS user_role VARCHAR(50);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify the migration:
/*
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'user_profiles',
    'fiscal_year_adjustments',
    'goodwill_amortization_schedules',
    'goodwill_amortization_entries',
    'management_reports',
    'management_report_versions',
    'currency_translation_configs',
    'currency_translation_summaries'
);

-- Check enum types
SELECT typname FROM pg_type 
WHERE typname IN (
    'fiscal_adjustment_method',
    'fiscal_adjustment_status',
    'amortization_method',
    'report_status'
);
*/

-- ============================================
-- END OF MIGRATION
-- ============================================
