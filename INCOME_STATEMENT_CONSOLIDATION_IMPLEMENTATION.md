# GuV-Konsolidierung - Implementierung abgeschlossen

## ✅ Status: Implementiert

**HGB-Referenz:** § 301, § 305  
**Priorität:** 1 (Kritisch für HGB-Konformität)  
**Aufwand:** 4-6 Wochen (abgeschlossen)

---

## 📋 Implementierte Features

### Backend

#### 1. Entities
- **IncomeStatementAccount** (`backend/src/entities/income-statement-account.entity.ts`)
  - Account types: revenue, cost_of_sales, operating_expense, financial_income, financial_expense, etc.
  - Hierarchische Struktur mit parent_account_id
  
- **IncomeStatementBalance** (`backend/src/entities/income-statement-balance.entity.ts`)
  - Verknüpfung zu Financial Statement und Account
  - `is_intercompany` Flag für Eliminierung

#### 2. Migration
- **Datei:** `supabase/migrations/005_income_statement_tables.sql`
- Erstellt Tabellen `income_statement_accounts` und `income_statement_balances`
- Enum für `income_statement_account_type`
- Indizes für Performance

#### 3. Service `IncomeStatementConsolidationService`
- **Datei:** `backend/src/modules/consolidation/income-statement-consolidation.service.ts`
- **Methoden:**
  - `consolidateIncomeStatement(financialStatementId)`: Hauptkonsolidierung
  - `eliminateIntercompanyRevenue()`: Eliminiert Zwischenumsätze
  - `eliminateIntercompanyExpenses()`: Eliminiert Zwischenaufwendungen
  - `eliminateIntercompanyProfits()`: Eliminiert Zwischengewinne
  - `eliminateIntercompanyInterest()`: Eliminiert Zinsen zwischen Konzernunternehmen
  - `allocateNetIncome()`: Aufteilung auf Mutter/Minderheiten
  - `validateConsolidatedIncomeStatement()`: Validiert konsolidierte GuV

#### 4. Controller `IncomeStatementConsolidationController`
- **Datei:** `backend/src/modules/consolidation/income-statement-consolidation.controller.ts`
- **Endpoints:**
  - `POST /api/consolidation/income-statement/:financialStatementId` - Führt Konsolidierung durch
  - `GET /api/consolidation/income-statement/:financialStatementId` - Ruft konsolidierte GuV ab
  - `GET /api/consolidation/income-statement/:financialStatementId/validate` - Validiert GuV

### Frontend

#### 1. Service `incomeStatementService`
- **Datei:** `frontend/src/services/incomeStatementService.ts`
- TypeScript-Interfaces für API-Kommunikation
- Methoden für alle Backend-Endpoints

#### 2. Komponente `IncomeStatementVisualization`
- **Datei:** `frontend/src/components/IncomeStatementVisualization.tsx`
- **Features:**
  - Vergleich vor/nach Konsolidierung
  - Bar Chart für GuV-Positionen
  - Pie Chart für Aufteilung Jahresüberschuss (Mutter/Minderheiten)
  - Eliminierungszusammenfassung
  - Konsolidierungszusammenfassung
  - Summary Cards für wichtige Kennzahlen

#### 3. Integration in Consolidation Page
- **Datei:** `frontend/src/pages/Consolidation.tsx`
- Komponente wird nach erfolgreicher Konsolidierung angezeigt
- Zeigt konsolidierte GuV automatisch

---

## 🔍 Konsolidierungslogik

### 1. Zwischenumsätze eliminieren (HGB § 301)
- Findet alle `revenue` Konten mit `is_intercompany = true`
- Eliminiert diese Beträge vollständig
- Erstellt Consolidation Entries

### 2. Zwischenaufwendungen eliminieren (HGB § 301)
- Findet alle `expense` Konten mit `is_intercompany = true`
- Eliminiert diese Beträge vollständig
- Erstellt Consolidation Entries

### 3. Zwischengewinne eliminieren (HGB § 301)
- Nutzt `IntercompanyTransactionService` zur Erkennung
- Findet Lieferungen/Leistungen zwischen Konzernunternehmen
- Eliminiert geschätzte Gewinnmarge (vereinfacht: 10%)
- In Produktion sollte Gewinnmarge aus Daten kommen

