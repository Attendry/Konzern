-- Migration: Tabelle für Beteiligungsverhältnisse
-- Gemäß KONSOLIDIERUNGSPLAN Phase 6.1

-- Tabelle für Beteiligungsverhältnisse
CREATE TABLE IF NOT EXISTS participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subsidiary_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  participation_percentage DECIMAL(5,2) NOT NULL CHECK (participation_percentage >= 0 AND participation_percentage <= 100),
  acquisition_cost DECIMAL(15,2),
  acquisition_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(parent_company_id, subsidiary_company_id)
);

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_participations_parent ON participations(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_participations_subsidiary ON participations(subsidiary_company_id);

-- Trigger für automatische updated_at Aktualisierung
CREATE TRIGGER update_participations_updated_at BEFORE UPDATE ON participations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Kommentare für bessere Dokumentation
COMMENT ON TABLE participations IS 'Beteiligungsverhältnisse zwischen Mutter- und Tochterunternehmen';
COMMENT ON COLUMN participations.participation_percentage IS 'Beteiligungsquote in Prozent (0-100)';
COMMENT ON COLUMN participations.acquisition_cost IS 'Anschaffungskosten der Beteiligung gemäß HGB § 301';
COMMENT ON COLUMN participations.acquisition_date IS 'Erwerbsdatum der Beteiligung';
