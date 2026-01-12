-- Migration: Erweiterte Felder für Zwischengesellschaftsgeschäfte
-- Gemäß KONSOLIDIERUNGSPLAN Phase 6.1

-- Erweiterte Tabelle für Zwischengesellschaftsgeschäfte
ALTER TABLE intercompany_transactions 
  ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS remaining_inventory DECIMAL(15,2);

-- Kommentare für bessere Dokumentation
COMMENT ON COLUMN intercompany_transactions.transaction_type IS 'Typ der Transaktion: receivable, payable, delivery, loan, other';
COMMENT ON COLUMN intercompany_transactions.profit_margin IS 'Gewinnmarge bei Lieferungen/Leistungen (Verkaufspreis - Anschaffungskosten)';
COMMENT ON COLUMN intercompany_transactions.remaining_inventory IS 'Verbleibender Bestand mit Zwischengewinn';

-- Index für bessere Performance bei Abfragen nach Transaktionstyp
CREATE INDEX IF NOT EXISTS idx_intercompany_transaction_type 
  ON intercompany_transactions(transaction_type);

-- Index für Abfragen nach Unternehmen-Paaren
CREATE INDEX IF NOT EXISTS idx_intercompany_company_pair 
  ON intercompany_transactions(from_company_id, to_company_id);
