-- ============================================
-- PHASE 2: Consolidation Circle & Currency Management
-- Migration Script for Supabase/PostgreSQL
-- ============================================
-- 
-- Run this script in your Supabase SQL Editor
--
-- Created: 2026-01-12
-- ============================================

-- ============================================
-- PART 1: Extend companies table
-- ============================================

-- Add consolidation type
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS consolidation_type VARCHAR(20) DEFAULT 'full';

-- Add exclusion reason
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS exclusion_reason VARCHAR(30);

-- Add first consolidation date
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS first_consolidation_date DATE;

-- Add deconsolidation date
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS deconsolidation_date DATE;

-- Add functional currency
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS functional_currency VARCHAR(5) DEFAULT 'EUR';

-- Add country code
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);

-- Add industry
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS industry VARCHAR(100);

-- Add fiscal year end month
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS fiscal_year_end_month INTEGER DEFAULT 12;

-- Add notes
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add is ultimate parent flag
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS is_ultimate_parent BOOLEAN DEFAULT FALSE;

-- ============================================
-- PART 2: Extend participations table
-- ============================================

-- Add voting rights percentage
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS voting_rights_percentage DECIMAL(5, 2);

-- Add goodwill
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS goodwill DECIMAL(15, 2);

-- Add negative goodwill
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS negative_goodwill DECIMAL(15, 2);

-- Add hidden reserves
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS hidden_reserves DECIMAL(15, 2);

-- Add hidden liabilities
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS hidden_liabilities DECIMAL(15, 2);

-- Add equity at acquisition
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS equity_at_acquisition DECIMAL(15, 2);

-- Add is direct flag
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS is_direct BOOLEAN DEFAULT TRUE;

-- Add through company id (for indirect holdings)
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS through_company_id UUID REFERENCES companies(id);

-- Add is active flag
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add disposal date
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS disposal_date DATE;

-- Add disposal proceeds
ALTER TABLE participations 
ADD COLUMN IF NOT EXISTS disposal_proceeds DECIMAL(15, 2);

-- ============================================
-- PART 3: Create ownership_history table
-- ============================================

