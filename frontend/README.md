# Konzern Frontend

React Frontend für die Verwaltung konsolidierter Jahresabschlüsse.

## Voraussetzungen

- Node.js (v18 oder höher)
- npm oder yarn

## Installation

1. Abhängigkeiten installieren:
```bash
npm install
```

2. Umgebungsvariablen konfigurieren (optional):
   - Erstellen Sie eine `.env` Datei:
     ```
     VITE_API_URL=http://localhost:3000/api
     ```

## Entwicklung

```bash
# Entwicklungsserver starten
npm run dev

# Production Build
npm run build

# Preview Production Build
npm run preview
```

Die Anwendung läuft standardmäßig auf `http://localhost:5173`.

## Projektstruktur

```
src/
├── components/      # React-Komponenten
│   ├── CompanyManagement/
│   ├── DataImport/
│   ├── Consolidation/
│   └── FinancialStatement/
├── pages/           # Seiten-Komponenten
├── services/        # API-Clients
├── types/           # TypeScript Typen
└── hooks/           # React Hooks
```

## Features

- **Dashboard**: Übersicht über Konzerne und Jahresabschlüsse
- **Unternehmensverwaltung**: CRUD-Operationen für Unternehmen
- **Datenimport**: Upload von Excel/CSV-Dateien
- **Konsolidierung**: Automatische Konsolidierung nach HGB
- **Jahresabschluss-Ansicht**: Detailansicht mit Kontensalden

## Technologien

- React 18
- TypeScript
- Vite
- React Router
- Axios
- TanStack Table
