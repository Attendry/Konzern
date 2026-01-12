-- Migration: Income Statement Accounts and Balances
-- HGB Reference: § 301, § 305
-- Purpose: Support for consolidated income statement (GuV-Konsolidierung)

CREATE TYPE income_statement_account_type AS ENUM (
  'revenue',
  'cost_of_sales',
  'operating_expense',
  'financial_income',
  'financial_expense',
  'extraordinary_income',
  'extraordinary_expense',
  'income_tax',
  'net_income'
);

CREATE TABLE income_statement_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  account_type income_statement_account_type NOT NULL,
  parent_account_id UUID REFERENCES income_statement_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE income_statement_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES income_statement_accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_intercompany BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_income_statement_accounts_account_type ON income_statement_accounts(account_type);
CREATE INDEX idx_income_statement_accounts_parent_account_id ON income_statement_accounts(parent_account_id);
CREATE INDEX idx_income_statement_balances_financial_statement_id ON income_statement_balances(financial_statement_id);
CREATE INDEX idx_income_statement_balances_account_id ON income_statement_balances(account_id);
CREATE INDEX idx_income_statement_balances_is_intercompany ON income_statement_balances(is_intercompany);

-- Triggers
CREATE OR REPLACE FUNCTION update_income_statement_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_income_statement_accounts_updated_at
  BEFORE UPDATE ON income_statement_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_income_statement_accounts_updated_at();

CREATE OR REPLACE FUNCTION update_income_statement_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_income_statement_balances_updated_at
  BEFORE UPDATE ON income_statement_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_income_statement_balances_updated_at();

COMMENT ON TABLE income_statement_accounts IS 'Income statement accounts for GuV-Konsolidierung (HGB § 301)';
COMMENT ON TABLE income_statement_balances IS 'Income statement balances per financial statement';
COMMENT ON COLUMN income_statement_balances.is_intercompany IS 'Whether this balance represents intercompany transactions that need elimination';
