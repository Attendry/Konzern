# HGB Import Template Review - Wirtschaftsprüfer Empfehlungen

**Datum:** 2026-01-14  
**Reviewer:** Wirtschaftsprüfer  
**Zweck:** Optimierung des Import-Templates für HGB-Konsolidierung

---

## Executive Summary

Das aktuelle Import-Template ist grundsätzlich gut strukturiert, benötigt jedoch erhebliche Verbesserungen für eine optimale HGB-Konformität und Benutzerfreundlichkeit. Die folgenden Empfehlungen basieren auf HGB §§ 266, 275, 301, 303, 305 und den Anforderungen der IDW Prüfungsstandards.

---

## 1. Aktuelle Template-Struktur - Analyse

### Vorhandene Blätter:
1. **Bilanzdaten** - Basis-Import für Bilanzpositionen
2. **Unternehmensinformationen** - Basis-Informationen
3. **Beteiligungsverhältnisse** - Für Kapitalkonsolidierung
4. **Zwischengesellschaftsgeschäfte** - Für Schulden- und Zwischenergebniseliminierung
5. **Eigenkapital-Aufteilung** - Für Minderheitsanteile
6. **Konsolidierungsübersicht** - Übersicht

### Stärken:
✅ Mehrere Blätter für verschiedene Konsolidierungsaspekte  
✅ Beispiel-Daten vorhanden  
✅ Grundlegende Formatierung vorhanden

### Schwächen:
❌ Fehlende GuV-Daten (HGB § 275)  
❌ Unvollständige HGB-Bilanzstruktur (HGB § 266)  
❌ Fehlende Währungsumrechnung  
❌ Keine SKR-Kontenplan-Referenz  
❌ Unklare Kennzeichnung von Zwischengesellschaftsgeschäften  
❌ Fehlende Validierungsregeln im Template  
❌ Keine Anleitung/Readme-Blatt

---

## 2. Kritische HGB-Anforderungen - Fehlende Elemente

### 2.1 GuV-Daten (HGB § 275) - **KRITISCH**

**Problem:** Das Template enthält KEINE GuV-Positionen, obwohl das System GuV-Konsolidierung unterstützt.

**HGB-Referenz:** § 275 HGB (Gewinn- und Verlustrechnung)

**Empfehlung:**
- **Neues Blatt "GuV-Daten"** hinzufügen mit folgenden Spalten:
  - Unternehmen
  - Kontonummer (GuV-Konten)
  - Kontoname
  - Betrag (Soll/Haben je nach Kontotyp)
  - Kontotyp (Umsatzerlöse, Aufwendungen, etc.)
  - Zwischengesellschaftsgeschäft (Ja/Nein)
  - Gegenpartei (bei Zwischengesellschaftsgeschäften)
  - Bemerkung

**Beispiel-Struktur:**
```
Unternehmen | Kontonummer | Kontoname | Betrag | Kontotyp | Zwischengesellschaft | Gegenpartei | Bemerkung
Mutter H   | 8000        | Umsatzerlöse | 1000000 | revenue | Nein | | 
Mutter H   | 8000        | Umsatzerlöse | 100000 | revenue | Ja | TU1 | Zwischenumsatz
TU1        | 4000        | Materialaufwand | 80000 | cost_of_sales | Ja | Mutter H | Zwischenaufwand
```

### 2.2 Vollständige HGB-Bilanzstruktur (HGB § 266)

**Problem:** Das Template zeigt nur einzelne Konten, nicht die vollständige HGB-Bilanzstruktur.

**HGB-Referenz:** § 266 HGB (Bilanzgliederung)

