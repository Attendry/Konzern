-- ============================================
-- PHASE 1: Manual Data Entry for Consolidation
-- Migration Script for Supabase/PostgreSQL
-- ============================================
-- 
-- Run this script in your Supabase SQL Editor
-- or via psql command line
--
-- Created: 2026-01-12
-- ============================================

-- ============================================
-- PART 1: Extend consolidation_entries table
-- ============================================

-- Add entry status enum type
DO $$ BEGIN
    CREATE TYPE entry_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'reversed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add entry source enum type
DO $$ BEGIN
    CREATE TYPE entry_source AS ENUM ('automatic', 'manual', 'import');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add HGB reference enum type
DO $$ BEGIN
    CREATE TYPE hgb_reference AS ENUM (
        '§ 301 HGB',
        '§ 303 HGB',
        '§ 304 HGB',
        '§ 305 HGB',
        '§ 306 HGB',
        '§ 307 HGB',
        '§ 308 HGB',
        '§ 308a HGB',
        '§ 312 HGB',
        'Sonstige'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Extend adjustment_type enum with new values (if not already present)
-- Note: PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE
-- Run these only if the values don't exist
DO $$ BEGIN
    ALTER TYPE adjustment_type ADD VALUE IF NOT EXISTS 'intercompany_profit';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE adjustment_type ADD VALUE IF NOT EXISTS 'income_expense';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE adjustment_type ADD VALUE IF NOT EXISTS 'currency_translation';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE adjustment_type ADD VALUE IF NOT EXISTS 'deferred_tax';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE adjustment_type ADD VALUE IF NOT EXISTS 'minority_interest';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to consolidation_entries table
ALTER TABLE consolidation_entries 
ADD COLUMN IF NOT EXISTS debit_account_id UUID REFERENCES accounts(id),
ADD COLUMN IF NOT EXISTS credit_account_id UUID REFERENCES accounts(id),
ADD COLUMN IF NOT EXISTS status entry_status DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS source entry_source DEFAULT 'automatic',
ADD COLUMN IF NOT EXISTS hgb_reference hgb_reference,
ADD COLUMN IF NOT EXISTS affected_company_ids UUID[],
ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
ADD COLUMN IF NOT EXISTS approved_by_user_id UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reversed_by_entry_id UUID REFERENCES consolidation_entries(id),
ADD COLUMN IF NOT EXISTS reverses_entry_id UUID REFERENCES consolidation_entries(id);

-- Make account_id nullable for backward compatibility
ALTER TABLE consolidation_entries 
ALTER COLUMN account_id DROP NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_consolidation_entries_status 
ON consolidation_entries(status);

CREATE INDEX IF NOT EXISTS idx_consolidation_entries_source 
ON consolidation_entries(source);

CREATE INDEX IF NOT EXISTS idx_consolidation_entries_debit_account 
ON consolidation_entries(debit_account_id);

CREATE INDEX IF NOT EXISTS idx_consolidation_entries_credit_account 
ON consolidation_entries(credit_account_id);

CREATE INDEX IF NOT EXISTS idx_consolidation_entries_created_by 
ON consolidation_entries(created_by_user_id);

-- ============================================
-- PART 2: Create ic_reconciliations table
-- ============================================

-- Add IC reconciliation status enum type
DO $$ BEGIN
    CREATE TYPE ic_reconciliation_status AS ENUM ('open', 'explained', 'cleared', 'accepted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add IC difference reason enum type
DO $$ BEGIN
    CREATE TYPE ic_difference_reason AS ENUM (
        'timing',
        'currency',
        'booking_error',
        'missing_entry',
        'different_valuation',
        'intercompany_profit',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ic_reconciliations table
CREATE TABLE IF NOT EXISTS ic_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Financial statement reference
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    
    -- Company A (typically with receivable)
    company_a_id UUID NOT NULL REFERENCES companies(id),
    
    -- Company B (typically with payable)
    company_b_id UUID NOT NULL REFERENCES companies(id),
    
    -- Account at Company A
    account_a_id UUID NOT NULL REFERENCES accounts(id),
    
    -- Account at Company B
    account_b_id UUID NOT NULL REFERENCES accounts(id),
    
    -- Amounts
    amount_company_a DECIMAL(15, 2) NOT NULL DEFAULT 0,
    amount_company_b DECIMAL(15, 2) NOT NULL DEFAULT 0,
    difference_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Status and resolution
    status ic_reconciliation_status NOT NULL DEFAULT 'open',
    difference_reason ic_difference_reason,
    explanation TEXT,
    
    -- Clearing entry reference
    clearing_entry_id UUID REFERENCES consolidation_entries(id),
    
    -- Resolution tracking
    resolved_by_user_id UUID,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ic_reconciliations_financial_statement 
ON ic_reconciliations(financial_statement_id);

CREATE INDEX IF NOT EXISTS idx_ic_reconciliations_status 
ON ic_reconciliations(status);

CREATE INDEX IF NOT EXISTS idx_ic_reconciliations_company_a 
ON ic_reconciliations(company_a_id);

CREATE INDEX IF NOT EXISTS idx_ic_reconciliations_company_b 
ON ic_reconciliations(company_b_id);

CREATE INDEX IF NOT EXISTS idx_ic_reconciliations_difference 
ON ic_reconciliations(difference_amount) 
WHERE status = 'open';

-- ============================================
-- PART 3: Enable Row Level Security (RLS)
-- ============================================

-- Enable RLS on ic_reconciliations
ALTER TABLE ic_reconciliations ENABLE ROW LEVEL SECURITY;

-- Create policy for ic_reconciliations (adjust based on your auth setup)
-- This allows all operations for authenticated users
CREATE POLICY IF NOT EXISTS "Enable all access for authenticated users" 
ON ic_reconciliations 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- ============================================
-- PART 4: Create helper functions
-- ============================================

-- Function to calculate difference automatically
CREATE OR REPLACE FUNCTION calculate_ic_difference()
RETURNS TRIGGER AS $$
BEGIN
    NEW.difference_amount := NEW.amount_company_a - NEW.amount_company_b;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic difference calculation
DROP TRIGGER IF EXISTS trigger_calculate_ic_difference ON ic_reconciliations;
CREATE TRIGGER trigger_calculate_ic_difference
    BEFORE INSERT OR UPDATE OF amount_company_a, amount_company_b
    ON ic_reconciliations
    FOR EACH ROW
    EXECUTE FUNCTION calculate_ic_difference();

-- Function to update timestamp on consolidation_entries
CREATE OR REPLACE FUNCTION update_consolidation_entry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp update
DROP TRIGGER IF EXISTS trigger_update_consolidation_entry_timestamp ON consolidation_entries;
CREATE TRIGGER trigger_update_consolidation_entry_timestamp
    BEFORE UPDATE
    ON consolidation_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_consolidation_entry_timestamp();

-- ============================================
-- PART 5: Update existing data (if needed)
-- ============================================

-- Set default values for existing entries
UPDATE consolidation_entries 
SET 
    status = 'approved',
    source = 'automatic'
WHERE status IS NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify the migration:

-- Check consolidation_entries columns
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'consolidation_entries' 
-- ORDER BY ordinal_position;

-- Check ic_reconciliations table exists
-- SELECT * FROM information_schema.tables 
-- WHERE table_name = 'ic_reconciliations';

-- Check enum types
-- SELECT typname, enumlabel 
-- FROM pg_type t 
-- JOIN pg_enum e ON t.oid = e.enumtypid 
-- WHERE typname IN ('entry_status', 'entry_source', 'hgb_reference', 'ic_reconciliation_status', 'ic_difference_reason')
-- ORDER BY typname, enumsortorder;

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================

-- To rollback this migration, run:
/*
DROP TABLE IF EXISTS ic_reconciliations CASCADE;
DROP TYPE IF EXISTS ic_reconciliation_status CASCADE;
DROP TYPE IF EXISTS ic_difference_reason CASCADE;

ALTER TABLE consolidation_entries 
DROP COLUMN IF EXISTS debit_account_id,
DROP COLUMN IF EXISTS credit_account_id,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS source,
DROP COLUMN IF EXISTS hgb_reference,
DROP COLUMN IF EXISTS affected_company_ids,
DROP COLUMN IF EXISTS created_by_user_id,
DROP COLUMN IF EXISTS approved_by_user_id,
DROP COLUMN IF EXISTS approved_at,
DROP COLUMN IF EXISTS reversed_by_entry_id,
DROP COLUMN IF EXISTS reverses_entry_id;

DROP TYPE IF EXISTS entry_status CASCADE;
DROP TYPE IF EXISTS entry_source CASCADE;
DROP TYPE IF EXISTS hgb_reference CASCADE;

DROP FUNCTION IF EXISTS calculate_ic_difference CASCADE;
DROP FUNCTION IF EXISTS update_consolidation_entry_timestamp CASCADE;
*/

-- ============================================
-- END OF MIGRATION
-- ============================================