CREATE TABLE IF NOT EXISTS ownership_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    participation_id UUID NOT NULL REFERENCES participations(id) ON DELETE CASCADE,
    
    -- Type of change
    change_type VARCHAR(20) NOT NULL,
    
    -- Date of change
    effective_date DATE NOT NULL,
    
    -- Percentages
    percentage_before DECIMAL(5, 2) NOT NULL DEFAULT 0,
    percentage_after DECIMAL(5, 2) NOT NULL DEFAULT 0,
    percentage_change DECIMAL(5, 2) NOT NULL DEFAULT 0,
    
    -- Transaction details
    transaction_amount DECIMAL(15, 2),
    goodwill_change DECIMAL(15, 2),
    
    -- Description
    description TEXT,
    
    -- Reference to consolidation entry
    consolidation_entry_id UUID REFERENCES consolidation_entries(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_ownership_history_participation 
ON ownership_history(participation_id);

CREATE INDEX IF NOT EXISTS idx_ownership_history_date 
ON ownership_history(effective_date);

-- ============================================
-- PART 4: Create exchange_rates table
-- ============================================

CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Currency pair
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    
    -- Date and rate
    rate_date DATE NOT NULL,
    rate DECIMAL(18, 8) NOT NULL,
    
    -- Rate type
    rate_type VARCHAR(15) NOT NULL DEFAULT 'spot',
    
    -- Source
    rate_source VARCHAR(15) NOT NULL DEFAULT 'manual',
    
    -- Fiscal period (for average rates)
    fiscal_year INTEGER,
    fiscal_month INTEGER,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    CONSTRAINT uq_exchange_rate UNIQUE (from_currency, to_currency, rate_date, rate_type)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies 
ON exchange_rates(from_currency, to_currency);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_date 
ON exchange_rates(rate_date);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_fiscal_year 
ON exchange_rates(fiscal_year);

-- ============================================
-- PART 5: Create currency_translation_differences table
-- ============================================

CREATE TABLE IF NOT EXISTS currency_translation_differences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    
    -- Currencies
    source_currency VARCHAR(3) NOT NULL,
    target_currency VARCHAR(3) NOT NULL,
    
    -- Rates used
    spot_rate DECIMAL(18, 8) NOT NULL,
    average_rate DECIMAL(18, 8) NOT NULL,
    historical_rate DECIMAL(18, 8),
    
    -- Differences
    balance_sheet_difference DECIMAL(15, 2) NOT NULL DEFAULT 0,
    income_statement_difference DECIMAL(15, 2) NOT NULL DEFAULT 0,
    equity_difference DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_difference DECIMAL(15, 2) NOT NULL DEFAULT 0,
    cumulative_difference DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    -- Reference to consolidation entry
    consolidation_entry_id UUID REFERENCES consolidation_entries(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_ctd_company 
ON currency_translation_differences(company_id);

CREATE INDEX IF NOT EXISTS idx_ctd_fiscal_year 
ON currency_translation_differences(fiscal_year);

-- ============================================
-- PART 6: Enable Row Level Security
-- ============================================

ALTER TABLE ownership_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_translation_differences ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Enable all access for ownership_history" ON ownership_history;
CREATE POLICY "Enable all access for ownership_history" 
ON ownership_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for exchange_rates" ON exchange_rates;
CREATE POLICY "Enable all access for exchange_rates" 
ON exchange_rates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for currency_translation_differences" ON currency_translation_differences;
CREATE POLICY "Enable all access for currency_translation_differences" 
ON currency_translation_differences FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- PART 7: Insert sample exchange rates (optional)
-- ============================================

-- Uncomment to insert sample rates for 2025/2026
/*
INSERT INTO exchange_rates (from_currency, to_currency, rate_date, rate, rate_type, rate_source, fiscal_year)
VALUES 
  ('USD', 'EUR', '2025-12-31', 0.9230, 'spot', 'manual', 2025),
  ('USD', 'EUR', '2025-12-31', 0.9180, 'average', 'manual', 2025),
  ('GBP', 'EUR', '2025-12-31', 1.1820, 'spot', 'manual', 2025),
  ('GBP', 'EUR', '2025-12-31', 1.1750, 'average', 'manual', 2025),
  ('CHF', 'EUR', '2025-12-31', 1.0650, 'spot', 'manual', 2025),
  ('CHF', 'EUR', '2025-12-31', 1.0580, 'average', 'manual', 2025)
ON CONFLICT ON CONSTRAINT uq_exchange_rate DO NOTHING;
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify new company columns:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'companies' ORDER BY ordinal_position;

-- Verify new tables:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('ownership_history', 'exchange_rates', 'currency_translation_differences');

-- ============================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================

/*
-- To rollback this migration, run:

DROP TABLE IF EXISTS currency_translation_differences CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS ownership_history CASCADE;

ALTER TABLE companies 
DROP COLUMN IF EXISTS consolidation_type,
DROP COLUMN IF EXISTS exclusion_reason,
DROP COLUMN IF EXISTS first_consolidation_date,
DROP COLUMN IF EXISTS deconsolidation_date,
DROP COLUMN IF EXISTS functional_currency,
DROP COLUMN IF EXISTS country_code,
DROP COLUMN IF EXISTS industry,
DROP COLUMN IF EXISTS fiscal_year_end_month,
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS is_ultimate_parent;

ALTER TABLE participations 
DROP COLUMN IF EXISTS voting_rights_percentage,
DROP COLUMN IF EXISTS goodwill,
DROP COLUMN IF EXISTS negative_goodwill,
DROP COLUMN IF EXISTS hidden_reserves,
DROP COLUMN IF EXISTS hidden_liabilities,
DROP COLUMN IF EXISTS equity_at_acquisition,
DROP COLUMN IF EXISTS is_direct,
DROP COLUMN IF EXISTS through_company_id,
DROP COLUMN IF EXISTS is_active,
DROP COLUMN IF EXISTS disposal_date,
DROP COLUMN IF EXISTS disposal_proceeds;
*/

-- ============================================
-- END OF MIGRATION
-- ============================================