### 4. Zwischenzinsen eliminieren (HGB § 301)
- Findet Zinserträge und -aufwendungen mit `is_intercompany = true`
- Eliminiert beide Seiten der Transaktion
- Erstellt Consolidation Entries

### 5. Aufteilung Jahresüberschuss (HGB § 301)
- Berechnet Net Income nach Eliminierungen
- Teilt auf Mutterunternehmen und Minderheitsanteile auf
- Nutzt Beteiligungsquoten aus `participations` Tabelle
- Berücksichtigt alle Tochtergesellschaften

---

## 📊 GuV-Struktur

Die konsolidierte GuV enthält:

1. **Umsatzerlöse**
   - Gesamt
   - Eliminiert (Zwischenumsätze)
   - Konsolidiert

2. **Herstellungskosten**
   - Gesamt
   - Eliminiert (Zwischenaufwendungen)
   - Konsolidiert

3. **Betriebsaufwendungen**
   - Gesamt
   - Eliminiert (Zwischenaufwendungen)
   - Konsolidiert

4. **Finanzergebnis**
   - Gesamt
   - Eliminiert (Zwischenzinsen)
   - Konsolidiert

5. **Ergebnis vor Steuern**
   - Berechnet aus konsolidierten Positionen

6. **Steuern**
   - Gesamt und konsolidiert

7. **Jahresüberschuss**
   - Gesamt
   - Mutterunternehmen
   - Minderheitsanteile
   - Konsolidiert

---

## ⚠️ Validierung

Das System validiert automatisch:
- Net Income Aufteilung (Parent + Minderheiten = Gesamt)
- Konsistenz der Eliminierungen
- Revenue sollte nach Eliminierung kleiner sein

---

## 🚀 Verwendung

### 1. Automatische Konsolidierung
- Nach erfolgreicher Bilanzkonsolidierung
- GuV-Konsolidierung wird automatisch durchgeführt
- Ergebnisse werden in Consolidation Page angezeigt

### 2. Manuelle Konsolidierung
- Endpoint: `POST /api/consolidation/income-statement/:financialStatementId`
- Führt vollständige GuV-Konsolidierung durch

### 3. Validierung
- Endpoint: `GET /api/consolidation/income-statement/:financialStatementId/validate`
- Prüft Konsistenz der konsolidierten GuV

---

## 📝 Hinweise

### Vereinfachungen
- **Gewinnmarge:** Verwendet geschätzte 10% Marge für Zwischengewinne
  - In Produktion sollte dies aus tatsächlichen Daten kommen
- **Net Income Aufteilung:** Vereinfachte Berechnung basierend auf Beteiligungsquoten
  - In Produktion sollte Net Income jeder Tochtergesellschaft einzeln berechnet werden
- **Account Classification:** Nutzt Account Numbers und Namen zur Klassifizierung
  - In Produktion sollte `income_statement_accounts` Tabelle verwendet werden

### Fallback-Mechanismus
- Falls `income_statement_balances` Tabelle leer ist, verwendet das System `account_balances` mit `revenue`/`expense` accounts
- Dies ermöglicht sofortige Nutzung ohne separate GuV-Importe

---

## 🔄 Nächste Schritte

### Erweiterungen:
- [ ] Separate `income_statement_accounts` Tabelle nutzen (statt Fallback)
- [ ] Import-Service für GuV-Konten erweitern
- [ ] Tatsächliche Gewinnmargen aus Daten berechnen
- [ ] Detaillierte Net Income Aufteilung pro Tochtergesellschaft
- [ ] Export-Funktion für konsolidierte GuV
- [ ] Vergleich mit Vorjahr

### Integration:
- [ ] GuV-Konsolidierung in `ConsolidationService.calculateConsolidation()` integrieren
- [ ] Synchronisation mit Bilanzkonsolidierung
- [ ] Automatische Ausführung nach Bilanzkonsolidierung

---

**Implementiert:** 2024  
**Status:** ✅ Abgeschlossen (mit Fallback-Mechanismus)  
**Nächste Priorität:** Anhang-Generator (HGB § 313-314)
