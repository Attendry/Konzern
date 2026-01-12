# Detaillierter Plan: Konzernbilanz-Konsolidierung

## Übersicht
Dieser Plan beschreibt die vollständige Implementierung einer korrekten Konzernbilanz-Konsolidierung nach HGB (Handelsgesetzbuch), einschließlich der Identifikation von Abhängigkeiten zwischen Tochterunternehmen (TU) und Mutterunternehmen (H) sowie der korrekten Zuordnung und Eliminierung.

## Phase 1: Datenimport und Validierung

### 1.1 Upload-Problem beheben
**Aktueller Status**: Upload funktioniert noch nicht vollständig

**Lösung**:
- Validierung der Dateiformate (Excel/CSV)
- Korrekte Zuordnung der Spalten (Kontonummer, Kontoname, Soll, Haben, Saldo)
- Validierung der Datenintegrität vor dem Import
- Fehlerbehandlung und detaillierte Fehlermeldungen

**Excel-Muster für Konsolidierung**:
- Ein Excel-Muster-Template steht zum Download zur Verfügung: `templates/Konsolidierung_Muster.xlsx`
- Das Template enthält folgende Blätter:
  - **Bilanzdaten**: Vorlage für die Erfassung aller Bilanzpositionen pro Unternehmen
  - **Unternehmensinformationen**: Erfassung von Mutter- und Tochterunternehmen mit Beteiligungsverhältnissen
  - **Beteiligungsverhältnisse**: Detaillierte Erfassung der Beteiligungen nach HGB § 301
  - **Zwischengesellschaftsgeschäfte**: Erfassung aller Intercompany-Transaktionen
  - **Eigenkapital-Aufteilung**: Aufschlüsselung des Eigenkapitals für die Kapitalkonsolidierung
  - **Konsolidierungsübersicht**: Übersicht über alle Konsolidierungsschritte
- **Download-Funktion**: Der Nutzer kann das Excel-Muster über die Anwendung herunterladen und als Vorlage für den Datenimport verwenden

### 1.2 Datenstruktur-Validierung
- **Kontenplan-Struktur**: Validierung der Kontonummern und Kontenarten
- **Bilanzstruktur**: Prüfung auf vollständige Bilanzen (Aktiva = Passiva)
- **Zeitraum-Validierung**: Sicherstellung, dass alle Daten zum gleichen Geschäftsjahr gehören
- **Währungskonsistenz**: Alle Beträge in derselben Währung

### 1.3 Abhängigkeits-Identifikation
- **Unternehmenshierarchie**: Automatische Erkennung der Konzernstruktur
  - Mutterunternehmen (H) identifizieren
  - Tochterunternehmen (TU) identifizieren
  - Beteiligungsverhältnisse erfassen
  - **Hinweis**: Falls Informationen zur Unternehmenshierarchie nicht vorhanden sind, den Nutzer "Pizzatracker" nach der Auswertung fragen
- **Konsolidierungskreis**: Bestimmung, welche Unternehmen konsolidiert werden
  - Mehrheitsbeteiligungen (>50%)
  - Einheitliche Leitung
  - Konsolidierungspflicht nach HGB
  - **Hinweis**: Bei unklaren Konsolidierungspflichten den Nutzer "Pizzatracker" nach der Auswertung fragen

## Phase 2: Zwischengesellschaftsgeschäfte (Intercompany Transactions)

### 2.1 Identifikation von Zwischengesellschaftsgeschäften
- **Automatische Erkennung**:
  - Konten mit Flag `is_intercompany = true`
  - Forderungen zwischen Konzernunternehmen
  - Verbindlichkeiten zwischen Konzernunternehmen
  - Lieferungen und Leistungen zwischen Unternehmen
  - Kredite und Darlehen innerhalb des Konzerns
  - **Hinweis**: Falls Informationen zu Zwischengesellschaftsgeschäften nicht vollständig vorhanden sind, den Nutzer "Pizzatracker" nach der Auswertung fragen

