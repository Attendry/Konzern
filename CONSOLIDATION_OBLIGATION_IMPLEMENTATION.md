# Konsolidierungspflicht-Prüfung - Implementierung abgeschlossen

## ✅ Status: Implementiert

**HGB-Referenz:** § 290, § 291, § 292, § 296  
**Priorität:** 1 (Kritisch für HGB-Konformität)  
**Aufwand:** 2-3 Wochen (abgeschlossen)

---

## 📋 Implementierte Features

### Backend

#### 1. Entity `ConsolidationObligationCheck`
- **Datei:** `backend/src/entities/consolidation-obligation-check.entity.ts`
- **Felder:**
  - `companyId`: Referenz zum Unternehmen
  - `isObligatory`: Ob Konsolidierungspflicht besteht
  - `reason`: Grund (Mehrheitsbeteiligung, Einheitliche Leitung, Beherrschungsvertrag, Keine)
  - `participationPercentage`: Beteiligungsquote bei Mehrheitsbeteiligung
  - `hasUnifiedManagement`: Einheitliche Leitung (manuell)
  - `hasControlAgreement`: Beherrschungsvertrag (manuell)
  - `exceptions`: Ausnahmen nach HGB § 296
  - `manualDecisionComment`: Kommentar für manuelle Entscheidungen
  - `checkedAt`: Zeitpunkt der Prüfung

#### 2. Migration
- **Datei:** `supabase/migrations/004_consolidation_obligation_checks.sql`
- Erstellt Tabelle `consolidation_obligation_checks`
- Enums für `consolidation_obligation_reason` und `consolidation_exception`
- Indizes für Performance
- Trigger für `updated_at`

#### 3. Service `ConsolidationObligationService`
- **Datei:** `backend/src/modules/consolidation/consolidation-obligation.service.ts`
- **Methoden:**
  - `checkObligation(companyId)`: Hauptprüfung nach HGB § 290-292
  - `checkMajorityInterest(companyId)`: Prüft Mehrheitsbeteiligung (>50%)
  - `checkUnifiedManagement(companyId)`: Prüft einheitliche Leitung
  - `checkControlAgreement(companyId)`: Prüft Beherrschungsvertrag
  - `checkExceptions(companyId)`: Prüft Ausnahmen nach HGB § 296
  - `checkMateriality(companyId)`: Prüft Bedeutungslosigkeit
  - `checkAll()`: Prüft alle Unternehmen
  - `getWarnings()`: Ruft Warnungen ab
  - `getLastCheck(companyId)`: Ruft letzte Prüfung ab
  - `updateManualDecision(companyId, decision)`: Aktualisiert manuelle Entscheidung

#### 4. Controller `ConsolidationObligationController`
- **Datei:** `backend/src/modules/consolidation/consolidation-obligation.controller.ts`
- **Endpoints:**
  - `GET /api/consolidation/obligation/check/:companyId` - Prüft ein Unternehmen
  - `POST /api/consolidation/obligation/check-all` - Prüft alle Unternehmen
  - `GET /api/consolidation/obligation/warnings` - Ruft Warnungen ab
  - `GET /api/consolidation/obligation/last-check/:companyId` - Letzte Prüfung
  - `PUT /api/consolidation/obligation/manual-decision/:companyId` - Manuelle Entscheidung

### Frontend

#### 1. Service `consolidationObligationService`
- **Datei:** `frontend/src/services/consolidationObligationService.ts`
- TypeScript-Interfaces für API-Kommunikation
- Methoden für alle Backend-Endpoints

#### 2. Komponente `ConsolidationObligationCheck`
- **Datei:** `frontend/src/components/ConsolidationObligationCheck.tsx`
- **Features:**
  - Automatische Prüfung bei Laden
  - Anzeige der Prüfergebnisse mit Farbcodierung
  - Warnungen und Empfehlungen
  - HGB-Referenzen
  - Manuelle Entscheidungen (Einheitliche Leitung, Beherrschungsvertrag)
  - Kommentarfeld für Begründungen

