# Troubleshooting Guide

## Problem: "Request timeout - Der Server antwortet nicht"

### Schritt 1: Prüfen Sie, ob das Backend läuft

1. Öffnen Sie ein Terminal im `backend/` Verzeichnis
2. Prüfen Sie, ob das Backend läuft:
   ```bash
   # Windows PowerShell
   Test-NetConnection -ComputerName localhost -Port 3000
   
   # Oder im Browser:
   # http://localhost:3000/api/health
   ```

3. Wenn das Backend nicht läuft, starten Sie es:
   ```bash
   cd backend
   npm run start:dev
   ```

### Schritt 2: Prüfen Sie die Backend-Logs

Beim Start sollten Sie sehen:
```
=== Supabase Configuration ===
Supabase_Public: [zeigt ersten Teil] oder NOT SET
Supabase_Secret: [zeigt ersten Teil] oder NOT SET
Supabase URL: [Ihre URL] oder NOT SET
✅ Supabase Client erfolgreich erstellt
Application is running on: http://localhost:3000/api
```

**Wenn Sie "NOT SET" sehen:**
- Erstellen Sie `backend/.env.local` mit:
  ```env
  SUPABASE_URL=https://[your-project-ref].supabase.co
  Supabase_Secret=[your-service-role-key]
  Supabase_Public=[your-anon-key]
  ```

### Schritt 3: Prüfen Sie die Frontend-Konfiguration

1. Öffnen Sie die Browser-Console (F12)
2. Prüfen Sie, ob API-Requests gesendet werden:
   - Sie sollten sehen: `API Request: POST /companies`
3. Prüfen Sie die API-URL:
   - Standard: `http://localhost:3000/api`
   - Kann in `.env` überschrieben werden: `VITE_API_URL=...`

### Schritt 4: Prüfen Sie CORS

Wenn Sie CORS-Fehler sehen:
- Backend sollte auf Port 3000 laufen
- Frontend sollte auf Port 5173 laufen (Vite Standard)
- CORS ist in `backend/src/main.ts` konfiguriert

### Schritt 5: Health-Check

Testen Sie, ob das Backend erreichbar ist:
```bash
# Im Browser oder mit curl:
http://localhost:3000/api/health
```

Erwartete Antwort:
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T...",
  "uptime": 123.45
}
```

## Häufige Probleme

### Problem: Backend startet nicht

**Ursache:** Supabase-Konfiguration fehlt oder falsch

**Lösung:**
1. Erstellen Sie `backend/.env.local`
2. Fügen Sie die Supabase-Konfiguration hinzu
3. Starten Sie das Backend neu

### Problem: "Supabase Client nicht initialisiert"

**Ursache:** Supabase-Konfiguration fehlt

**Lösung:**
1. Prüfen Sie `backend/.env.local`
2. Stellen Sie sicher, dass `SUPABASE_URL` und `Supabase_Secret` gesetzt sind
3. Starten Sie das Backend neu

### Problem: "Request timeout"

**Ursache:** Backend läuft nicht oder ist nicht erreichbar

**Lösung:**
1. Prüfen Sie, ob das Backend läuft (Port 3000)
2. Prüfen Sie die Backend-Logs auf Fehler
3. Prüfen Sie die Firewall-Einstellungen
4. Prüfen Sie, ob ein anderer Prozess Port 3000 blockiert

### Problem: "Keine Antwort vom Server"

**Ursache:** Backend läuft nicht oder CORS-Problem

**Lösung:**
1. Starten Sie das Backend: `cd backend && npm run start:dev`
2. Prüfen Sie die CORS-Konfiguration in `backend/src/main.ts`
3. Prüfen Sie die Browser-Console auf CORS-Fehler

## Debugging-Tipps

1. **Backend-Logs prüfen:**
   - Alle Console.log-Ausgaben sollten sichtbar sein
   - Fehler werden rot angezeigt

2. **Browser-Console prüfen:**
   - Öffnen Sie F12 → Console
   - Prüfen Sie API-Requests und Fehler

3. **Network-Tab prüfen:**
   - Öffnen Sie F12 → Network
   - Prüfen Sie, ob Requests gesendet werden
   - Prüfen Sie Status-Codes (200 = OK, 500 = Server-Fehler, etc.)

4. **Health-Check verwenden:**
   - `http://localhost:3000/api/health` sollte immer funktionieren
   - Wenn nicht, läuft das Backend nicht