### 2.2 Zuordnung und Matching
- **Forderungen ↔ Verbindlichkeiten**:
  - Automatisches Matching von Forderungen eines Unternehmens mit Verbindlichkeiten eines anderen
  - Identifikation der Geschäftspartner
  - Saldierung gegenläufiger Positionen
  - **Hinweis**: Bei nicht eindeutig zuordenbaren Positionen den Nutzer "Pizzatracker" nach der Auswertung fragen

- **Lieferungen und Leistungen**:
  - Erfassung von Umsatzerlösen bei Verkäufer
  - Erfassung von Aufwendungen bei Käufer
  - Eliminierung der Zwischenumsätze
  - **Hinweis**: Falls Informationen zu Lieferungen und Leistungen unvollständig sind, den Nutzer "Pizzatracker" nach der Auswertung fragen

### 2.3 Zwischenergebniseliminierung
- **Gewinnmarge berechnen**:
  - Verkaufspreis - Anschaffungskosten = Zwischengewinn
  - Anteiliger Gewinn bei noch vorhandenen Beständen
  - Zeitpunkt der Realisierung des Gewinns
  - **Hinweis**: Falls Anschaffungskosten oder Verkaufspreise nicht verfügbar sind, den Nutzer "Pizzatracker" nach der Auswertung fragen

- **Eliminierungsbuchungen**:
  - Eliminierung des Zwischengewinns aus Beständen
  - Eliminierung des Zwischengewinns aus Anlagevermögen
  - Korrektur der Abschreibungen auf Zwischengewinne

## Phase 3: Schuldenkonsolidierung

### 3.1 Forderungen und Verbindlichkeiten
- **Automatische Verrechnung**:
  - Forderungen von H gegen TU
  - Forderungen von TU gegen H
  - Forderungen zwischen verschiedenen TU
  - Verbindlichkeiten entsprechend

- **Saldenbildung**:
  - Netto-Saldo pro Unternehmen-Paar
  - Verrechnung gegenläufiger Positionen
  - Übrig bleibende Nettopositionen (falls nicht vollständig verrechenbar)

### 3.2 Kredite und Darlehen
- **Konsolidierung von Kreditbeziehungen**:
  - Kredite zwischen Konzernunternehmen
  - Zinsforderungen und -verbindlichkeiten
  - Eliminierung der Kreditbeziehungen

### 3.3 Sonstige Verbindlichkeiten
- **Weitere Positionen**:
  - Verbindlichkeiten aus Lieferungen und Leistungen
  - Sonstige Verbindlichkeiten zwischen Konzernunternehmen
  - Rückstellungen zwischen Konzernunternehmen

## Phase 4: Kapitalkonsolidierung

### 4.1 Beteiligungsbuchwert
- **Ermittlung des Beteiligungsbuchwerts nach Vollkonsolidierung (HGB)**:
  - Anschaffungskosten der Beteiligung (gemäß HGB § 301)
  - Zuzüglich anteiliger Gewinne seit Erwerb
  - Abzüglich anteiliger Verluste seit Erwerb
  - Abzüglich ausgeschütteter Dividenden seit Erwerb
  - **Hinweis**: Falls Informationen zu Anschaffungskosten oder historischen Entwicklungen fehlen, den Nutzer "Pizzatracker" nach der Auswertung fragen
  - **Berechnung nach HGB-Vollkonsolidierung**: Der Beteiligungsbuchwert wird ausschließlich nach den Vorschriften der Vollkonsolidierung gemäß HGB ermittelt

### 4.2 Eigenkapital der Tochterunternehmen
- **Aufteilung des Eigenkapitals**:
  - Gezeichnetes Kapital
  - Kapitalrücklagen
  - Gewinnrücklagen
  - Jahresüberschuss/Jahresfehlbetrag
  - **Hinweis**: Falls Eigenkapitalpositionen nicht vollständig erfasst sind, den Nutzer "Pizzatracker" nach der Auswertung fragen

- **Anteilige Zuordnung**:
  - Anteil des Mutterunternehmens
  - Anteil der Minderheiten (Minderheitsanteile)

