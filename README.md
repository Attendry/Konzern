# Konzern - Konsolidierte Jahresabschlüsse

Web-Anwendung zur Vorbereitung konsolidierter Jahresabschlüsse nach HGB (Handelsgesetzbuch).

## Technologie-Stack

- **Backend**: NestJS (TypeScript)
- **Frontend**: React (TypeScript)
- **Datenbank**: Supabase (PostgreSQL)
- **ORM**: TypeORM

## Projektstruktur

```
konzern/
├── backend/          # NestJS Backend
├── frontend/         # React Frontend
├── shared/           # Gemeinsame Typen/Interfaces
└── supabase/         # Supabase-Konfiguration
```

## Setup

### Voraussetzungen

- Node.js (v18 oder höher)
- Supabase Account (kostenlos auf supabase.com)
- npm oder yarn

### Installation

1. Repository klonen
2. Supabase-Projekt erstellen:
   - Gehen Sie zu [supabase.com](https://supabase.com) und erstellen Sie ein neues Projekt
   - Notieren Sie sich die Projekt-URL und den API-Key
3. Umgebungsvariablen konfigurieren:
   - Erstellen Sie `backend/.env` mit den Supabase-Verbindungsdaten (siehe `backend/.env.example`)
4. Abhängigkeiten installieren:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
5. Datenbank-Migrationen ausführen (siehe `supabase/migrations/`)
6. Backend starten:
   ```bash
   cd backend && npm run start:dev
   ```
7. Frontend starten:
   ```bash
   cd frontend && npm run dev
   ```

## Features

- Unternehmen-Verwaltung mit Konzernstruktur
- Datenimport (Excel/CSV)
- Automatische Konsolidierung nach HGB
- Jahresabschluss-Verwaltung

## Entwicklung

Siehe separate README-Dateien in `backend/` und `frontend/` für detaillierte Entwicklungsanweisungen.
