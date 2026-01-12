# Supabase Setup Anleitung

## Problem: Server Timeout beim Erstellen von Unternehmen

Das Problem liegt wahrscheinlich daran, dass:
1. Die Supabase-Migrationen noch nicht ausgeführt wurden
2. Die Supabase-Verbindung nicht konfiguriert ist
3. Die `companies` Tabelle nicht existiert

## Lösung

### 1. Supabase-Konfiguration prüfen

Erstellen Sie eine `.env.local` Datei im `backend/` Verzeichnis:

```env
SUPABASE_URL=https://[your-project-ref].supabase.co
Supabase_Secret=[your-service-role-key]
Supabase_Public=[your-anon-key]
```

**WICHTIG:** Verwenden Sie die exakten Variablennamen `Supabase_Secret` und `Supabase_Public` (mit Unterstrichen)!

**Wo finde ich diese Werte?**
- Öffnen Sie Ihr Supabase Dashboard: https://app.supabase.com
- Wählen Sie Ihr Projekt aus
- Gehen Sie zu Settings → API
- `SUPABASE_URL` = Project URL
- `Supabase_Secret` = service_role key (NICHT der anon key!)
- `Supabase_Public` = anon key (optional, für Client-seitige Verwendung)

### 2. Migrationen ausführen

**Option A: Über Supabase Dashboard (Empfohlen)**
1. Öffnen Sie Supabase Dashboard
2. Gehen Sie zu SQL Editor
3. Öffnen Sie die Datei `supabase/migrations/001_initial_schema.sql`
4. Kopieren Sie den gesamten Inhalt
5. Fügen Sie ihn in den SQL Editor ein
6. Klicken Sie auf "Run"
7. Wiederholen Sie für `002_intercompany_transactions_enhancement.sql`
8. Wiederholen Sie für `003_participations_table.sql`

**Option B: Über Supabase CLI**
```bash
# Installiere Supabase CLI (falls nicht vorhanden)
npm install -g supabase

# Login
supabase login

# Link zu deinem Projekt
supabase link --project-ref [your-project-ref]

# Führe Migrationen aus
supabase db push
```

### 3. Verbindung testen

Führen Sie das Test-Skript aus:
```bash
cd backend
node ../check-supabase-connection.js
```

### 4. Backend neu starten

Nach der Konfiguration:
```bash
cd backend
npm run start:dev
```

## Wichtige Tabellen

Die folgenden Tabellen sollten in Supabase existieren:

1. **companies** - Unternehmen (Haupttabelle für Unternehmensverwaltung)
2. **financial_statements** - Jahresabschlüsse
3. **accounts** - Kontenplan
4. **account_balances** - Bilanzpositionen
5. **consolidation_entries** - Konsolidierungsbuchungen
6. **intercompany_transactions** - Zwischengesellschaftsgeschäfte
7. **participations** - Beteiligungsverhältnisse

## Troubleshooting

### Fehler: "relation 'companies' does not exist"
- **Lösung**: Migrationen wurden nicht ausgeführt. Führen Sie `001_initial_schema.sql` aus.

### Fehler: "Missing required Supabase configuration"
- **Lösung**: `.env.local` Datei fehlt oder ist falsch konfiguriert.
- **WICHTIG**: Verwenden Sie die exakten Variablennamen `Supabase_Secret` und `Supabase_Public` (mit Unterstrichen, nicht Bindestrichen)!

### Fehler: "Server timeout"
- **Lösung**: 
  1. Prüfen Sie, ob Supabase erreichbar ist
  2. Prüfen Sie die Netzwerkverbindung
  3. Prüfen Sie die Backend-Logs auf detaillierte Fehler

### Fehler: "Invalid API key"
- **Lösung**: Verwenden Sie den `service_role` key für `Supabase_Secret`, NICHT den `anon` key!
- Der `anon` key sollte in `Supabase_Public` gesetzt werden (optional).
