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

## Deployment

### Frontend (Vercel)

Das Frontend kann auf Vercel deployed werden. Siehe [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) für detaillierte Anweisungen.

**Schnellstart:**
1. Repository zu Vercel importieren
2. **Root Directory** auf `frontend` setzen
3. Environment Variable `VITE_API_URL` mit der Backend-URL setzen
4. Deploy!

### Backend

Das NestJS Backend sollte separat auf Railway, Render oder einem ähnlichen Service deployed werden.

## Git Setup

Falls Sie den Fehler "A commit author is required" erhalten:

**Windows (PowerShell):**
```powershell
.\setup-git.ps1
```

**Linux/Mac:**
```bash
chmod +x setup-git.sh
./setup-git.sh
```

Oder manuell:
```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"
```