**Empfehlung:**
- **Neues Blatt "HGB-Bilanzstruktur"** als Referenz hinzufügen
- Zeigt die vollständige Gliederung nach HGB § 266:
  - **Aktivseite:**
    - A. Anlagevermögen
      - I. Immaterielle Vermögensgegenstände
      - II. Sachanlagen
      - III. Finanzanlagen
    - B. Umlaufvermögen
      - I. Vorräte
      - II. Forderungen und sonstige Vermögensgegenstände
      - III. Wertpapiere
      - IV. Kassenbestand, Bundesbankguthaben, Guthaben bei Kreditinstituten
    - C. Rechnungsabgrenzungsposten
    - D. Aktive latente Steuern
  - **Passivseite:**
    - A. Eigenkapital
      - I. Gezeichnetes Kapital
      - II. Kapitalrücklage
      - III. Gewinnrücklagen
      - IV. Gewinnvortrag/Verlustvortrag
      - V. Jahresüberschuss/Jahresfehlbetrag
    - B. Rückstellungen
    - C. Verbindlichkeiten
    - D. Rechnungsabgrenzungsposten
    - E. Passive latente Steuern

- **Mapping-Spalte** im Bilanzdaten-Blatt hinzufügen:
  - Spalte "HGB-Position" zur Zuordnung zu HGB § 266 Positionen

### 2.3 SKR-Kontenplan-Referenz

**Problem:** Keine Referenz auf Standard-Kontenpläne (SKR 03, SKR 04).

**Empfehlung:**
- **Neues Blatt "Kontenplan-Referenz"** hinzufügen
- Enthält typische Kontonummern-Bereiche:
  - 0000-0999: Anlagevermögen (Immaterielle Vermögensgegenstände)
  - 1000-1499: Anlagevermögen (Sachanlagen, Finanzanlagen)
  - 1500-1999: Umlaufvermögen (Vorräte, Forderungen)
  - 2000-2999: Umlaufvermögen (Wertpapiere, Kasse, Bank)
  - 3000-3999: Eigenkapital
  - 4000-4999: Verbindlichkeiten
  - 5000-5999: Rückstellungen
  - 6000-6999: Aufwendungen (Material, Personal)
  - 7000-7999: Aufwendungen (Abschreibungen, Zinsen)
  - 8000-8999: Erträge (Umsatzerlöse, sonstige Erträge)
  - 9000-9999: GuV-Abschluss

### 2.4 Währungsumrechnung

**Problem:** Keine Unterstützung für ausländische Tochterunternehmen.

**HGB-Referenz:** § 256a HGB (Währungsumrechnung)

**Empfehlung:**
- **Neues Blatt "Währungsumrechnung"** hinzufügen
- Spalten:
  - Unternehmen
  - Währung (ISO-Code: EUR, USD, GBP, etc.)
  - Umrechnungskurs (Stichtag)
  - Durchschnittskurs (für GuV)
  - Bemerkung

### 2.5 Verbesserte Zwischengesellschaftsgeschäfte-Kennzeichnung

**Problem:** Aktuelle Struktur ist unklar für komplexe Transaktionen.

**HGB-Referenz:** § 303 HGB (Schuldenkonsolidierung), § 305 HGB (Zwischenergebniseliminierung)

**Empfehlung:**
- **Erweiterte Spalten im Blatt "Zwischengesellschaftsgeschäfte":**
  - Transaktions-ID (zur Gruppierung zusammengehöriger Buchungen)
  - Transaktionstyp (Forderung/Verbindlichkeit, Lieferung, Dienstleistung, Zinsen, Dividenden)
  - Eliminierungsmethode (Vollständig, Teilweise, Zeitanteilig)
  - Eliminierungsbetrag (falls abweichend vom Gesamtbetrag)
  - Verrechnungsdatum (für zeitanteilige Eliminierung)
  - HGB-Referenz (§ 303, § 305)

### 2.6 Latente Steuern

**Problem:** Keine explizite Erfassung latenter Steuern.

**HGB-Referenz:** § 274 HGB (Latente Steuern)

