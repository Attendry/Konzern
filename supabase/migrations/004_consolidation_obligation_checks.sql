-- Migration: Consolidation Obligation Checks
-- HGB Reference: § 290, § 291, § 292, § 296
-- Purpose: Track consolidation obligations and compliance checks

CREATE TYPE consolidation_obligation_reason AS ENUM (
  'majority_interest',
  'unified_management',
  'control_agreement',
  'none'
);

CREATE TYPE consolidation_exception AS ENUM (
  'materiality',
  'temporary_control',
  'severe_restrictions',
  'different_activities'
);

CREATE TABLE consolidation_obligation_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_obligatory BOOLEAN NOT NULL DEFAULT false,
  reason consolidation_obligation_reason,
  participation_percentage DECIMAL(5,2),
  has_unified_management BOOLEAN,
  has_control_agreement BOOLEAN,
  exceptions consolidation_exception[],
  manual_decision_comment TEXT,
  checked_by_user_id UUID,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX idx_consolidation_obligation_checks_company_id ON consolidation_obligation_checks(company_id);
CREATE INDEX idx_consolidation_obligation_checks_is_obligatory ON consolidation_obligation_checks(is_obligatory);
CREATE INDEX idx_consolidation_obligation_checks_checked_at ON consolidation_obligation_checks(checked_at);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_consolidation_obligation_checks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_consolidation_obligation_checks_updated_at
  BEFORE UPDATE ON consolidation_obligation_checks
  FOR EACH ROW
  EXECUTE FUNCTION update_consolidation_obligation_checks_updated_at();

COMMENT ON TABLE consolidation_obligation_checks IS 'Tracks consolidation obligation checks according to HGB § 290-292';
COMMENT ON COLUMN consolidation_obligation_checks.is_obligatory IS 'Whether consolidation is obligatory according to HGB';
COMMENT ON COLUMN consolidation_obligation_checks.reason IS 'Reason for consolidation obligation (HGB § 290)';
COMMENT ON COLUMN consolidation_obligation_checks.participation_percentage IS 'Participation percentage if majority interest is the reason';
COMMENT ON COLUMN consolidation_obligation_checks.has_unified_management IS 'Whether unified management exists (HGB § 290 Abs. 1)';
COMMENT ON COLUMN consolidation_obligation_checks.has_control_agreement IS 'Whether control agreement exists (HGB § 291)';
COMMENT ON COLUMN consolidation_obligation_checks.exceptions IS 'Exceptions to consolidation obligation (HGB § 296)';
COMMENT ON COLUMN consolidation_obligation_checks.manual_decision_comment IS 'Comment for manual decisions overriding automatic check';