### 4.3 Konsolidierungsbuchungen
- **Verrechnung Beteiligungsbuchwert gegen Eigenkapital**:
  - Eliminierung des Beteiligungsbuchwerts
  - Eliminierung des anteiligen Eigenkapitals
  - Ausweis von Minderheitsanteilen
  - Ausweis von Geschäfts- oder Firmenwert (Goodwill) oder passivischem Unterschiedsbetrag

### 4.4 Goodwill-Berechnung
- **Geschäfts- oder Firmenwert (Goodwill)**:
  - Beteiligungsbuchwert > Anteiliges Eigenkapital → Goodwill (Aktiva)
  - Beteiligungsbuchwert < Anteiliges Eigenkapital → Passivischer Unterschiedsbetrag (Passiva)

## Phase 5: Konsolidierte Bilanz erstellen

### 5.1 Saldierung der Einzelbilanzen
- **Zusammenführung**:
  - Addition aller Aktiva-Positionen
  - Addition aller Passiva-Positionen
  - Berücksichtigung der Eliminierungen

### 5.2 Anwendung der Konsolidierungsbuchungen
- **Eliminierungen anwenden**:
  - Zwischenergebniseliminierungen
  - Schuldenkonsolidierungen
  - Kapitalkonsolidierungen

### 5.3 Minderheitsanteile
- **Ausweis der Minderheitsanteile**:
  - Anteiliges Eigenkapital der Minderheiten
  - Anteiliger Jahresüberschuss der Minderheiten
  - Position in der Passiva der Konzernbilanz

### 5.4 Konsolidierte Bilanzstruktur
- **Aktiva**:
  - Anlagevermögen (konsolidiert)
  - Umlaufvermögen (konsolidiert)
  - Aktive Rechnungsabgrenzungsposten

- **Passiva**:
  - Eigenkapital (Mutterunternehmen)
  - Minderheitsanteile
  - Rückstellungen (konsolidiert)
  - Verbindlichkeiten (konsolidiert)
  - Passive Rechnungsabgrenzungsposten

## Phase 6: Technische Implementierung

### 6.1 Datenmodell-Erweiterungen
```sql
-- Erweiterte Tabelle für Zwischengesellschaftsgeschäfte
ALTER TABLE intercompany_transactions ADD COLUMN transaction_type VARCHAR(50);
ALTER TABLE intercompany_transactions ADD COLUMN profit_margin DECIMAL(15,2);
ALTER TABLE intercompany_transactions ADD COLUMN remaining_inventory DECIMAL(15,2);

-- Tabelle für Beteiligungsverhältnisse
CREATE TABLE IF NOT EXISTS participations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_company_id UUID NOT NULL REFERENCES companies(id),
  subsidiary_company_id UUID NOT NULL REFERENCES companies(id),
  participation_percentage DECIMAL(5,2) NOT NULL,
  acquisition_cost DECIMAL(15,2),
  acquisition_date DATE,
  UNIQUE(parent_company_id, subsidiary_company_id)
);
```

### 6.2 Service-Erweiterungen

#### 6.2.1 IntercompanyTransactionService
- Automatische Erkennung von Zwischengesellschaftsgeschäften
- Matching von Forderungen und Verbindlichkeiten
- Berechnung von Zwischengewinnen

#### 6.2.2 ParticipationService
- Verwaltung von Beteiligungsverhältnissen
- Berechnung von Beteiligungsbuchwerten nach Vollkonsolidierung (HGB)
- Ermittlung von Minderheitsanteilen
- **Hinweis**: Bei fehlenden Beteiligungsinformationen den Nutzer "Pizzatracker" nach der Auswertung fragen

#### 6.2.3 ConsolidationService (Erweiterung)
- Vollständige Zwischenergebniseliminierung
- Vollständige Schuldenkonsolidierung
- Vollständige Kapitalkonsolidierung
- Erstellung der konsolidierten Bilanz

### 6.3 Algorithmus für Konsolidierung

