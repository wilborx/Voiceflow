# Migration & Backfill Plan

## Status

- Migration `0000_slippery_lord_hawal.sql` bereits angewendet
- Enthält: `audit_logs`, `webhook_events`, Consent-Spalten in `calls`

## Backfill-Strategie für bestehende Plaintext-PII

### 1. Google Calendar Tokens (agents.google_calendar_access_token, agents.google_calendar_refresh_token)

**Status**: Noch nicht verschlüsselt in DB  
**Backfill-SQL** (einmalig ausführen):

```sql
-- Für Tokens, die bereits in Spalten mit verschlüsselten Werten stehen
-- Aktuell: Keine automatische Backfill nötig, da neue Tokens durch crypto-Lib verschlüsselt werden
-- Alte Tokens müssen manuell zurückgesetzt werden oder gemigriert werden
```

### 2. Recording-URLs (calls.recording_url)

**Status**: Wird nicht verschlüsselt (nur Referenz-URL)  
**Hinweis**: Recording-Pfade sind nicht public zugänglich gemountet (siehe `apps/api-server/src/app.ts`)

### 3. Durchführung

1. **Neue Schreibungen**: Verschlüsselt durch `@workspace/crypto` Library
2. **Bestehende Daten**: Migration via Node-Script oder manueller Prozess
3. **Rotation**: `ENCRYPTION_KEY` in Umgebung, Rotation per Key-Update mit 30-Tage-Übergangszeitraum

## Rotation-Strategie

### ENCRYPTION_KEY Rotation

1. Neuen Key generieren und als `ENCRYPTION_KEY_NEW` setzen
2. Dual-Decrypt Versuch: Erst mit neuem Key, dann mit altem Key
3. Nach 30 Tagen: Alten Key entfernen

### Restore-Kompatibilität

- Alle Keys werden in Umgebungsvariablen geholt
- Kein Key-Storage in DB
- Backup muss `ENCRYPTION_KEY` enthalten für Wiederherstellung
