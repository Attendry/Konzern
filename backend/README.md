# Konzern Backend

NestJS Backend für die Verwaltung konsolidierter Jahresabschlüsse.

## Voraussetzungen

- Node.js (v18 oder höher)
- Supabase Account und Projekt
- npm oder yarn

## Installation

1. Abhängigkeiten installieren:
```bash
npm install
```

2. Umgebungsvariablen konfigurieren:
   - Kopieren Sie `.env.example` zu `.env`
   - Füllen Sie die Supabase-Verbindungsdaten aus:
     ```
     DB_HOST=db.[YOUR-PROJECT-REF].supabase.co
     DB_PORT=5432
     DB_USERNAME=postgres
     DB_PASSWORD=[YOUR-PASSWORD]
     DB_DATABASE=postgres
     ```

3. Datenbank-Migrationen ausführen:
   - Führen Sie die SQL-Dateien aus `supabase/migrations/` in Ihrem Supabase-Projekt aus
   - Oder verwenden Sie die Supabase CLI:
     ```bash
     supabase db push
     ```

## Entwicklung

```bash
# Entwicklungsserver starten
npm run start:dev

# Production Build
npm run build
npm run start:prod
```

## API-Endpunkte

### Unternehmen
- `GET /api/companies` - Liste aller Unternehmen
- `POST /api/companies` - Neues Unternehmen erstellen
- `GET /api/companies/:id` - Unternehmen-Details
- `PATCH /api/companies/:id` - Unternehmen aktualisieren
- `DELETE /api/companies/:id` - Unternehmen löschen
- `GET /api/companies/:id/children` - Tochterunternehmen

### Jahresabschlüsse
- `GET /api/financial-statements` - Liste aller Jahresabschlüsse
- `POST /api/financial-statements` - Neuen Jahresabschluss erstellen
- `GET /api/financial-statements/:id` - Jahresabschluss-Details
- `GET /api/financial-statements/:id/balances` - Kontensalden

### Datenimport
- `POST /api/import/excel` - Excel-Datei importieren
- `POST /api/import/csv` - CSV-Datei importieren
- `GET /api/import/template` - Import-Vorlage herunterladen

### Konsolidierung
- `POST /api/consolidation/calculate/:financialStatementId` - Konsolidierung durchführen
- `GET /api/consolidation/entries/:financialStatementId` - Konsolidierungsbuchungen
- `POST /api/consolidation/entries` - Manuelle Konsolidierungsbuchung

## Testing

```bash
# Unit-Tests
npm run test

# E2E-Tests
npm run test:e2e

# Test-Coverage
npm run test:cov
```

## Projektstruktur

```
src/
├── modules/          # Feature-Module
│   ├── company/
│   ├── consolidation/
│   ├── import/
│   └── financial-statement/
├── entities/        # TypeORM Entitäten
├── dto/             # Data Transfer Objects
├── config/          # Konfiguration
└── common/          # Gemeinsame Utilities
```