```
1. Lade alle Einzelbilanzen der konsolidierten Unternehmen
2. Identifiziere Zwischengesellschaftsgeschäfte
3. Führe Zwischenergebniseliminierung durch:
   a. Identifiziere Zwischenumsätze
   b. Berechne Zwischengewinne
   c. Eliminiere Zwischengewinne aus Beständen
   d. Eliminiere Zwischengewinne aus Anlagevermögen
4. Führe Schuldenkonsolidierung durch:
   a. Finde alle Forderungen zwischen Konzernunternehmen
   b. Finde alle Verbindlichkeiten zwischen Konzernunternehmen
   c. Verrechne gegenläufige Positionen
   d. Eliminiere verrechnete Beträge
5. Führe Kapitalkonsolidierung durch:
   a. Für jedes Tochterunternehmen:
      - Ermittle Beteiligungsbuchwert nach Vollkonsolidierung (HGB)
      - Ermittle anteiliges Eigenkapital
      - Berechne Goodwill oder passivischen Unterschiedsbetrag
      - Eliminiere Beteiligungsbuchwert
      - Eliminiere anteiliges Eigenkapital
      - Zeige Minderheitsanteile aus
      - **Hinweis**: Bei fehlenden Informationen den Nutzer "Pizzatracker" nach der Auswertung fragen
6. Erstelle konsolidierte Bilanz:
   a. Addiere alle Positionen
   b. Wende Eliminierungen an
   c. Zeige Minderheitsanteile aus
   d. Validiere Bilanzgleichheit (Aktiva = Passiva)
```

## Phase 7: Validierung und Qualitätssicherung

### 7.1 Bilanzgleichheit
- **Automatische Prüfung**: Aktiva = Passiva nach Konsolidierung
- **Abweichungen identifizieren**: Automatische Erkennung von Ungleichgewichten
- **Fehlerbehebung**: Hinweise zur Behebung von Ungleichgewichten

### 7.2 Vollständigkeitsprüfung
- **Alle Unternehmen erfasst**: Prüfung, ob alle konsolidierungspflichtigen Unternehmen erfasst sind
  - **Hinweis**: Bei fehlenden Unternehmen den Nutzer "Pizzatracker" nach der Auswertung fragen
- **Alle Positionen erfasst**: Prüfung auf fehlende Bilanzpositionen
  - **Hinweis**: Bei fehlenden Positionen den Nutzer "Pizzatracker" nach der Auswertung fragen
- **Alle Eliminierungen durchgeführt**: Prüfung auf vollständige Eliminierung

### 7.3 Plausibilitätsprüfungen
- **Betragsplausibilität**: Ungewöhnlich hohe oder niedrige Beträge
- **Strukturplausibilität**: Übliche Bilanzstruktur für Branche
- **Zeitliche Konsistenz**: Alle Daten aus demselben Geschäftsjahr

## Phase 8: Reporting und Visualisierung

### 8.1 Konsolidierte Bilanz
- **Strukturierte Darstellung**: Klare Gliederung nach HGB
- **Vergleichsdarstellung**: Vergleich mit Vorjahr
- **Detailansicht**: Drill-Down zu einzelnen Positionen

### 8.2 Konsolidierungsübersicht
- **Eliminierungen**: Übersicht aller durchgeführten Eliminierungen
- **Minderheitsanteile**: Detaillierte Aufschlüsselung
- **Goodwill**: Aufschlüsselung nach Tochterunternehmen

### 8.3 Export-Funktionen
- **PDF-Export**: Konsolidierte Bilanz als PDF
- **Excel-Export**: Detaillierte Daten als Excel
- **XML-Export**: Für weitere Verarbeitung

### 8.4 Excel-Muster Download
- **Template-Download**: Bereitstellung eines Excel-Muster-Templates (`templates/Konsolidierung_Muster.xlsx`) zum Download
- **Verwendung**: 
  - Nutzer kann das Template herunterladen
  - Template als Vorlage für den Datenimport verwenden
  - Alle erforderlichen Felder für die Konsolidierung sind vordefiniert
  - Beispiel-Daten zeigen die erwartete Struktur
- **Implementierung**: 
  - Download-Endpoint im Backend bereitstellen
  - Frontend-Button zum Download des Templates
  - Template wird aus dem `templates/` Verzeichnis bereitgestellt