**Empfehlung:**
- **Neues Blatt "Latente Steuern"** hinzufügen
- Spalten:
  - Unternehmen
  - Steuerart (Aktiv/Passiv)
  - Ursprung (Bilanzierungshilfen, Bewertungsunterschiede, etc.)
  - Temporäre Differenz
  - Steuersatz
  - Latente Steuer
  - Bemerkung

---

## 3. Benutzerfreundlichkeit - Verbesserungen

### 3.1 Readme/Anleitung-Blatt

**Empfehlung:**
- **Neues Blatt "Anleitung"** als erstes Blatt
- Enthält:
  - Übersicht über alle Blätter
  - Schritt-für-Schritt-Anleitung
  - HGB-Referenzen
  - Häufige Fehler und Lösungen
  - Kontaktinformationen

### 3.2 Validierungsregeln im Excel

**Empfehlung:**
- Excel-Validierungsregeln hinzufügen:
  - Dropdown-Listen für Unternehmen (aus Blatt "Unternehmensinformationen")
  - Dropdown-Listen für Kontotypen
  - Zahlenformat-Validierung
  - Pflichtfeld-Validierung
  - Bilanzgleichung-Prüfung (Aktiva = Passiva)

### 3.3 Beispiel-Daten erweitern

**Empfehlung:**
- Mehr realistische Beispiel-Daten:
  - Vollständige Bilanz mit allen HGB-Positionen
  - Vollständige GuV
  - Komplexe Zwischengesellschaftsgeschäfte
  - Minderheitsanteile
  - Goodwill-Berechnung

### 3.4 Farbcodierung

**Empfehlung:**
- Farbcodierung für verschiedene Datentypen:
  - **Blau:** Pflichtfelder
  - **Gelb:** Optionale Felder
  - **Grün:** Berechnete Felder (Formeln)
  - **Rot:** Warnungen/Hinweise

### 3.5 Formeln für automatische Berechnungen

**Empfehlung:**
- Formeln hinzufügen:
  - Saldo = Soll - Haben (automatisch)
  - Bilanzsumme (automatisch)
  - Eigenkapital-Summe (automatisch)
  - Minderheitsanteil = Eigenkapital × (1 - Beteiligungs-%)

---

## 4. Technische Verbesserungen

### 4.1 Spaltenreihenfolge optimieren

**Aktuell (Bilanzdaten):**
```
Unternehmen | Kontonummer | Kontoname | Soll | Haben | Saldo | Bemerkung
```

**Empfohlen:**
```
Unternehmen | Kontonummer | Kontoname | HGB-Position | Kontotyp | Soll | Haben | Saldo | Zwischengesellschaft | Gegenpartei | Bemerkung
```

### 4.2 Datenvalidierung

**Empfehlung:**
- Excel-Validierungsregeln:
  - Kontonummer: Text, max. 20 Zeichen
  - Beträge: Zahl, 2 Dezimalstellen
  - Beteiligungs-%: Zahl zwischen 0 und 100
  - Datum: Gültiges Datumsformat

### 4.3 Konsistenz-Prüfung

**Empfehlung:**
- Formeln für Konsistenz-Prüfung:
  - Summe aller Soll = Summe aller Haben (bei korrekter Buchung)
  - Bilanzgleichung: Aktiva = Passiva
  - Zwischengesellschaftsgeschäfte: Summe Forderungen = Summe Verbindlichkeiten

---

## 5. Priorisierte Implementierungsliste

### Phase 1 - Kritisch (Sofort)
1. ✅ **GuV-Daten-Blatt hinzufügen** (HGB § 275)
2. ✅ **HGB-Bilanzstruktur-Referenz hinzufügen** (HGB § 266)
3. ✅ **Anleitung-Blatt hinzufügen**
4. ✅ **Zwischengesellschaftsgeschäfte erweitern** (Transaktions-ID, Eliminierungsmethode)

