export interface DocumentationSubsection {
  id: string;
  title: string;
  content: string;
  screenshot?: string;
  example?: string;
  tldr?: string; // Kurze Zusammenfassung
  lastUpdated?: string; // Datum der letzten Aktualisierung
  relatedSections?: string[]; // IDs verwandter Abschnitte
  contentType?: 'tutorial' | 'reference' | 'concept' | 'workflow' | 'troubleshooting';
  useCases?: {
    role: 'wp' | 'buchhalter' | 'controller' | 'geschäftsführung';
    description: string;
  }[];
}

export interface DocumentationSection {
  id: string;
  title: string;
  subsections: DocumentationSubsection[];
}

export const documentationContent: DocumentationSection[] = [
  {
    id: 'getting-started',
    title: 'Einstieg & Erste Schritte',
    subsections: [
      {
        id: 'welcome',
        title: 'Willkommen',
        content: `Die Konzern-Anwendung unterstützt Sie bei der Erstellung konsolidierter Jahresabschlüsse nach HGB. Die Anwendung bietet eine vollständige Lösung für die Konzernkonsolidierung mit Fokus auf HGB-Konformität und Prüfungssicherheit.

**Zielgruppe:**
Die Anwendung richtet sich an:
- Wirtschaftsprüfer (WP)
- Bilanzbuchhalter
- Konsolidierungsspezialisten
- Controller
- Geschäftsführung

**HGB-Konformität:**
Alle Funktionen sind vollständig auf die Anforderungen des Handelsgesetzbuchs (HGB) ausgerichtet. Die Anwendung unterstützt:
- Vollkonsolidierung nach HGB
- Erstkonsolidierung
- Minderheitenanteile
- Intercompany-Eliminierungen
- Konzernanhang nach HGB

**Systemanforderungen:**
- Moderne Browser (Chrome, Firefox, Edge, Safari)
- Internetverbindung
- JavaScript aktiviert

**Sicherheit:**
Alle Daten werden verschlüsselt übertragen und gespeichert. Die Anwendung erfüllt die Anforderungen der DSGVO.`,
        screenshot: 'screenshots/dashboard-overview.png'
      },
      {
        id: 'quick-start',
        title: 'Schnellstart',
        content: `Nach der Anmeldung sehen Sie das Dashboard mit einer Übersicht über Ihre Unternehmen und Jahresabschlüsse.

**Erste Schritte - Schritt für Schritt:**

**Schritt 1: Unternehmen anlegen**
1. Klicken Sie auf "Unternehmen" in der linken Navigation
2. Klicken Sie auf "Neues Unternehmen"
3. Füllen Sie die Pflichtfelder aus:
   - Name des Unternehmens (z.B. "Muster GmbH")
   - Rechtsform (GmbH, AG, etc.)
4. Speichern Sie das Unternehmen

**Schritt 2: Konzernstruktur aufbauen**
1. Legen Sie das Mutterunternehmen an (ohne Mutterunternehmen)
2. Legen Sie Tochterunternehmen an und wählen Sie das Mutterunternehmen als "Mutterunternehmen"
3. Die Hierarchie wird automatisch angezeigt

**Schritt 3: Jahresabschluss importieren**
1. Navigieren Sie zu "Datenimport"
2. Wählen Sie den Jahresabschluss aus
3. Laden Sie eine Excel-Datei hoch
4. Klicken Sie auf "Importieren"

**Schritt 4: Konsolidierung durchführen**
1. Navigieren Sie zu "Konsolidierung"
2. Wählen Sie den Jahresabschluss aus
3. Klicken Sie auf "Konsolidierung durchführen"

**Navigation verstehen:**
Die linke Seitenleiste ist in vier Hauptbereiche unterteilt:
- **Übersicht:** Dashboard und Unternehmensverwaltung
- **Konsolidierung:** Datenimport, Konsolidierung, Konzernabschluss
- **Berichte:** Konzernanhang, Konzernlagebericht, Prüfpfad
- **Qualität:** Kontrollen, Richtlinien, AI-Protokoll`,
        screenshot: 'screenshots/quick-start-navigation.png'
      },
      {
        id: 'concepts',
        title: 'Grundkonzepte',
        content: `**Konzernstruktur:**
Ein Konzern besteht aus einem Mutterunternehmen und einem oder mehreren Tochterunternehmen. Die Anwendung unterstützt mehrstufige Konzernstrukturen.

**Beispiel:**
- Mutterunternehmen: MU GmbH
  - Tochterunternehmen 1: TU1 GmbH (100% Beteiligung)
  - Tochterunternehmen 2: TU2 GmbH (75% Beteiligung)
    - Enkelunternehmen: EU GmbH (100% Beteiligung an TU2)

**Mutterunternehmen vs. Tochterunternehmen:**
- **Mutterunternehmen:** Das Unternehmen, das die Mehrheit der Anteile oder die Kontrolle über andere Unternehmen hält
- **Tochterunternehmen:** Unternehmen, die vom Mutterunternehmen beherrscht werden (mehr als 50% Beteiligung oder Beherrschungsverhältnis)

**Konsolidierungskreis:**
Der Konsolidierungskreis umfasst alle Unternehmen, die in den Konzernabschluss einbezogen werden müssen. Die Anwendung prüft automatisch die Konsolidierungspflicht nach HGB.

[WARNING: **Wichtig:** Die Konsolidierungspflicht muss für jedes Unternehmen einzeln geprüft werden. Bei Unklarheiten konsultieren Sie einen Wirtschaftsprüfer.]

**Konsolidierungspflicht nach HGB:**
Ein Unternehmen ist konsolidierungspflichtig, wenn:
- Das Mutterunternehmen mehr als 50% der Anteile hält, ODER
- Ein Beherrschungsverhältnis besteht, ODER
- Einheitliche Leitung vorliegt

[HGB: **HGB-Referenz:** Siehe § 290 HGB für die Definition der Konsolidierungspflicht.]

**Jahresabschlüsse im System:**
Für jedes Unternehmen können Sie Jahresabschlüsse anlegen und importieren. Diese bilden die Grundlage für die Konsolidierung.

**Datenherkunft und Prüfpfad:**
Alle Daten werden mit vollständiger Nachverfolgbarkeit gespeichert. Der Prüfpfad ermöglicht es Wirtschaftsprüfern, jeden Schritt nachzuvollziehen.`,
        screenshot: 'screenshots/company-hierarchy-example.png'
      }
    ]
  },
  {
    id: 'companies',
    title: 'Unternehmensverwaltung',
    subsections: [
      {
        id: 'create-company',
        title: 'Unternehmen anlegen',
        content: `Um ein neues Unternehmen anzulegen, navigieren Sie zu "Unternehmen" im Menü und klicken Sie auf "Neues Unternehmen".

**Pflichtfelder:**
- **Name:** Name des Unternehmens (z.B. "Muster GmbH")
- **Rechtsform:** Wählen Sie die Rechtsform aus:
  - GmbH (Gesellschaft mit beschränkter Haftung)
  - AG (Aktiengesellschaft)
  - KG (Kommanditgesellschaft)
  - OHG (Offene Handelsgesellschaft)
  - e.K. (eingetragener Kaufmann)
  - Sonstige

**Optionale Felder:**
- **Steuernummer:** Steuernummer des Unternehmens
- **Adresse:** Vollständige Adresse
- **Geschäftsführer:** Name des Geschäftsführers
- **Gründungsdatum:** Datum der Gründung
- **Handelsregisternummer:** HRB-Nummer

**Beispiel:**
Name: Muster GmbH
Rechtsform: GmbH
Steuernummer: DE123456789
Adresse: Musterstraße 1, 12345 Musterstadt
Geschäftsführer: Max Mustermann

**Hinweis:**
Wenn Sie ein Tochterunternehmen anlegen, wählen Sie das Mutterunternehmen im Feld "Mutterunternehmen" aus.`,
        screenshot: 'screenshots/create-company-form.png',
        example: 'Beispiel: Name: "TU1 GmbH", Rechtsform: "GmbH", Mutterunternehmen: "MU GmbH"'
      },
      {
        id: 'company-structure',
        title: 'Konzernstruktur aufbauen',
        content: `Die Konzernstruktur wird durch die Zuordnung von Tochterunternehmen zum Mutterunternehmen definiert.

**Schritt-für-Schritt Anleitung:**

**1. Mutterunternehmen anlegen:**
- Legen Sie zunächst das Mutterunternehmen an
- Lassen Sie das Feld "Mutterunternehmen" leer
- Beispiel: "MU GmbH"

**2. Tochterunternehmen zuordnen:**
- Legen Sie Tochterunternehmen an
- Wählen Sie das Mutterunternehmen im Feld "Mutterunternehmen"
- Beispiel: "TU1 GmbH" mit Mutterunternehmen "MU GmbH"

**Beteiligungsverhältnisse:**
Bei der Erstellung eines Tochterunternehmens können Sie das Beteiligungsverhältnis angeben. Dies ist wichtig für:
- Berechnung von Minderheitenanteilen
- Konsolidierungspflicht-Prüfung
- Goodwill-Berechnung bei Erstkonsolidierung

**Beispiel Beteiligungsverhältnisse:**
- MU GmbH hält 100% an TU1 GmbH → Vollkonsolidierung
- MU GmbH hält 75% an TU2 GmbH → Vollkonsolidierung mit 25% Minderheitenanteil
- MU GmbH hält 30% an TU3 GmbH → Keine Konsolidierung (nur Beteiligung)

**Mehrstufige Konzernstrukturen:**
Die Anwendung unterstützt mehrstufige Strukturen:
- Mutterunternehmen → Tochterunternehmen → Enkelunternehmen
- Beispiel:
  - MU GmbH (Mutter)
    - TU1 GmbH (Tochter, 100%)
      - EU GmbH (Enkel, 100% an TU1)

**Konsolidierungspflicht prüfen:**
Die Anwendung prüft automatisch die Konsolidierungspflicht basierend auf:
- Beteiligungsverhältnis
- Beherrschungsverhältnis
- HGB-Vorschriften`,
        screenshot: 'screenshots/company-hierarchy-tree.png',
        example: 'Beispiel-Konzernstruktur: MU GmbH → TU1 (100%), TU2 (75%) → EU (100%)'
      },
      {
        id: 'manage-companies',
        title: 'Unternehmen verwalten',
        content: `**Unternehmen bearbeiten:**
Klicken Sie auf "Bearbeiten" bei einem Unternehmen in der Liste, um die Daten zu ändern.

**Unternehmensdaten aktualisieren:**
- Änderungen an Name, Adresse, etc. sind jederzeit möglich
- Änderungen am Mutterunternehmen können Auswirkungen auf die Konsolidierung haben
- Die Anwendung warnt Sie vor kritischen Änderungen

**HGB-Prüfung durchführen:**
Die Funktion "HGB-Prüfung" prüft automatisch, ob das Unternehmen konsolidierungspflichtig ist.

**Prüfkriterien:**
- Beteiligungsverhältnis über 50%
- Beherrschungsverhältnis
- Einheitliche Leitung
- HGB-Vorschriften

**Ergebnis der Prüfung:**
- Konsolidierungspflichtig: Ja/Nein
- Begründung
- Empfehlungen

**Unternehmen löschen:**
Beim Löschen eines Unternehmens werden automatisch gelöscht:
- Alle zugehörigen Jahresabschlüsse
- Alle Konsolidierungsdaten
- Alle Verknüpfungen

[WARNING: **Wichtig:** Diese Aktion kann nicht rückgängig gemacht werden. Die Anwendung zeigt eine Bestätigungsabfrage. Stellen Sie sicher, dass Sie alle Daten gesichert haben, bevor Sie ein Unternehmen löschen.]

**Unternehmenshierarchie visualisieren:**
Die Anwendung zeigt die Unternehmenshierarchie als Baumstruktur an:
- Mutterunternehmen oben
- Tochterunternehmen darunter
- Einrückung zeigt die Hierarchieebene`,
        screenshot: 'screenshots/company-management-actions.png'
      }
    ]
  },
  {
    id: 'import',
    title: 'Datenimport',
    subsections: [
      {
        id: 'import-overview',
        title: 'Import-Überblick',
        content: `Die Anwendung unterstützt den Import von Jahresabschlussdaten aus Excel- und CSV-Dateien.

**Unterstützte Dateiformate:**
- Excel (.xlsx, .xls)
- CSV (.csv)

**Import-Modi:**

**1. Schnell-Import:**
Für standardisierte Dateien mit dem Format:
- Spalte 1: Kontonummer
- Spalte 2: Soll-Betrag
- Spalte 3: Haben-Betrag

**2. Import-Assistent:**
Geführter Prozess mit:
- Spaltenzuordnung
- Datenvalidierung
- Vorschau vor dem Import

**3. Multi-Unternehmen Import:**
Batch-Import für mehrere Gesellschaften in einer Datei

**Voraussetzungen für den Import:**
1. Jahresabschluss muss bereits angelegt sein
2. Datei muss dem erwarteten Format entsprechen
3. Template kann heruntergeladen werden

**Template-Download:**
Klicken Sie auf "Vorlage herunterladen", um eine Excel-Vorlage zu erhalten.`,
        screenshot: 'screenshots/import-overview.png'
      },
      {
        id: 'quick-import',
        title: 'Schnell-Import',
        content: `Der Schnell-Import eignet sich für Dateien im Standard-Format.

**Datei-Struktur:**
Die Excel-Datei muss folgende Spalten enthalten:
- **Spalte A:** Kontonummer (z.B. "1000", "2000")
- **Spalte B:** Soll-Betrag (z.B. "100000.00")
- **Spalte C:** Haben-Betrag (z.B. "50000.00")

**Beispiel-Datei:**
| Kontonummer | Soll | Haben |
|-------------|------|-------|
| 1000        | 100000 | 0     |
| 2000        | 0     | 50000 |
| 3000        | 50000 | 0     |

**Schritte für den Schnell-Import:**

1. **Jahresabschluss auswählen:**
   - Wählen Sie den Jahresabschluss aus dem Dropdown
   - Format: "Unternehmen - Jahr" (z.B. "MU - 2026")

2. **Dateityp wählen:**
   - Excel (.xlsx, .xls) oder CSV (.csv)

3. **Datei auswählen:**
   - Klicken Sie auf "Datei auswählen"
   - Wählen Sie Ihre Excel- oder CSV-Datei

4. **Importieren:**
   - Klicken Sie auf "Importieren"
   - Die Anwendung validiert die Daten
   - Bei Fehlern werden diese angezeigt

**Fehlerbehandlung:**
Bei Fehlern zeigt die Anwendung:
- Zeilennummer des Fehlers
- Fehlertyp
- Vorschlag zur Behebung

**Häufige Fehler:**
- Falsche Spaltenstruktur
- Ungültige Kontonummern
- Fehlende Beträge
- Formatierungsfehler

**Validierung der importierten Daten:**
Nach dem Import können Sie:
- Die importierten Daten prüfen
- Salden prüfen (Soll = Haben)
- Kontenstruktur validieren`,
        screenshot: 'screenshots/quick-import-example.png',
        example: 'Beispiel-Excel-Datei: Spalte A = Kontonummer, Spalte B = Soll, Spalte C = Haben'
      },
      {
        id: 'import-wizard',
        title: 'Import-Assistent',
        content: `Der Import-Assistent führt Sie Schritt für Schritt durch den Import-Prozess.

**Vorteile:**
- Flexible Spaltenzuordnung
- Vorschau vor dem Import
- Validierung während des Imports
- Fehlerkorrektur vor dem finalen Import

**Schritt-für-Schritt Anleitung:**

**Schritt 1: Datei auswählen**
- Wählen Sie Ihre Excel- oder CSV-Datei
- Die Anwendung analysiert die Datei automatisch

**Schritt 2: Spalten zuordnen**
- Die Anwendung erkennt automatisch mögliche Spalten
- Sie können die Zuordnung anpassen:
  - Kontonummer-Spalte
  - Soll-Spalte
  - Haben-Spalte
  - Optional: Bezeichnung, Text

**Schritt 3: Vorschau prüfen**
- Die Anwendung zeigt eine Vorschau der zu importierenden Daten
- Prüfen Sie:
  - Kontonummern
  - Beträge
  - Formatierung

**Schritt 4: Validierung durchführen**
- Die Anwendung prüft:
  - Salden (Soll = Haben)
  - Kontonummern-Format
  - Beträge-Format
- Fehler werden angezeigt

**Schritt 5: Import bestätigen**
- Prüfen Sie die Validierungsergebnisse
- Klicken Sie auf "Importieren"`,
        screenshot: 'screenshots/import-wizard-steps.png'
      },
      {
        id: 'multi-company-import',
        title: 'Multi-Unternehmen Import',
        content: `Der Multi-Unternehmen Import ermöglicht den Batch-Import mehrerer Gesellschaften in einem Vorgang.

**Anwendungsfall:**
Sie haben eine Excel-Datei mit Jahresabschlüssen mehrerer Tochterunternehmen.

**Datei-Struktur:**
Die Datei sollte folgende Struktur haben:
- Ein Blatt pro Unternehmen, ODER
- Eine Spalte mit Unternehmensname

**Beispiel-Struktur:**
| Unternehmen | Kontonummer | Soll | Haben |
|-------------|-------------|------|-------|
| TU1         | 1000        | 100000 | 0     |
| TU1         | 2000        | 0     | 50000 |
| TU2         | 1000        | 50000 | 0     |
| TU2         | 2000        | 0     | 25000 |

**Automatische Zuordnung:**
Die Anwendung ordnet automatisch zu:
- Unternehmen basierend auf Name oder Spalte
- Jahresabschlüsse werden automatisch erstellt, falls nicht vorhanden

**Fehlerbehandlung bei Batch-Imports:**
- Fehler werden pro Unternehmen angezeigt
- Erfolgreiche Imports werden durchgeführt
- Fehlgeschlagene können einzeln wiederholt werden`,
        screenshot: 'screenshots/multi-company-import.png'
      },
      {
        id: 'template',
        title: 'Import-Templates',
        content: `Um sicherzustellen, dass Ihre Dateien korrekt importiert werden, können Sie ein Template herunterladen.

**Template herunterladen:**
1. Navigieren Sie zu "Datenimport"
2. Klicken Sie auf "Vorlage herunterladen"
3. Öffnen Sie die heruntergeladene Excel-Datei

**Template-Struktur:**
Das Template enthält:
- Beispielzeilen mit korrekter Formatierung
- Formatierungsvorgaben
- Erklärungen zu den Spalten
- Hinweise zu Pflichtfeldern

**Beispiel-Template:**
| Kontonummer | Soll | Haben | Bezeichnung |
|-------------|------|-------|-------------|
| 1000        | 100000.00 | 0.00 | Kasse |
| 2000        | 0.00 | 50000.00 | Verbindlichkeiten |

**Template anpassen:**
- Behalten Sie die Spaltenstruktur bei
- Füllen Sie Ihre Daten ein
- Entfernen Sie Beispielzeilen

**Best Practices:**
- Verwenden Sie das Template als Vorlage
- Behalten Sie die Spaltenstruktur bei
- Verwenden Sie keine Formeln, nur Werte
- Verwenden Sie Punkt als Dezimaltrennzeichen
- Keine Tausender-Trennzeichen`,
        screenshot: 'screenshots/import-template.png',
        example: 'Template-Download: Excel-Datei mit vordefinierten Spalten und Beispielwerten'
      }
    ]
  },
  {
    id: 'consolidation',
    title: 'Konsolidierung',
    subsections: [
      {
        id: 'consolidation-circle',
        title: 'Konsolidierungskreis',
        tldr: 'Der Konsolidierungskreis umfasst alle konsolidierungspflichtigen Unternehmen. Die Anwendung prüft automatisch die Konsolidierungspflicht nach HGB.',
        lastUpdated: '2026-01-10',
        relatedSections: ['first-consolidation', 'consolidation-wizard'],
        contentType: 'concept',
        useCases: [
          {
            role: 'wp',
            description: 'Als Wirtschaftsprüfer prüfen Sie, ob alle konsolidierungspflichtigen Unternehmen korrekt identifiziert wurden.'
          },
          {
            role: 'controller',
            description: 'Als Controller stellen Sie sicher, dass der Konsolidierungskreis vollständig ist und alle relevanten Unternehmen erfasst wurden.'
          }
        ],
        content: `Der Konsolidierungskreis definiert, welche Unternehmen in den Konzernabschluss einbezogen werden.

**Konsolidierungskreis definieren:**
1. Navigieren Sie zu "Konsolidierungskreis" im Menü
2. Die Anwendung zeigt alle Unternehmen an
3. Für jedes Unternehmen wird die Konsolidierungspflicht angezeigt
4. Unternehmen werden automatisch zum Kreis hinzugefügt, wenn sie konsolidierungspflichtig sind

**Automatische Prüfung:**
Die Anwendung prüft automatisch die Konsolidierungspflicht nach HGB-Kriterien:

**Prüfkriterien:**
- Beteiligungsverhältnis über 50%
- Beherrschungsverhältnis (tatsächliche Kontrolle)
- Einheitliche Leitung
- HGB-Vorschriften (z.B. § 290 HGB)

**Ergebnis der Prüfung:**
- Konsolidierungspflichtig: Ja/Nein
- Begründung
- Empfehlungen

**Warnungen und Hinweise:**
Die Anwendung zeigt Warnungen an bei:
- Unternehmen mit unklarer Konsolidierungspflicht
- Änderungen der Beteiligungsverhältnisse
- Fehlenden Daten für die Prüfung

**Beispiel:**
- MU GmbH hält 100% an TU1 GmbH → Konsolidierungspflichtig
- MU GmbH hält 75% an TU2 GmbH → Konsolidierungspflichtig (mit Minderheitenanteil)
- MU GmbH hält 30% an TU3 GmbH → Nicht konsolidierungspflichtig`,
        screenshot: 'screenshots/consolidation-circle-check.png',
        example: 'Beispiel: MU GmbH → TU1 (100%, konsolidierungspflichtig), TU2 (75%, konsolidierungspflichtig)'
      },
      {
        id: 'consolidation-wizard',
        title: 'Konsolidierungs-Assistent',
        content: `Der Konsolidierungs-Assistent führt Sie Schritt für Schritt durch den Konsolidierungsprozess.

**Geführter Konsolidierungsprozess:**

**Schritt 1: Jahresabschluss auswählen**
- Wählen Sie den zu konsolidierenden Jahresabschluss aus
- Format: "Unternehmen - Jahr" (z.B. "MU - 2026")

**Schritt 2: Automatische Erkennung**
Die Anwendung erkennt automatisch:
- Intercompany-Verrechnungen (IC)
- Kapitalkonsolidierung
- Schuldenkonsolidierung
- Beteiligungen

**Schritt 3: Konsolidierungsposten prüfen**
- Prüfen Sie die automatisch erkannten Posten
- Jeder Posten zeigt:
  - Art der Konsolidierung
  - Betrag
  - Beteiligte Unternehmen
  - Status

**Schritt 4: Manuelle Anpassungen**
Fügen Sie manuelle Konsolidierungsposten hinzu, falls erforderlich:
- Klicken Sie auf "Manueller Posten"
- Wählen Sie die Art der Konsolidierung
- Geben Sie die Details ein

**Schritt 5: Konsolidierung durchführen**
- Klicken Sie auf "Konsolidierung durchführen"
- Die Anwendung führt alle Konsolidierungsschritte aus
- Ergebnisse werden angezeigt`,
        screenshot: 'screenshots/consolidation-wizard-steps.png'
      },
      {
        id: 'first-consolidation',
        title: 'Erstkonsolidierung',
        tldr: 'Bei der erstmaligen Konsolidierung werden Buchwert, Zeitwert und Kaufpreis verglichen, um Goodwill und Minderheitenanteile zu berechnen.',
        lastUpdated: '2026-01-15',
        relatedSections: ['consolidation-circle', 'minority-interests', 'consolidation-entries'],
        contentType: 'workflow',
        useCases: [
          {
            role: 'wp',
            description: 'Als Wirtschaftsprüfer prüfen Sie die Bewertung der Vermögensgegenstände und Schulden zum Erwerbszeitpunkt sowie die Goodwill-Berechnung.'
          },
          {
            role: 'buchhalter',
            description: 'Als Bilanzbuchhalter führen Sie die Erstkonsolidierung durch, indem Sie die erforderlichen Daten eingeben und die Berechnungen prüfen.'
          }
        ],
        content: `Bei der erstmaligen Konsolidierung einer Tochtergesellschaft müssen bestimmte Schritte beachtet werden.

**Erstkonsolidierung durchführen:**

1. Navigieren Sie zu "Konsolidierung"
2. Wählen Sie den Tab "Erstkonsolidierung"
3. Wählen Sie die Tochtergesellschaft aus
4. Geben Sie die notwendigen Daten ein:

**Erforderliche Daten:**
- **Buchwert der Beteiligung:** Wert der Beteiligung in der Bilanz des Mutterunternehmens
- **Zeitwert der Vermögensgegenstände:** Zeitwert zum Erwerbszeitpunkt
- **Zeitwert der Schulden:** Zeitwert zum Erwerbszeitpunkt
- **Kaufpreis:** Tatsächlich gezahlter Kaufpreis

**Automatische Berechnungen:**
Die Anwendung berechnet automatisch:

**Goodwill:**
Goodwill = Kaufpreis - Anteiliger Zeitwert des Eigenkapitals

**Beispiel:**
- Kaufpreis: 1.000.000 EUR
- Zeitwert Eigenkapital: 800.000 EUR
- Beteiligung: 100%
- Goodwill: 1.000.000 - 800.000 = 200.000 EUR

**Minderheitenanteile bei Erstkonsolidierung:**
Wenn die Beteiligung weniger als 100% beträgt:
- Minderheitenanteil = (1 - Beteiligungsquote) × Zeitwert Eigenkapital

**Buchwert vs. Zeitwert:**
- **Buchwert:** Wert in der Bilanz des Mutterunternehmens
- **Zeitwert:** Fair Value zum Erwerbszeitpunkt (HGB-konform)`,
        screenshot: 'screenshots/first-consolidation-form.png',
        example: 'Beispiel: Kaufpreis 1.000.000 EUR, Zeitwert 800.000 EUR → Goodwill 200.000 EUR'
      },
      {
        id: 'consolidation-entries',
        title: 'Konsolidierungsposten',
        content: `Konsolidierungsposten sind Buchungen, die bei der Konsolidierung notwendig sind.

**Automatische Konsolidierungsposten:**
Die Anwendung erstellt automatisch Posten für:
- Intercompany-Verrechnungen (IC)
- Kapitalkonsolidierung
- Schuldenkonsolidierung
- Beteiligungen

**Manuelle Konsolidierungsposten anlegen:**
1. Navigieren Sie zu "Konsolidierung"
2. Klicken Sie auf "Manueller Posten"
3. Wählen Sie die Art:
   - IC-Verrechnung
   - Kapitalkonsolidierung
   - Schuldenkonsolidierung
   - Sonstiger Posten
4. Geben Sie die Details ein:
   - Soll-Konto
   - Haben-Konto
   - Betrag
   - Beschreibung

**Intercompany-Verrechnungen (IC):**
IC-Verrechnungen müssen eliminiert werden:
- Forderungen gegen verbundene Unternehmen
- Verbindlichkeiten gegenüber verbundenen Unternehmen
- Lieferungen und Leistungen zwischen Unternehmen

**Schuldenkonsolidierung:**
Eliminierung von:
- Forderungen zwischen Unternehmen
- Verbindlichkeiten zwischen Unternehmen

**Kapitalkonsolidierung:**
Eliminierung des Beteiligungsbuchwerts gegen das Eigenkapital der Tochtergesellschaft`,
        screenshot: 'screenshots/consolidation-entries-list.png'
      },
      {
        id: 'ic-reconciliation',
        title: 'Intercompany-Verrechnungen (IC)',
        tldr: 'IC-Verrechnungen zwischen Konzernunternehmen müssen eliminiert werden. Die Anwendung erkennt automatisch IC-Differenzen und unterstützt den Abgleich.',
        lastUpdated: '2026-01-12',
        relatedSections: ['consolidation-entries', 'perform-consolidation'],
        contentType: 'workflow',
        useCases: [
          {
            role: 'buchhalter',
            description: 'Als Bilanzbuchhalter führen Sie den IC-Abgleich durch, identifizieren Differenzen und beheben diese vor der Konsolidierung.'
          },
          {
            role: 'wp',
            description: 'Als Wirtschaftsprüfer prüfen Sie die IC-Eliminierungen und verifizieren, dass alle IC-Posten korrekt abgeglichen wurden.'
          }
        ],
        content: `Intercompany-Verrechnungen müssen bei der Konsolidierung eliminiert werden.

**IC-Differenzen erkennen:**
Die Anwendung erkennt automatisch IC-Differenzen zwischen Unternehmen.

**IC-Differenzen analysieren:**
1. Navigieren Sie zu "Konsolidierung"
2. Wählen Sie den Tab "IC-Abgleich"
3. Die Anwendung zeigt alle IC-Differenzen an:
   - Forderungen/Verbindlichkeiten
   - Betrag bei Unternehmen A
   - Betrag bei Unternehmen B
   - Differenz

**IC-Abgleich durchführen:**
1. Prüfen Sie die Differenzen
2. Identifizieren Sie die Ursache:
   - Timing-Unterschiede
   - Buchungsfehler
   - Währungsumrechnungen
3. Führen Sie den Abgleich durch:
   - Automatisches Matching
   - Manuelles Matching

**IC-Reconciliation:**
Die IC-Reconciliation zeigt:
- Alle IC-Posten
- Matching-Status
- Offene Differenzen
- Abgleich-Historie

**IC-Matching:**
Die Anwendung unterstützt automatisches Matching:
- Nach Betrag
- Nach Gegenpartei
- Nach Buchungsdatum

Sie können auch manuell matchen, wenn automatisches Matching nicht möglich ist.

**IC-Dokumentation:**
Alle IC-Abgleiche werden dokumentiert für:
- Prüfung
- Nachvollziehbarkeit
- Audit Trail`,
        screenshot: 'screenshots/ic-reconciliation-dashboard.png',
        example: 'Beispiel: TU1 zeigt Forderung 10.000 EUR gegen TU2, TU2 zeigt Verbindlichkeit 9.500 EUR → Differenz 500 EUR'
      },
      {
        id: 'minority-interests',
        title: 'Minderheitenanteile',
        content: `Minderheitenanteile entstehen, wenn das Mutterunternehmen weniger als 100% der Anteile hält.

**Minderheitenanteile berechnen:**
Die Anwendung berechnet automatisch:
- Minderheitenanteil am Eigenkapital
- Minderheitenanteil am Ergebnis

**Formel:**
Minderheitenanteil = (1 - Beteiligungsquote) × Eigenkapital/Ergebnis

**Beispiel:**
- Beteiligung: 75%
- Eigenkapital Tochtergesellschaft: 1.000.000 EUR
- Minderheitenanteil: (1 - 0,75) × 1.000.000 = 250.000 EUR

**Minderheitenanteile im Konzernabschluss:**
Minderheitenanteile erscheinen in:
- Konzernbilanz: Unter "Eigenkapital"
- Konzern-GuV: Als separate Position

**Minderheitenanteile-Dashboard:**
Das Dashboard zeigt:
- Minderheitenanteil pro Tochtergesellschaft
- Entwicklung über die Zeit
- Änderungen der Beteiligungsverhältnisse

**Änderungen der Beteiligungsverhältnisse:**
Wenn sich die Beteiligung ändert:
- Die Anwendung berechnet den neuen Minderheitenanteil
- Historische Werte bleiben erhalten
- Änderungen werden dokumentiert`,
        screenshot: 'screenshots/minority-interests-dashboard.png',
        example: 'Beispiel: 75% Beteiligung → 25% Minderheitenanteil am Eigenkapital von 1.000.000 EUR = 250.000 EUR'
      },
      {
        id: 'perform-consolidation',
        title: 'Konsolidierung durchführen',
        content: `**Konsolidierung starten:**
1. Navigieren Sie zu "Konsolidierung"
2. Wählen Sie den Jahresabschluss aus
3. Prüfen Sie alle Konsolidierungsposten
4. Klicken Sie auf "Konsolidierung durchführen"

**Konsolidierungsergebnisse prüfen:**
Nach der Konsolidierung zeigt die Anwendung:
- Konsolidierte Bilanz
- Konsolidierte GuV
- Konsolidierungsposten im Detail
- Validierungsergebnisse

**Konsolidierungsposten bearbeiten:**
Sie können Konsolidierungsposten bearbeiten:
- Status ändern (Entwurf, Übermittelt, Genehmigt)
- Beträge anpassen
- Beschreibungen ändern

**Konsolidierung genehmigen:**
1. Prüfen Sie alle Konsolidierungsposten
2. Klicken Sie auf "Genehmigen"
3. Die Konsolidierung wird finalisiert

**Konsolidierung ablehnen:**
Wenn Fehler gefunden werden:
1. Klicken Sie auf "Ablehnen"
2. Geben Sie einen Grund an
3. Die Konsolidierung bleibt als Entwurf

**Konsolidierung rückgängig machen:**
Sie können eine Konsolidierung rückgängig machen:
- Nur wenn noch nicht genehmigt
- Alle Konsolidierungsposten werden gelöscht
- Originaldaten bleiben erhalten`,
        screenshot: 'screenshots/perform-consolidation-button.png'
      }
    ]
  },
  {
    id: 'consolidated-statement',
    title: 'Konzernabschluss',
    subsections: [
      {
        id: 'statement-overview',
        title: 'Konzernabschluss-Übersicht',
        content: `Der Konzernabschluss zeigt die konsolidierte Bilanz und GuV.

**Konsolidierte Bilanz:**
Die konsolidierte Bilanz enthält:
- Alle Vermögensgegenstände (konsolidiert)
- Alle Schulden (konsolidiert)
- Eigenkapital (inkl. Minderheitenanteile)
- Konsolidierungseffekte sind bereits berücksichtigt

**Konsolidierte Gewinn- und Verlustrechnung:**
Die konsolidierte GuV enthält:
- Alle Erträge (konsolidiert)
- Alle Aufwendungen (konsolidiert)
- Ergebnis (inkl. Minderheitenanteile)

**Vergleichsansichten:**
Sie können verschiedene Ansichten wählen:
- Aktuelles Jahr
- Vorjahr
- Vergleich beider Jahre

**Periodenvergleiche:**
Die Anwendung ermöglicht:
- Vergleich mit Vorjahr
- Entwicklung über mehrere Jahre
- Abweichungsanalyse`,
        screenshot: 'screenshots/consolidated-statement-overview.png'
      },
      {
        id: 'consolidated-balance-sheet',
        title: 'Konsolidierte Bilanz',
        content: `**Bilanzstruktur:**
Die konsolidierte Bilanz folgt der HGB-Struktur:

**Aktiva:**
- Anlagevermögen
- Umlaufvermögen
- Rechnungsabgrenzungsposten

**Passiva:**
- Eigenkapital (inkl. Minderheitenanteile)
- Rückstellungen
- Verbindlichkeiten
- Rechnungsabgrenzungsposten

**Positionen im Detail:**
Klicken Sie auf eine Position, um Details zu sehen:
- Ursprung (welches Unternehmen)
- Konsolidierungseffekte
- Änderungen gegenüber Vorjahr

**Konsolidierungseffekte nachvollziehen:**
Für jede Position können Sie sehen:
- Einzelabschlüsse der Unternehmen
- Konsolidierungsposten
- Konsolidiertes Ergebnis

**Bilanz validieren:**
Die Anwendung prüft automatisch:
- Bilanzsumme Aktiva = Bilanzsumme Passiva
- Konsolidierungseffekte korrekt
- Minderheitenanteile korrekt`,
        screenshot: 'screenshots/consolidated-balance-sheet-detail.png'
      },
      {
        id: 'consolidated-income-statement',
        title: 'Konsolidierte GuV',
        content: `**GuV-Struktur:**
Die konsolidierte GuV folgt der HGB-Struktur:

**Erträge:**
- Umsatzerlöse
- Sonstige Erträge
- Zinserträge

**Aufwendungen:**
- Materialaufwand
- Personalaufwand
- Abschreibungen
- Zinsaufwand

**Ergebnis:**
- Ergebnis vor Steuern
- Steuern
- Ergebnis nach Steuern
- Minderheitenanteile
- Konzernergebnis

**Positionen im Detail:**
Klicken Sie auf eine Position für Details:
- Einzelabschlüsse
- Konsolidierungseffekte
- Änderungen

**Konsolidierungseffekte nachvollziehen:**
Sie können sehen:
- IC-Umsätze (eliminiert)
- IC-Kosten (eliminiert)
- Sonstige Konsolidierungseffekte

**GuV validieren:**
Die Anwendung prüft:
- Saldo der GuV
- Konsolidierungseffekte korrekt
- Minderheitenanteile korrekt`,
        screenshot: 'screenshots/consolidated-income-statement.png'
      },
      {
        id: 'consolidation-report',
        title: 'Konsolidierungsbericht',
        content: `**Automatischer Konsolidierungsbericht:**
Die Anwendung erstellt automatisch einen Bericht mit:
- Alle Konsolidierungsposten
- Details zu jeder Konsolidierung
- Beteiligte Unternehmen
- Beträge

**Konsolidierungsposten im Detail:**
Jeder Posten zeigt:
- Art der Konsolidierung
- Soll-Konto
- Haben-Konto
- Betrag
- Beteiligte Unternehmen
- Status
- Erstellt von
- Erstellt am

**Positionen analysieren:**
Sie können analysieren:
- Welche Positionen wurden konsolidiert
- Welche Effekte hatten die Konsolidierungen
- Vergleich mit Vorjahr

**Export-Funktionen:**
Sie können exportieren:
- Excel-Format
- CSV-Format
- PDF (geplant)`,
        screenshot: 'screenshots/consolidation-report.png'
      }
    ]
  },
  {
    id: 'fiscal-year-adjustment',
    title: 'Stichtagsverschiebung',
    subsections: [
      {
        id: 'fiscal-year-basics',
        title: 'Grundlagen',
        content: `**Was ist Stichtagsverschiebung?**
Stichtagsverschiebung ist notwendig, wenn Unternehmen unterschiedliche Geschäftsjahre haben.

**Beispiel:**
- Mutterunternehmen: Geschäftsjahr 01.01. - 31.12.
- Tochterunternehmen: Geschäftsjahr 01.04. - 31.03.

**Wann ist Stichtagsverschiebung erforderlich?**
Nach HGB müssen alle Unternehmen auf den Stichtag des Mutterunternehmens umgestellt werden.

**HGB-Anforderungen:**
- § 299 HGB: Einheitlicher Abschlussstichtag
- Abweichungen bis zu 3 Monate sind zulässig
- Bei größeren Abweichungen: Stichtagsverschiebung erforderlich

**Pro-rata-Berechnung:**
Bei Stichtagsverschiebung werden Positionen pro-rata berechnet:
- Beispiel: 3 Monate Verschiebung = 25% des Jahres`,
        screenshot: 'screenshots/fiscal-year-adjustment-overview.png'
      },
      {
        id: 'perform-fiscal-year-adjustment',
        title: 'Stichtagsverschiebung durchführen',
        content: `**Unternehmen identifizieren:**
1. Navigieren Sie zu "Stichtagsverschiebung"
2. Die Anwendung zeigt alle Unternehmen mit unterschiedlichen Geschäftsjahren

**Stichtagsverschiebung anlegen:**
1. Wählen Sie das Unternehmen aus
2. Geben Sie die Daten ein:
   - Originaler Abschlussstichtag
   - Neuer Abschlussstichtag (Stichtag des Mutterunternehmens)
   - Verschiebungszeitraum

**Pro-rata-Berechnung:**
Die Anwendung berechnet automatisch:
- Pro-rata-Anteil für jeden Posten
- Anpassungen für den Verschiebungszeitraum

**Beispiel:**
- Original: 31.03.2026
- Neu: 31.12.2026
- Verschiebung: 9 Monate
- Pro-rata: 75% (9/12 Monate)

**Stichtagsverschiebung validieren:**
Die Anwendung prüft:
- Korrekte Berechnung
- Vollständigkeit der Anpassungen
- HGB-Konformität

**Stichtagsverschiebung genehmigen:**
Nach der Validierung können Sie genehmigen`,
        screenshot: 'screenshots/fiscal-year-adjustment-form.png',
        example: 'Beispiel: 31.03. → 31.12. = 9 Monate Verschiebung, 75% pro-rata'
      },
      {
        id: 'manage-fiscal-year-adjustment',
        title: 'Stichtagsverschiebung verwalten',
        content: `**Stichtagsverschiebungen anzeigen:**
Alle Stichtagsverschiebungen werden in einer Liste angezeigt:
- Unternehmen
- Originaler Stichtag
- Neuer Stichtag
- Status

**Stichtagsverschiebung bearbeiten:**
Sie können bearbeiten:
- Nur wenn noch nicht genehmigt
- Anpassungen an den Berechnungen
- Kommentare hinzufügen

**Stichtagsverschiebung löschen:**
Löschen ist nur möglich:
- Wenn noch nicht genehmigt
- Mit Bestätigung

**Historie der Stichtagsverschiebungen:**
Die Anwendung speichert:
- Alle durchgeführten Verschiebungen
- Änderungen
- Genehmigungen`,
        screenshot: 'screenshots/fiscal-year-adjustment-list.png'
      }
    ]
  },
  {
    id: 'currency-translation',
    title: 'Währungsumrechnung',
    subsections: [
      {
        id: 'currency-basics',
        title: 'Grundlagen',
        content: `**Währungsumrechnung im Konzern:**
Wenn Tochterunternehmen in anderen Währungen bilanzieren, müssen diese umgerechnet werden.

**Wechselkurse:**
Für die Umrechnung werden Wechselkurse benötigt:
- Stichtagskurs (für Bilanzpositionen)
- Durchschnittskurs (für GuV-Positionen)
- Historische Kurse (für Anlagevermögen)

**Umrechnungsmethoden:**

**Stichtagskurs:**
- Verwendet für: Bilanzpositionen
- Kurs zum Bilanzstichtag
- Beispiel: 31.12.2026: 1 EUR = 1,10 USD

**Durchschnittskurs:**
- Verwendet für: GuV-Positionen
- Durchschnitt über das Geschäftsjahr
- Beispiel: Durchschnitt 2026: 1 EUR = 1,08 USD

**Historischer Kurs:**
- Verwendet für: Anlagevermögen
- Kurs zum Erwerbszeitpunkt`,
        screenshot: 'screenshots/currency-translation-overview.png'
      },
      {
        id: 'manage-exchange-rates',
        title: 'Wechselkurse verwalten',
        content: `**Wechselkurse anlegen:**
1. Navigieren Sie zu "Währungsumrechnung"
2. Klicken Sie auf "Wechselkurs anlegen"
3. Geben Sie ein:
   - Währungspaar (z.B. USD/EUR)
   - Datum
   - Kurs
   - Kurstyp (Stichtag, Durchschnitt, Historisch)

**Wechselkurse importieren:**
Sie können Wechselkurse aus Excel importieren:
- Format: Datum, Währung, Kurs
- Bulk-Import möglich

**Wechselkurse aus externen Quellen abrufen:**
Die Anwendung kann Wechselkurse abrufen von:
- Europäische Zentralbank (ECB)
- Weitere Quellen (geplant)

**Wechselkurs-Schedule:**
Erstellen Sie einen Schedule für:
- Regelmäßige Aktualisierung
- Automatische Kursabfrage

**Historische Wechselkurse:**
Die Anwendung speichert:
- Alle historischen Kurse
- Änderungen
- Verwendete Kurse für Umrechnungen`,
        screenshot: 'screenshots/exchange-rates-management.png',
        example: 'Beispiel: USD/EUR, 31.12.2026, 1,10, Stichtagskurs'
      },
      {
        id: 'perform-currency-translation',
        title: 'Währungsumrechnung durchführen',
        content: `**Währungsumrechnung berechnen:**
1. Navigieren Sie zu "Währungsumrechnung"
2. Wählen Sie das Unternehmen aus
3. Wählen Sie die Zielwährung (meist EUR)
4. Die Anwendung verwendet:
   - Stichtagskurs für Bilanz
   - Durchschnittskurs für GuV
   - Historische Kurse für Anlagevermögen

**Umrechnungsdifferenzen:**
Umrechnungsdifferenzen entstehen durch:
- Kursänderungen
- Unterschiedliche Kurse für Bilanz und GuV

**Translation Differences:**
Translation Differences sind:
- Differenzen aus Währungsumrechnung
- Erscheinen im Eigenkapital
- Werden im Konzernanhang ausgewiesen

**Währungsumrechnung validieren:**
Die Anwendung prüft:
- Alle Positionen umgerechnet
- Korrekte Kurse verwendet
- Umrechnungsdifferenzen korrekt`,
        screenshot: 'screenshots/currency-translation-calculation.png',
        example: 'Beispiel: USD 100.000 × 1,10 = EUR 110.000'
      },
      {
        id: 'manage-currency-translation',
        title: 'Währungsumrechnung verwalten',
        content: `**Umrechnungsdifferenzen anzeigen:**
Die Anwendung zeigt alle Umrechnungsdifferenzen:
- Betrag
- Ursache
- Beteiligte Positionen

**Umrechnungsdifferenzen nachvollziehen:**
Sie können nachvollziehen:
- Welche Kurse verwendet wurden
- Wie die Differenz entstanden ist
- Entwicklung über die Zeit

**Währungsumrechnung exportieren:**
Exportieren Sie:
- Umrechnungsdetails
- Verwendete Kurse
- Umrechnungsdifferenzen`,
        screenshot: 'screenshots/translation-differences.png'
      }
    ]
  },
  {
    id: 'konzernanhang',
    title: 'Konzernanhang',
    subsections: [
      {
        id: 'konzernanhang-overview',
        title: 'Konzernanhang-Überblick',
        content: `**Was ist der Konzernanhang?**
Der Konzernanhang ist Teil des Konzernabschlusses und enthält ergänzende Angaben.

**HGB-Anforderungen:**
Nach HGB muss der Konzernanhang enthalten:
- Angaben zur Konzernstruktur
- Bilanzierungs- und Bewertungsmethoden
- Angaben zu Beteiligungen
- Angaben zu Verbindlichkeiten
- Sonstige Angaben

**Automatische Generierung:**
Die Anwendung generiert automatisch:
- Standard-Abschnitte nach HGB
- Angaben aus den Konsolidierungsdaten
- Strukturierte Darstellung

**Zugriff:**
Navigieren Sie zu "Konzernanhang" im Menü unter "Berichte".`,
        screenshot: 'screenshots/konzernanhang-overview.png'
      },
      {
        id: 'generate-konzernanhang',
        title: 'Konzernanhang generieren',
        content: `**Konzernanhang erstellen:**
1. Navigieren Sie zu "Konzernanhang"
2. Wählen Sie den Jahresabschluss aus
3. Klicken Sie auf "Konzernanhang generieren"

**Automatische Abschnitte:**
Die Anwendung erstellt automatisch:
- Angaben zur Konzernstruktur
- Bilanzierungs- und Bewertungsmethoden
- Angaben zu Beteiligungen
- Angaben zu Verbindlichkeiten
- Angaben zu Rückstellungen
- Angaben zu sonstigen Verbindlichkeiten

**Manuelle Abschnitte hinzufügen:**
Sie können zusätzliche Abschnitte hinzufügen:
- Klicken Sie auf "Abschnitt hinzufügen"
- Wählen Sie den Abschnittstyp
- Geben Sie den Inhalt ein

**Abschnitte bearbeiten:**
Alle Abschnitte können bearbeitet werden:
- Inhalte anpassen
- Formatierung
- Reihenfolge ändern`,
        screenshot: 'screenshots/generate-konzernanhang.png'
      },
      {
        id: 'konzernanhang-sections',
        title: 'Konzernanhang-Abschnitte',
        content: `**Standard-Abschnitte:**
Die Anwendung bietet Standard-Abschnitte nach HGB:

1. **Angaben zur Konzernstruktur:**
   - Liste der einbezogenen Unternehmen
   - Beteiligungsverhältnisse
   - Konsolidierungskreis

2. **Bilanzierungs- und Bewertungsmethoden:**
   - Angewandte Bilanzierungsmethoden
   - Bewertungsmethoden
   - Abweichungen vom Einzelabschluss

3. **Angaben zu Beteiligungen:**
   - Beteiligungen im Einzelnen
   - Buchwert
   - Zeitwert

4. **Angaben zu Verbindlichkeiten:**
   - Fälligkeitsstruktur
   - Sicherheiten

**Anpassbare Abschnitte:**
Sie können Abschnitte anpassen:
- Inhalte ändern
- Abschnitte hinzufügen
- Abschnitte entfernen

**Abschnitte strukturieren:**
Die Abschnitte können strukturiert werden:
- Hauptabschnitte
- Unterabschnitte
- Nummerierung

**Abschnitte dokumentieren:**
Jeder Abschnitt kann dokumentiert werden:
- Kommentare
- Quellen
- Verantwortlichkeiten`,
        screenshot: 'screenshots/konzernanhang-sections.png'
      },
      {
        id: 'manage-konzernanhang',
        title: 'Konzernanhang verwalten',
        content: `**Konzernanhang bearbeiten:**
Sie können den gesamten Konzernanhang bearbeiten:
- Abschnitte ändern
- Inhalte anpassen
- Formatierung

**Abschnitte reviewen:**
Vor der Genehmigung sollten alle Abschnitte reviewt werden:
- Inhalt prüfen
- Vollständigkeit prüfen
- HGB-Konformität prüfen

**Konzernanhang genehmigen:**
Nach dem Review:
1. Klicken Sie auf "Genehmigen"
2. Der Konzernanhang wird finalisiert
3. Änderungen sind nur noch mit Genehmigung möglich

**Konzernanhang exportieren:**
Sie können exportieren in verschiedenen Formaten:
- **JSON:** Strukturierte Daten
- **Text:** Plain Text Format
- **HTML:** Für Web-Anzeige
- **Markdown:** Für Dokumentation`,
        screenshot: 'screenshots/konzernanhang-export.png'
      }
    ]
  },
  {
    id: 'management-report',
    title: 'Konzernlagebericht',
    subsections: [
      {
        id: 'management-report-overview',
        title: 'Konzernlagebericht-Überblick',
        content: `**Was ist der Konzernlagebericht?**
Der Konzernlagebericht ist Teil des Konzernabschlusses und beschreibt die Lage des Konzerns.

**HGB-Anforderungen:**
Nach HGB muss der Konzernlagebericht enthalten:
- Geschäftsverlauf
- Lage des Konzerns
- Zukunftsaussichten
- Risiken
- Chancen

**Struktur des Lageberichts:**
Die Anwendung bietet eine strukturierte Vorlage:
- Einleitung
- Geschäftsverlauf
- Lage des Konzerns
- Zukunftsaussichten
- Risiken und Chancen

**Zugriff:**
Navigieren Sie zu "Konzernlagebericht" im Menü unter "Berichte".`,
        screenshot: 'screenshots/management-report-overview.png'
      },
      {
        id: 'create-management-report',
        title: 'Konzernlagebericht erstellen',
        content: `**Neuen Lagebericht anlegen:**
1. Navigieren Sie zu "Konzernlagebericht"
2. Klicken Sie auf "Neuen Lagebericht erstellen"
3. Wählen Sie den Jahresabschluss aus

**Abschnitte strukturieren:**
Die Anwendung bietet eine Vorlage mit:
- Einleitung
- Geschäftsverlauf
- Lage des Konzerns
- Zukunftsaussichten
- Risiken und Chancen

Sie können Abschnitte:
- Hinzufügen
- Entfernen
- Umbenennen
- Reihenfolge ändern

**AI-generierte Vorschläge:**
Die Anwendung kann Vorschläge generieren:
- Basierend auf den Konsolidierungsdaten
- Schlüsselkennzahlen
- Entwicklungen

**Schlüsselkennzahlen generieren:**
Die Anwendung generiert automatisch:
- Umsatzentwicklung
- Ergebnisentwicklung
- Liquidität
- Eigenkapitalquote
- Verschuldungsgrad`,
        screenshot: 'screenshots/create-management-report.png'
      },
      {
        id: 'edit-management-report',
        title: 'Konzernlagebericht bearbeiten',
        content: `**Abschnitte bearbeiten:**
Klicken Sie auf einen Abschnitt, um ihn zu bearbeiten:
- Inhalte ändern
- Formatierung
- Struktur

**Inhalte anpassen:**
Sie können alle Inhalte anpassen:
- Text
- Zahlen
- Formatierung

**Schlüsselkennzahlen anpassen:**
Die automatisch generierten Kennzahlen können angepasst werden:
- Werte ändern
- Kommentare hinzufügen
- Erklärungen

**Versionen verwalten:**
Die Anwendung speichert alle Versionen:
- Änderungshistorie
- Vergleich zwischen Versionen
- Wiederherstellung möglich`,
        screenshot: 'screenshots/edit-management-report.png'
      },
      {
        id: 'management-report-workflow',
        title: 'Konzernlagebericht-Workflow',
        content: `**Zur Review einreichen:**
1. Prüfen Sie den Lagebericht
2. Klicken Sie auf "Zur Review einreichen"
3. Der Lagebericht wird für Review freigegeben

**Genehmigen:**
Nach dem Review:
1. Klicken Sie auf "Genehmigen"
2. Der Lagebericht wird finalisiert

**Veröffentlichen:**
Nach der Genehmigung:
1. Klicken Sie auf "Veröffentlichen"
2. Der Lagebericht ist final

**Export-Funktionen:**
Sie können exportieren:
- PDF (geplant)
- Word (geplant)
- HTML
- Text`,
        screenshot: 'screenshots/management-report-workflow.png'
      }
    ]
  },
  {
    id: 'audit-trail',
    title: 'Prüfpfad (Audit Trail)',
    subsections: [
      {
        id: 'audit-overview',
        title: 'Prüfpfad-Überblick',
        content: `**Was ist der Prüfpfad?**
Der Prüfpfad ermöglicht die vollständige Nachverfolgbarkeit aller Konsolidierungsdaten für Wirtschaftsprüfer.

**Warum ist der Prüfpfad wichtig für WP?**
Als Wirtschaftsprüfer müssen Sie:
- Jede Zahl nachvollziehen können
- Datenherkunft prüfen
- Konsolidierungsschritte verifizieren
- Dokumentation für Arbeitspapiere erstellen

**Vollständige Nachverfolgbarkeit:**
Der Prüfpfad dokumentiert:
- Alle Datenquellen
- Alle Konsolidierungsschritte
- Alle Änderungen
- Alle Genehmigungen
- Alle Verifikationen

**Zugriff:**
Navigieren Sie zu "Prüfpfad" im Menü unter "Berichte".`,
        screenshot: 'screenshots/audit-trail-overview.png'
      },
      {
        id: 'data-lineage',
        title: 'Datenherkunft nachvollziehen',
        content: `**Lineage-Knoten:**
Jeder Datenpunkt wird als Knoten im Lineage-Graph dargestellt.

**Datenquellen identifizieren:**
Für jeden Datenpunkt können Sie sehen:
- Ursprung (welches Unternehmen)
- Import-Quelle (welche Datei)
- Import-Zeitpunkt
- Importiert von

**Datenflüsse visualisieren:**
Der Lineage Graph zeigt:
- Wie Daten fließen
- Welche Transformationen stattfinden
- Welche Konsolidierungsschritte angewendet wurden

**Lineage Graph:**
Der Graph zeigt visuell:
- Knoten = Datenpunkte
- Kanten = Datenflüsse
- Farben = verschiedene Typen

**Beispiel:**
- Knoten: "Umsatzerlöse TU1" → "IC-Eliminierung" → "Konsolidierte Umsatzerlöse"`,
        screenshot: 'screenshots/data-lineage-graph.png',
        example: 'Beispiel-Graph: TU1 Umsatz → IC-Eliminierung → Konsolidierter Umsatz'
      },
      {
        id: 'documentation',
        title: 'Dokumentation',
        content: `**Dokumentation anlegen:**
Sie können für jeden Datenpunkt Dokumentation anlegen:
1. Wählen Sie den Datenpunkt aus
2. Klicken Sie auf "Dokumentation anlegen"
3. Geben Sie die Dokumentation ein:
   - Beschreibung
   - Quellen
   - Kommentare

**Dokumentation bearbeiten:**
Dokumentation kann jederzeit bearbeitet werden:
- Inhalte ändern
- Ergänzen
- Aktualisieren

**Dokumentationsstatus:**
Jede Dokumentation hat einen Status:
- Entwurf
- In Bearbeitung
- Abgeschlossen
- Verifiziert

**Dokumentation reviewen:**
Vor der Verifikation sollte Dokumentation reviewt werden:
- Vollständigkeit prüfen
- Korrektheit prüfen

**Dokumentation verifizieren:**
Als WP können Sie Dokumentation verifizieren:
- Status auf "Verifiziert" setzen
- Kommentar hinzufügen`,
        screenshot: 'screenshots/audit-documentation.png'
      },
      {
        id: 'wp-verification',
        title: 'WP-Verifikation',
        content: `**Prüfpfad für WP:**
Die Anwendung bietet spezielle Funktionen für Wirtschaftsprüfer:
- WP-Verifikation
- Prüfpfad-Export
- Arbeitspapiere

**Datenpunkte verifizieren:**
1. Navigieren Sie zum Prüfpfad
2. Wählen Sie einen Datenpunkt aus
3. Prüfen Sie:
   - Datenherkunft
   - Konsolidierungsschritte
   - Dokumentation
4. Markieren Sie als "Durch WP bestätigt"

**"Durch WP bestätigt" markieren:**
Nach der Prüfung:
- Klicken Sie auf "Durch WP bestätigt"
- Geben Sie optional einen Kommentar ein
- Datum und Prüfer werden gespeichert

**Offene Punkte identifizieren:**
Die Anwendung zeigt:
- Alle nicht verifizierten Punkte
- Priorität
- Zuordnung zu Prüfbereichen

**Prüfpfad exportieren:**
Exportieren Sie den Prüfpfad für:
- Arbeitspapiere
- Dokumentation
- Archivierung`,
        screenshot: 'screenshots/wp-verification.png'
      },
      {
        id: 'audit-export',
        title: 'Prüfpfad-Export',
        content: `**Prüfpfad exportieren:**
1. Navigieren Sie zum Prüfpfad
2. Wählen Sie den Jahresabschluss aus
3. Klicken Sie auf "Prüfpfad exportieren"

**Export-Formate:**
Sie können exportieren in:
- Excel-Format (für Arbeitspapiere)
- CSV-Format (für Weiterverarbeitung)
- JSON-Format (strukturierte Daten)

**Export für Arbeitspapiere:**
Der Excel-Export enthält:
- Alle Datenpunkte
- Datenherkunft
- Konsolidierungsschritte
- Verifikationsstatus
- Kommentare

**Inhalt des Exports:**
- Übersicht
- Detail-Daten
- Lineage-Graph (als Tabelle)
- Dokumentation`,
        screenshot: 'screenshots/audit-export-options.png'
      }
    ]
  },
  {
    id: 'plausibility-checks',
    title: 'Plausibilitätsprüfungen (Kontrollen)',
    subsections: [
      {
        id: 'checks-overview',
        title: 'Plausibilitätsprüfungen-Überblick',
        content: `**Was sind Plausibilitätsprüfungen?**
Plausibilitätsprüfungen sind automatische Kontrollen, die die Konsistenz und Richtigkeit der Daten prüfen.

**Automatische Prüfungen:**
Die Anwendung führt automatisch Prüfungen durch für:
- Bilanzsaldo (Aktiva = Passiva)
- GuV-Saldo
- Konsolidierungsposten
- IC-Abgleich
- Minderheitenanteile

**Manuelle Prüfungen:**
Sie können zusätzliche Prüfungen anlegen:
- Benutzerdefinierte Regeln
- Spezifische Kontrollen

**Zugriff:**
Navigieren Sie zu "Kontrollen" im Menü unter "Qualität".`,
        screenshot: 'screenshots/plausibility-checks-overview.png'
      },
      {
        id: 'perform-checks',
        title: 'Plausibilitätsprüfungen durchführen',
        content: `**Prüfungen starten:**
1. Navigieren Sie zu "Kontrollen"
2. Wählen Sie den Jahresabschluss aus
3. Klicken Sie auf "Prüfungen starten"

**Prüfregeln verstehen:**
Die Anwendung verwendet verschiedene Prüfregeln:

**Bilanzregeln:**
- Aktiva = Passiva
- Eigenkapital korrekt
- Minderheitenanteile korrekt

**GuV-Regeln:**
- Saldo korrekt
- Konsolidierungseffekte korrekt

**Konsolidierungsregeln:**
- IC-Posten eliminiert
- Kapitalkonsolidierung korrekt
- Schuldenkonsolidierung korrekt

**Prüfergebnisse interpretieren:**
Die Anwendung zeigt für jede Prüfung:
- Status (Erfolgreich, Fehler, Warnung)
- Details
- Empfehlungen

**Prüfergebnisse bestätigen:**
Wenn eine Prüfung erfolgreich war:
- Klicken Sie auf "Bestätigen"
- Die Prüfung wird als bestätigt markiert

**Prüfergebnisse ablehnen:**
Wenn Fehler gefunden wurden:
- Klicken Sie auf "Ablehnen"
- Geben Sie einen Grund an
- Korrigieren Sie die Daten`,
        screenshot: 'screenshots/perform-plausibility-checks.png'
      },
      {
        id: 'variances',
        title: 'Abweichungen (Variances)',
        content: `**Abweichungen erkennen:**
Die Anwendung erkennt automatisch Abweichungen:
- Gegen Vorjahr
- Gegen Plan
- Gegen Erwartungen

**Abweichungen analysieren:**
Für jede Abweichung können Sie analysieren:
- Ursache
- Auswirkung
- Materialität

**Abweichungen erklären:**
Sie können Abweichungen erklären:
- Kommentar hinzufügen
- Ursache dokumentieren
- Maßnahmen beschreiben

**Abweichungen reviewen:**
Abweichungen sollten reviewt werden:
- Materialität prüfen
- Erklärung prüfen
- Genehmigung

**Beispiel:**
- Umsatz Vorjahr: 1.000.000 EUR
- Umsatz aktuell: 1.200.000 EUR
- Abweichung: +200.000 EUR (+20%)
- Erklärung: Neues Produkt eingeführt`,
        screenshot: 'screenshots/variances-analysis.png',
        example: 'Beispiel: Umsatz +20% → Erklärung: Neues Produkt'
      },
      {
        id: 'exceptions',
        title: 'Ausnahmen (Exceptions)',
        content: `**Ausnahmen anlegen:**
Wenn eine Prüfung fehlschlägt, können Sie eine Ausnahme anlegen:
1. Klicken Sie auf "Ausnahme anlegen"
2. Geben Sie Details ein:
   - Beschreibung
   - Ursache
   - Maßnahmen

**Ausnahmen zuweisen:**
Ausnahmen können zugewiesen werden an:
- Verantwortliche Person
- Abteilung
- Externe Berater

**Ausnahmen eskalieren:**
Wenn eine Ausnahme nicht gelöst werden kann:
- Klicken Sie auf "Eskalieren"
- Die Ausnahme wird an höhere Ebene weitergegeben

**Ausnahmen lösen:**
Wenn die Ursache behoben wurde:
- Klicken Sie auf "Lösen"
- Geben Sie die Lösung ein
- Die Ausnahme wird geschlossen

**Ausnahmen schließen:**
Nach der Lösung:
- Klicken Sie auf "Schließen"
- Die Ausnahme wird archiviert`,
        screenshot: 'screenshots/exceptions-management.png'
      },
      {
        id: 'materiality',
        title: 'Wesentlichkeit (Materiality)',
        content: `**Wesentlichkeit definieren:**
Die Wesentlichkeit bestimmt, welche Abweichungen relevant sind.

**Vorgeschlagene Wesentlichkeit:**
Die Anwendung schlägt vor:
- Basierend auf Bilanzsumme
- Basierend auf Umsatz
- Basierend auf Ergebnis

**Beispiel:**
- Bilanzsumme: 10.000.000 EUR
- Vorgeschlagene Wesentlichkeit: 1% = 100.000 EUR

**Wesentlichkeit genehmigen:**
Die vorgeschlagene Wesentlichkeit sollte genehmigt werden:
- Prüfen Sie den Vorschlag
- Passen Sie ggf. an
- Genehmigen Sie

**Wesentlichkeit in Prüfungen berücksichtigen:**
Die Anwendung berücksichtigt die Wesentlichkeit bei:
- Abweichungsanalyse
- Prüfungsplanung
- Berichterstattung`,
        screenshot: 'screenshots/materiality-settings.png',
        example: 'Beispiel: Bilanzsumme 10 Mio. EUR → Wesentlichkeit 1% = 100.000 EUR'
      }
    ]
  },
  {
    id: 'policies',
    title: 'Bilanzierungsrichtlinien',
    subsections: [
      {
        id: 'policies-overview',
        title: 'Richtlinien-Überblick',
        content: `**Was sind Bilanzierungsrichtlinien?**
Bilanzierungsrichtlinien definieren, wie Positionen bilanziert und bewertet werden.

**HGB-Wahlrechte:**
Das HGB bietet verschiedene Wahlrechte:
- Bilanzierungsmethoden
- Bewertungsmethoden
- Darstellungsmethoden

**Unternehmensspezifische Richtlinien:**
Jedes Unternehmen kann eigene Richtlinien definieren:
- Basierend auf HGB-Wahlrechten
- Konsistent über alle Unternehmen
- Dokumentiert

**Zugriff:**
Navigieren Sie zu "Richtlinien" im Menü unter "Qualität".`,
        screenshot: 'screenshots/policies-overview.png'
      },
      {
        id: 'manage-policies',
        title: 'Richtlinien verwalten',
        content: `**Richtlinien anlegen:**
1. Navigieren Sie zu "Richtlinien"
2. Klicken Sie auf "Neue Richtlinie"
3. Geben Sie ein:
   - Name
   - Kategorie
   - Beschreibung
   - Regelwerk (HGB)

**Richtlinien bearbeiten:**
Richtlinien können bearbeitet werden:
- Inhalte ändern
- Aktualisieren
- Versionen verwalten

**Richtlinien aktivieren:**
Richtlinien müssen aktiviert werden:
- Nur eine aktive Version pro Richtlinie
- Änderungen erfordern neue Version

**Richtlinien-Versionen:**
Die Anwendung speichert alle Versionen:
- Änderungshistorie
- Vergleich zwischen Versionen
- Wiederherstellung möglich`,
        screenshot: 'screenshots/manage-policies.png'
      },
      {
        id: 'rules',
        title: 'Bilanzierungsregeln',
        content: `**Regeln definieren:**
Bilanzierungsregeln sind konkrete Anweisungen:
- Welche Methode anzuwenden ist
- Welche Werte zu verwenden sind
- Welche Konten zu verwenden sind

**Pflichtregeln:**
Einige Regeln sind nach HGB Pflicht:
- Bilanzierungsmethoden
- Bewertungsmethoden
- Darstellungsmethoden

**Optionale Regeln:**
Andere Regeln sind optional:
- Basierend auf HGB-Wahlrechten
- Unternehmensspezifisch

**Regeln zuordnen:**
Regeln können zugeordnet werden:
- Zu Richtlinien
- Zu Unternehmen
- Zu Konten`,
        screenshot: 'screenshots/bilanzierungsregeln.png'
      },
      {
        id: 'mappings',
        title: 'Mappings',
        content: `**Konten-Mappings:**
Konten-Mappings ordnen Konten zu:
- Zwischen verschiedenen Kontenplänen
- Für die Konsolidierung

**Materiale Mappings:**
Materiale Mappings ordnen Positionen zu:
- Für die Konsolidierung
- Für die Berichterstattung

**Mappings anwenden:**
Mappings werden automatisch angewendet bei:
- Import
- Konsolidierung
- Berichterstattung

**Mappings verwalten:**
Sie können Mappings verwalten:
- Anlegen
- Bearbeiten
- Löschen`,
        screenshot: 'screenshots/mappings-management.png'
      },
      {
        id: 'wahlrechte',
        title: 'Wahlrechte',
        content: `**HGB-Wahlrechte:**
Das HGB bietet verschiedene Wahlrechte:
- Bilanzierungsmethoden
- Bewertungsmethoden
- Darstellungsmethoden

**Wahlrechte auswählen:**
Sie können Wahlrechte auswählen:
- Pro Unternehmen
- Pro Position
- Konsistent dokumentiert

**Wahlrechte dokumentieren:**
Alle Wahlrechte werden dokumentiert:
- Welches Wahlrecht gewählt wurde
- Begründung
- Auswirkungen

**Wahlrechte genehmigen:**
Wahlrechte müssen genehmigt werden:
- Durch Geschäftsführung
- Durch WP (bei Prüfung)`,
        screenshot: 'screenshots/wahlrechte-selection.png'
      },
      {
        id: 'adjustments',
        title: 'Anpassungen (Adjustments)',
        content: `**Bilanzierungsanpassungen:**
Anpassungen sind notwendig, wenn:
- Einzelabschlüsse unterschiedliche Methoden verwenden
- Konsolidierung erfordert Anpassungen

**Anpassungen anlegen:**
1. Navigieren Sie zu "Richtlinien"
2. Wählen Sie "Anpassungen"
3. Klicken Sie auf "Anpassung anlegen"
4. Geben Sie Details ein

**Anpassungen reviewen:**
Anpassungen sollten reviewt werden:
- Korrektheit prüfen
- HGB-Konformität prüfen
- Genehmigung

**Anpassungen dokumentieren:**
Alle Anpassungen werden dokumentiert:
- Art der Anpassung
- Begründung
- Auswirkungen`,
        screenshot: 'screenshots/adjustments-management.png'
      }
    ]
  },
  {
    id: 'ai-features',
    title: 'AI-Funktionen',
    subsections: [
      {
        id: 'ai-assistant',
        title: 'AI-Assistent',
        content: `**AI-Assistent öffnen:**
Klicken Sie auf das AI-Symbol in der unteren rechten Ecke.

**HGB-spezifische Fragen stellen:**
Sie können Fragen stellen zu:
- HGB-Vorschriften
- Konsolidierungsmethoden
- Bilanzierungsfragen
- Bewertungsfragen

**Beispiel-Fragen:**
- "Wie konsolidiere ich eine Tochtergesellschaft?"
- "Was ist der Unterschied zwischen Buchwert und Zeitwert?"
- "Wie berechne ich Minderheitenanteile?"

**Quick Actions nutzen:**
Die Anwendung bietet Quick Actions:
- "Zeige IC-Differenzen"
- "Konzern-Goodwill?"
- "Konsolidierungsstatus"
- "Welche Gesellschaften?"

**IC-Differenzen analysieren:**
Der AI-Assistent kann IC-Differenzen analysieren:
- Ursachen identifizieren
- Lösungsvorschläge
- Erklärungen

**Goodwill-Fragen:**
Sie können Fragen zu Goodwill stellen:
- Berechnung
- Abschreibung
- Impairment

**Konsolidierungsstatus abfragen:**
Fragen Sie nach dem Status:
- Welche Unternehmen sind konsolidiert?
- Welche Konsolidierungsposten gibt es?
- Status der Konsolidierung?`,
        screenshot: 'screenshots/ai-assistant-chat.png',
        example: 'Beispiel-Frage: "Wie berechne ich Goodwill bei Erstkonsolidierung?"'
      },
      {
        id: 'ai-interactions',
        title: 'AI-Interaktionen',
        content: `**Fragen stellen:**
Sie können Fragen in natürlicher Sprache stellen:
- Deutsch
- HGB-spezifische Begriffe
- Kontextbezogen

**Antworten interpretieren:**
Die AI-Antworten enthalten:
- Erklärungen
- Beispiele
- Quellenangaben (wenn verfügbar)

**AI-Vorschläge nutzen:**
Die Anwendung macht Vorschläge für:
- Konsolidierungsposten
- Anpassungen
- Dokumentation

**AI-Entscheidungen verstehen:**
Alle AI-Entscheidungen werden dokumentiert:
- Was wurde vorgeschlagen?
- Warum?
- Konfidenz-Level`,
        screenshot: 'screenshots/ai-interactions.png'
      },
      {
        id: 'ai-protocol',
        title: 'AI-Nutzungsprotokoll',
        content: `**AI-Interaktionen nachvollziehen:**
Das AI-Nutzungsprotokoll zeigt alle Interaktionen:
- Fragen gestellt
- Antworten erhalten
- Vorschläge gemacht
- Entscheidungen getroffen

**Akzeptanzrate prüfen:**
Die Akzeptanzrate zeigt:
- Wie viele AI-Vorschläge wurden akzeptiert?
- Prozent der Akzeptanz

**Override-Rate prüfen:**
Die Override-Rate zeigt:
- Wie viele AI-Entscheidungen wurden überschrieben?
- Prozent der Overrides

**Konfidenz-Tracking:**
Die Anwendung zeigt:
- Durchschnittliche Konfidenz der AI
- Konfidenz pro Entscheidung

**Entscheidungs-Details:**
Für jede Entscheidung können Sie sehen:
- Was wurde vorgeschlagen?
- Warum?
- Konfidenz
- Akzeptiert/Abgelehnt

**Tool-Nutzung:**
Die Anwendung zeigt, welche AI-Tools verwendet wurden:
- analyze_ic_difference
- generate_audit_documentation
- explain_plausibility_check
- analyze_variance`,
        screenshot: 'screenshots/ai-protocol-dashboard.png'
      },
      {
        id: 'ai-export',
        title: 'AI-Protokoll exportieren',
        content: `**Vollständiges Protokoll exportieren:**
Exportieren Sie alle AI-Interaktionen:
1. Navigieren Sie zu "AI-Protokoll"
2. Wählen Sie den Zeitraum
3. Klicken Sie auf "Vollständiges Protokoll (Excel)"

**Override-Protokoll exportieren:**
Exportieren Sie nur Overrides:
- Klicken Sie auf "Override-Protokoll (Excel)"
- Enthält nur überschriebene Entscheidungen

**CSV-Export:**
Exportieren Sie als CSV für:
- Weiterverarbeitung
- Analyse
- Reporting

**Excel-Export:**
Exportieren Sie als Excel für:
- Arbeitspapiere
- Dokumentation
- Archivierung

**Datum-Filter:**
Sie können filtern nach:
- Von-Datum
- Bis-Datum
- Spezifischer Zeitraum`,
        screenshot: 'screenshots/ai-protocol-export.png'
      }
    ]
  },
  {
    id: 'export-reports',
    title: 'Export & Berichte',
    subsections: [
      {
        id: 'export-functions',
        title: 'Export-Funktionen',
        content: `**Excel-Export:**
Die meisten Daten können als Excel exportiert werden:
- Konsolidierte Bilanz
- Konsolidierte GuV
- Konsolidierungsposten
- Prüfpfad
- AI-Protokoll

**CSV-Export:**
CSV-Export für:
- Weiterverarbeitung
- Import in andere Systeme
- Datenanalyse

**PDF-Export (geplant):**
PDF-Export für:
- Finale Berichte
- Archivierung
- Weitergabe

**XML-Export (geplant):**
XML-Export für:
- E-Bilanz
- XBRL
- Weitere Formate

**JSON-Export:**
JSON-Export für:
- Strukturierte Daten
- API-Zugriff
- Weiterverarbeitung`,
        screenshot: 'screenshots/export-options.png'
      },
      {
        id: 'consolidation-reports',
        title: 'Konsolidierungsberichte',
        content: `**Konsolidierungsbericht exportieren:**
Exportieren Sie den vollständigen Konsolidierungsbericht:
- Alle Konsolidierungsposten
- Details
- Dokumentation

**Bilanz exportieren:**
Exportieren Sie die konsolidierte Bilanz:
- Excel-Format
- Strukturiert
- Formatiert

**GuV exportieren:**
Exportieren Sie die konsolidierte GuV:
- Excel-Format
- Strukturiert
- Formatiert

**Konzernanhang exportieren:**
Exportieren Sie den Konzernanhang:
- JSON (strukturiert)
- Text
- HTML
- Markdown

**Konzernlagebericht exportieren:**
Exportieren Sie den Konzernlagebericht:
- Word (geplant)
- PDF (geplant)
- HTML`,
        screenshot: 'screenshots/consolidation-reports-export.png'
      },
      {
        id: 'audit-export',
        title: 'Prüfpfad-Export',
        content: `**Prüfpfad exportieren:**
Exportieren Sie den vollständigen Prüfpfad:
- Alle Datenpunkte
- Datenherkunft
- Konsolidierungsschritte
- Verifikationen

**Lineage-Daten exportieren:**
Exportieren Sie die Lineage-Daten:
- Als Tabelle
- Als Graph (geplant)
- Strukturiert

**Dokumentation exportieren:**
Exportieren Sie die Dokumentation:
- Alle Dokumentationen
- Verifikationsstatus
- Kommentare`,
        screenshot: 'screenshots/audit-trail-export.png'
      },
      {
        id: 'ai-protocol-export',
        title: 'AI-Protokoll-Export',
        content: `**AI-Protokoll exportieren:**
Exportieren Sie das vollständige AI-Protokoll:
- Alle Interaktionen
- Entscheidungen
- Overrides

**Override-Protokoll exportieren:**
Exportieren Sie nur Overrides:
- Überschriebene Entscheidungen
- Gründe
- Alternativen`,
        screenshot: 'screenshots/ai-protocol-export-options.png'
      }
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Fehlerbehebung & Support',
    subsections: [
      {
        id: 'common-problems',
        title: 'Häufige Probleme',
        content: `**Import-Fehler:**
Häufige Import-Fehler und Lösungen:

**Problem: Falsche Spaltenstruktur**
- Lösung: Verwenden Sie das Template
- Prüfen Sie die Spaltenreihenfolge

**Problem: Ungültige Kontonummern**
- Lösung: Prüfen Sie das Kontenformat
- Verwenden Sie nur Zahlen

**Problem: Fehlende Beträge**
- Lösung: Alle Beträge müssen vorhanden sein
- Verwenden Sie 0 für leere Beträge

**Konsolidierungsfehler:**
Häufige Konsolidierungsfehler:

**Problem: Bilanz nicht ausgeglichen**
- Lösung: Prüfen Sie die Einzelabschlüsse
- Prüfen Sie die Konsolidierungsposten

**Problem: IC-Differenzen**
- Lösung: Führen Sie IC-Abgleich durch
- Prüfen Sie Timing-Unterschiede

**Verbindungsprobleme:**
Wenn Verbindungsprobleme auftreten:
- Prüfen Sie Ihre Internetverbindung
- Prüfen Sie, ob das Backend läuft
- Kontaktieren Sie den Support

**Performance-Probleme:**
Bei langsamer Performance:
- Prüfen Sie die Datenmenge
- Verwenden Sie Filter
- Kontaktieren Sie den Support`,
        screenshot: 'screenshots/troubleshooting-common-problems.png'
      },
      {
        id: 'error-messages',
        title: 'Fehlermeldungen verstehen',
        content: `**Fehlercodes:**
Die Anwendung verwendet Fehlercodes:
- 400: Ungültige Anfrage
- 401: Nicht autorisiert
- 403: Zugriff verweigert
- 404: Nicht gefunden
- 500: Serverfehler

**Fehlermeldungen interpretieren:**
Fehlermeldungen enthalten:
- Fehlercode
- Beschreibung
- Vorschläge zur Behebung

**Beispiel-Fehlermeldungen:**

**"Fehler beim Laden der Unternehmen"**
- Mögliche Ursache: Backend nicht erreichbar
- Lösung: Prüfen Sie die Verbindung

**"Ungültige Kontonummer"**
- Mögliche Ursache: Falsches Format
- Lösung: Verwenden Sie nur Zahlen

**"Bilanz nicht ausgeglichen"**
- Mögliche Ursache: Fehler in den Daten
- Lösung: Prüfen Sie Soll und Haben

**Lösungsvorschläge:**
Die Anwendung bietet Lösungsvorschläge bei Fehlern:
- Konkrete Schritte
- Links zu relevanten Abschnitten
- Kontakt zum Support`,
        screenshot: 'screenshots/error-messages-examples.png'
      },
      {
        id: 'support',
        title: 'Support-Kanäle',
        content: `**Hilfe im System:**
- Dokumentation (diese Seite)
- Kontextuelle Hilfe-Buttons
- AI-Assistent

**Kontaktmöglichkeiten:**
- E-Mail: support@example.com
- Telefon: +49 (0) XXX XXX XXX
- Support-Portal: support.example.com

**Feedback geben:**
Sie können Feedback geben:
- Über die Anwendung
- Per E-Mail
- Über das Support-Portal`,
        screenshot: 'screenshots/support-channels.png'
      }
    ]
  },
  {
    id: 'best-practices',
    title: 'Best Practices',
    subsections: [
      {
        id: 'consolidation-workflow',
        title: 'Konsolidierungsworkflow',
        content: `**Empfohlener Workflow:**

**Phase 1: Vorbereitung**
1. Unternehmen anlegen
2. Konzernstruktur aufbauen
3. Konsolidierungspflicht prüfen

**Phase 2: Datenimport**
1. Jahresabschlüsse importieren
2. Daten validieren
3. Fehler korrigieren

**Phase 3: Konsolidierung**
1. Konsolidierungskreis definieren
2. Konsolidierungsposten prüfen
3. Konsolidierung durchführen

**Phase 4: Prüfung**
1. Konsolidierte Bilanz prüfen
2. Konsolidierte GuV prüfen
3. Plausibilitätsprüfungen durchführen

**Phase 5: Dokumentation**
1. Konzernanhang erstellen
2. Konzernlagebericht erstellen
3. Prüfpfad exportieren

**Checkliste:**
- Alle Unternehmen angelegt
- Alle Jahresabschlüsse importiert
- Konsolidierung durchgeführt
- Prüfungen bestanden
- Dokumentation vollständig`,
        screenshot: 'screenshots/best-practices-workflow.png'
      },
      {
        id: 'data-quality',
        title: 'Datenqualität',
        content: `**Datenqualität sicherstellen:**

**Vor dem Import:**
- Daten im korrekten Format
- Template verwenden
- Daten prüfen

**Validierung vor Import:**
- Salden prüfen (Soll = Haben)
- Kontonummern prüfen
- Format prüfen

**Regelmäßige Prüfungen:**
- Plausibilitätsprüfungen durchführen
- Abweichungen analysieren
- Daten aktualisieren

**Best Practices:**
- Konsistente Datenstruktur
- Regelmäßige Backups
- Versionierung`,
        screenshot: 'screenshots/data-quality-checks.png'
      },
      {
        id: 'documentation-standards',
        title: 'Dokumentation',
        content: `**Dokumentationsstandards:**

**Vollständigkeit:**
- Alle Schritte dokumentieren
- Alle Entscheidungen dokumentieren
- Alle Anpassungen dokumentieren

**WP-Arbeitspapiere:**
Für Wirtschaftsprüfer:
- Prüfpfad exportieren
- Konsolidierungsposten dokumentieren
- Verifikationen dokumentieren

**Nachvollziehbarkeit:**
- Jede Zahl nachvollziehbar
- Jeder Schritt dokumentiert
- Alle Quellen angegeben`,
        screenshot: 'screenshots/documentation-standards.png'
      },
      {
        id: 'collaboration',
        title: 'Zusammenarbeit',
        content: `**Rollen und Berechtigungen:**
Die Anwendung unterstützt verschiedene Rollen:
- Administrator
- Bilanzbuchhalter
- Wirtschaftsprüfer
- Viewer

**Workflow-Management:**
- Status-Tracking
- Genehmigungsprozesse
- Benachrichtigungen

**Genehmigungsprozesse:**
- Konsolidierungsposten genehmigen
- Konzernanhang genehmigen
- Konzernlagebericht genehmigen`,
        screenshot: 'screenshots/collaboration-workflow.png'
      }
    ]
  },
  {
    id: 'appendix',
    title: 'Anhang',
    subsections: [
      {
        id: 'glossary',
        title: 'Glossar',
        content: `**Fachbegriffe:**

**Konsolidierung:**
Zusammenfassung der Abschlüsse mehrerer Unternehmen zu einem Konzernabschluss.

**Mutterunternehmen:**
Unternehmen, das die Mehrheit der Anteile oder die Kontrolle über andere Unternehmen hält.

**Tochterunternehmen:**
Unternehmen, die vom Mutterunternehmen beherrscht werden.

**Minderheitenanteile:**
Anteil am Eigenkapital und Ergebnis, der nicht dem Mutterunternehmen gehört.

**Goodwill:**
Differenz zwischen Kaufpreis und Zeitwert des Eigenkapitals bei Erstkonsolidierung.

**Intercompany-Verrechnungen (IC):**
Geschäftsvorfälle zwischen Unternehmen des Konzerns.

**HGB-Begriffe:**

**Konzern:**
Zusammenschluss von Unternehmen unter einheitlicher Leitung.

**Konzernabschluss:**
Zusammenfassung der Abschlüsse aller einbezogenen Unternehmen.

**Konzernanhang:**
Ergänzende Angaben zum Konzernabschluss.

**Konzernlagebericht:**
Beschreibung der Lage des Konzerns.

**Systembegriffe:**

**Jahresabschluss:**
Abschluss eines Unternehmens für ein Geschäftsjahr.

**Konsolidierungsposten:**
Buchungen, die bei der Konsolidierung notwendig sind.

**Prüfpfad:**
Nachverfolgbarkeit aller Daten und Schritte.`,
        screenshot: 'screenshots/glossary.png'
      },
      {
        id: 'reference',
        title: 'Referenz',
        content: `**API-Referenz (für Entwickler):**
Die Anwendung bietet eine REST-API:
- Endpunkte dokumentiert
- Beispiele verfügbar
- Authentifizierung erforderlich

**Datenstrukturen:**
- Unternehmen
- Jahresabschlüsse
- Konsolidierungsposten
- Prüfpfad

**Import-Formate:**
- Excel: Kontonummer, Soll, Haben
- CSV: Kontonummer, Soll, Haben
- Multi-Sheet: Ein Blatt pro Unternehmen`,
        screenshot: 'screenshots/api-reference.png'
      },
      {
        id: 'legal',
        title: 'Rechtliche Hinweise',
        content: `**HGB-Konformität:**
Die Anwendung unterstützt die Erstellung HGB-konformer Konzernabschlüsse. Die Verantwortung für die Korrektheit liegt beim Anwender.

**Datenschutz:**
Alle Daten werden gemäß DSGVO verarbeitet:
- Verschlüsselte Übertragung
- Verschlüsselte Speicherung
- Zugriffskontrolle

**Nutzungsbedingungen:**
Bitte beachten Sie die Nutzungsbedingungen:
- Verfügbar in der Anwendung
- Bei Registrierung akzeptiert`,
        screenshot: 'screenshots/legal-notices.png'
      }
    ]
  }
];