## Implementierungsreihenfolge

### Sprint 1: Datenimport und Grundlagen
1. Upload-Problem beheben
2. Excel-Muster-Template bereitstellen (Download-Funktion)
3. Datenvalidierung implementieren
4. Abhängigkeits-Identifikation implementieren

### Sprint 2: Zwischengesellschaftsgeschäfte
1. Automatische Erkennung implementieren
2. Matching-Algorithmus entwickeln
3. Zwischenergebniseliminierung implementieren

### Sprint 3: Schuldenkonsolidierung
1. Forderungen/Verbindlichkeiten-Matching
2. Automatische Verrechnung
3. Eliminierungsbuchungen

### Sprint 4: Kapitalkonsolidierung
1. Beteiligungsverwaltung
2. Beteiligungsbuchwert-Berechnung nach Vollkonsolidierung (HGB)
3. Eigenkapital-Aufteilung
4. Goodwill-Berechnung
5. Minderheitsanteile

### Sprint 5: Konsolidierte Bilanz
1. Saldierung implementieren
2. Konsolidierungsbuchungen anwenden
3. Bilanzgleichheit prüfen

### Sprint 6: Validierung und Reporting
1. Validierungsregeln implementieren
2. Reporting-Funktionen
3. Export-Funktionen

## Erfolgskriterien

1. ✅ Upload funktioniert zuverlässig
2. ✅ Alle Zwischengesellschaftsgeschäfte werden identifiziert
3. ✅ Alle Eliminierungen werden korrekt durchgeführt
4. ✅ Konsolidierte Bilanz ist bilanzgleich
5. ✅ Minderheitsanteile werden korrekt ausgewiesen
6. ✅ Goodwill wird korrekt berechnet
7. ✅ Alle Validierungsregeln werden eingehalten
8. ✅ Reporting ist vollständig und korrekt

## Risiken und Mitigation

### Risiko 1: Unvollständige Daten
- **Mitigation**: Strikte Validierung vor Import, klare Fehlermeldungen

### Risiko 2: Komplexe Unternehmensstrukturen
- **Mitigation**: Flexible Hierarchie-Verwaltung, rekursive Konsolidierung

### Risiko 3: Performance bei großen Datenmengen
- **Mitigation**: Batch-Verarbeitung, Optimierung der Datenbankabfragen

### Risiko 4: HGB-Konformität
- **Mitigation**: Review durch Steuerberater, regelmäßige Updates bei Gesetzesänderungen

## Nächste Schritte

1. **Sofort**: Upload-Problem beheben
2. **Sofort**: Excel-Muster-Template Download-Funktion implementieren
3. **Kurzfristig**: Datenmodell erweitern (Participations-Tabelle)
4. **Mittelfristig**: Konsolidierungsalgorithmus vollständig implementieren
5. **Langfristig**: Erweiterte Reporting-Funktionen und Validierungen

## Excel-Muster Template

Das Excel-Muster-Template (`templates/Konsolidierung_Muster.xlsx`) ist bereits erstellt und enthält:

- **6 Arbeitsblätter** mit vordefinierten Strukturen
- **Beispiel-Daten** zur Veranschaulichung
- **Formatierte Spalten** für bessere Lesbarkeit
- **Hinweise und Anweisungen** in den einzelnen Blättern

**Verfügbare Blätter:**
1. Bilanzdaten - Erfassung aller Bilanzpositionen
2. Unternehmensinformationen - Mutter- und Tochterunternehmen
3. Beteiligungsverhältnisse - Nach HGB § 301
4. Zwischengesellschaftsgeschäfte - Intercompany-Transaktionen
5. Eigenkapital-Aufteilung - Für Kapitalkonsolidierung
6. Konsolidierungsübersicht - Zusammenfassung aller Schritte

**Nächste Implementierungsschritte:**
- Backend-Endpoint für Template-Download erstellen
- Frontend-Button zum Download hinzufügen
- Template-Datei im `templates/` Verzeichnis bereitstellen
