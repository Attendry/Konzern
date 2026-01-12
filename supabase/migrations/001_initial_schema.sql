-- Initial Database Schema for Konzern
-- This migration creates all necessary tables for the consolidated financial statements application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  tax_id VARCHAR(50),
  address TEXT,
  legal_form VARCHAR(100),
  parent_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  is_consolidated BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial Statements table
CREATE TABLE IF NOT EXISTS financial_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'consolidated')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account Balances table
CREATE TABLE IF NOT EXISTS account_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  balance DECIMAL(15,2) DEFAULT 0,
  is_intercompany BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(financial_statement_id, account_id)
);

-- Consolidation Entries table
CREATE TABLE IF NOT EXISTS consolidation_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  financial_statement_id UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN ('elimination', 'reclassification', 'capital_consolidation', 'debt_consolidation', 'other')),
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Intercompany Transactions table
CREATE TABLE IF NOT EXISTS intercompany_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  to_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_companies_parent ON companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_financial_statements_company ON financial_statements(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_statements_year ON financial_statements(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_account_balances_statement ON account_balances(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_account ON account_balances(account_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_entries_statement ON consolidation_entries(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_from ON intercompany_transactions(from_company_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_to ON intercompany_transactions(to_company_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_statements_updated_at BEFORE UPDATE ON financial_statements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_balances_updated_at BEFORE UPDATE ON account_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consolidation_entries_updated_at BEFORE UPDATE ON consolidation_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intercompany_transactions_updated_at BEFORE UPDATE ON intercompany_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