### Phase 2 - Wichtig (Nächste Version)
5. ✅ **Kontenplan-Referenz hinzufügen**
6. ✅ **Währungsumrechnung-Blatt hinzufügen**
7. ✅ **Latente Steuern-Blatt hinzufügen**
8. ✅ **Excel-Validierungsregeln implementieren**

### Phase 3 - Nice-to-Have (Zukünftig)
9. ✅ **Erweiterte Beispiel-Daten**
10. ✅ **Farbcodierung**
11. ✅ **Automatische Formeln für Berechnungen**

---

## 6. Download-Funktionalität prüfen

### Aktueller Status:
- ✅ Template ist downloadbar über "Vorlage herunterladen" Button
- ✅ Backend-Endpoint `/api/import/template` vorhanden
- ✅ Frontend-Service `downloadTemplate()` vorhanden

### Empfehlung:
- **Verbesserung:** Template-Versionierung
  - Versionsnummer im Dateinamen: `Konsolidierung_Muster_v2.0.xlsx`
  - Versionsinfo im Anleitung-Blatt
  - Changelog im Anleitung-Blatt

---

## 7. HGB-Compliance Checkliste

### Für jeden Import sollten folgende Daten vorhanden sein:

- [ ] **Bilanzdaten** (HGB § 266)
  - [ ] Alle Anlagevermögen-Positionen
  - [ ] Alle Umlaufvermögen-Positionen
  - [ ] Eigenkapital vollständig
  - [ ] Rückstellungen
  - [ ] Verbindlichkeiten
  - [ ] Rechnungsabgrenzungsposten

- [ ] **GuV-Daten** (HGB § 275)
  - [ ] Umsatzerlöse
  - [ ] Aufwendungen
  - [ ] Finanzergebnis
  - [ ] Steuern
  - [ ] Jahresüberschuss

- [ ] **Konsolidierungsdaten**
  - [ ] Beteiligungsverhältnisse (HGB § 301)
  - [ ] Zwischengesellschaftsgeschäfte (HGB § 303, § 305)
  - [ ] Minderheitsanteile (HGB § 301)
  - [ ] Goodwill/Differenz (HGB § 301)

- [ ] **Zusätzliche Daten (falls zutreffend)**
  - [ ] Währungsumrechnung (HGB § 256a)
  - [ ] Latente Steuern (HGB § 274)

---

## 8. Zusammenfassung der Empfehlungen

### Must-Have (Kritisch):
1. **GuV-Daten-Blatt** - Fehlt komplett, aber System unterstützt GuV-Konsolidierung
2. **HGB-Bilanzstruktur-Referenz** - Für korrekte Zuordnung zu HGB § 266
3. **Anleitung-Blatt** - Für Benutzerfreundlichkeit
4. **Erweiterte Zwischengesellschaftsgeschäfte** - Für komplexe Konsolidierungen

### Should-Have (Wichtig):
5. **Kontenplan-Referenz** - Für Standardisierung
6. **Währungsumrechnung** - Für internationale Konzerne
7. **Latente Steuern** - Für vollständige HGB-Compliance
8. **Excel-Validierung** - Für Datenqualität

### Nice-to-Have (Optional):
9. **Erweiterte Beispiele** - Für besseres Verständnis
10. **Farbcodierung** - Für bessere Übersicht
11. **Automatische Formeln** - Für weniger Fehler

---

## 9. Nächste Schritte

1. **Template-Script aktualisieren** (`create_excel_template.py`)
   - Neue Blätter hinzufügen
   - Struktur verbessern
   - Validierungsregeln implementieren

2. **Backend prüfen**
   - Sicherstellen, dass alle neuen Blätter importiert werden können
   - Mapping-Logik erweitern falls nötig

3. **Frontend prüfen**
   - Download-Button funktioniert (✅ bereits vorhanden)
   - Eventuell Template-Vorschau hinzufügen

4. **Dokumentation aktualisieren**
   - Anleitung im Template selbst
   - README aktualisieren

---

**Ende des Reviews**