#### 3. Integration in Company Management
- **Datei:** `frontend/src/pages/CompanyManagement.tsx`
- Komponente wird beim Bearbeiten eines Unternehmens angezeigt
- Automatische Prüfung nach Speichern
- "HGB-Prüfung" Button in der Unternehmensliste

---

## 🔍 Prüflogik

### 1. Mehrheitsbeteiligung (HGB § 290 Abs. 1)
- Prüft Beteiligungen in der `participations` Tabelle
- Konsolidierungspflicht bei >50% Beteiligung
- Berücksichtigt mehrere Gesellschafter (Summe >50%)

### 2. Einheitliche Leitung (HGB § 290 Abs. 1)
- Erfordert manuelle Eingabe
- Wird aus gespeicherten Prüfungen geladen
- Standard: Keine einheitliche Leitung

### 3. Beherrschungsvertrag (HGB § 291)
- Erfordert manuelle Eingabe
- Wird aus gespeicherten Prüfungen geladen
- Standard: Kein Beherrschungsvertrag

### 4. Ausnahmen (HGB § 296)
- **Bedeutungslosigkeit:** Bilanzsumme < 5% der Konzern-Bilanzsumme
- Weitere Ausnahmen können manuell hinzugefügt werden:
  - Vorübergehende Beherrschung
  - Schwerwiegende Beschränkungen
  - Wesentlich abweichende Tätigkeiten

---

## ⚠️ Warnungen und Empfehlungen

Das System generiert automatisch:

### Warnungen
- Unternehmen sollte konsolidiert werden, ist aber nicht markiert
- Einheitliche Leitung erkannt ohne Mehrheitsbeteiligung

### Empfehlungen
- Unternehmen als konsolidiert markieren
- Minderheitsanteile berücksichtigen (bei <100% Beteiligung)
- HGB-Referenzen für weitere Informationen

---

## 📊 HGB-Referenzen

Das System dokumentiert automatisch:
- **HGB § 290 Abs. 1**: Mehrheitsbeteiligung / Einheitliche Leitung
- **HGB § 291**: Beherrschungsvertrag
- **HGB § 296**: Ausnahmen (Bedeutungslosigkeit, etc.)
- **HGB § 301**: Minderheitsanteile (bei <100% Beteiligung)

---

## 🚀 Verwendung

### 1. Automatische Prüfung
- Beim Bearbeiten eines Unternehmens wird automatisch geprüft
- Ergebnisse werden sofort angezeigt

### 2. Manuelle Prüfung
- Button "HGB-Prüfung" in der Unternehmensliste
- Oder direkt beim Bearbeiten

### 3. Manuelle Entscheidungen
- Einheitliche Leitung kann manuell bestätigt werden
- Beherrschungsvertrag kann manuell bestätigt werden
- Kommentar für Begründung hinzufügen

### 4. Warnungen abrufen
- Endpoint `/api/consolidation/obligation/warnings`
- Zeigt alle Unternehmen, die konsolidiert werden sollten

---

## 🔄 Nächste Schritte

### Automatische Prüfung bei:
- [ ] Erstellung/Änderung von Beteiligungen
- [ ] Änderung der Unternehmenshierarchie
- [ ] Vor Konsolidierung (als Validierung)

### Erweiterungen:
- [ ] Dashboard-Widget für Warnungen
- [ ] E-Mail-Benachrichtigungen bei neuen Warnungen
- [ ] Export der Prüfergebnisse
- [ ] Historie der Prüfungen pro Unternehmen

---

## 📝 Notizen

- Die Prüfung der Bedeutungslosigkeit verwendet eine vereinfachte Regel (5% der Bilanzsumme)
- In der Praxis werden mehrere Kriterien geprüft (Bilanzsumme, Umsatz, Mitarbeiterzahl)
- Einheitliche Leitung und Beherrschungsvertrag erfordern manuelle Eingabe, da sie nicht automatisch aus Daten ableitbar sind
- Alle Prüfungen werden in der Datenbank gespeichert für Audit-Zwecke

---

**Implementiert:** 2024  
**Status:** ✅ Abgeschlossen  
**Nächste Priorität:** GuV-Konsolidierung (HGB § 301)
