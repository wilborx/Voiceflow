# Boxtrainer Booking

Buchungs-Funnel und Admin-Dashboard für einen Boxtrainer (Next.js + Supabase).
Wird in Schritten aufgebaut – aktueller Stand: **Schritt 1 – Datenmodell + Verfügbarkeitslogik**.

| Schritt | Inhalt | Status |
|---|---|---|
| 1 | Datenmodell, Verfügbarkeits-Engine, DB-Constraints, Tests | ✅ |
| 2 | Öffentlicher Buchungsflow | offen |
| 3 | Admin-Dashboard + Bestätigungs-Workflow | offen |
| 4 | Google-Calendar-Sync | offen |
| 5 | E-Mail (Resend), WhatsApp | offen |
| 6 | Landingpage + Feinschliff | offen |
| 7 | Zahlungen, Pakete, Statistik | offen |

## Struktur

```
src/lib/time/zoned.ts              Zeitzonen-Umrechnung (Intl, keine Abhängigkeiten)
src/lib/availability/engine.ts     Freie Slots (Einzel) + Restplätze (Gruppen)
src/lib/availability/recurrence.ts Wiederkehrende Gruppen-/Sondertermine expandieren
supabase/migrations/               Schema, Buchungsfunktionen, RLS
supabase/seed.sql                  Beispieldaten (Preise/Texte = Platzhalter)
supabase/tests/                    DB-Tests gegen ein Wegwerf-Postgres
```

## Tests

```bash
pnpm --filter @workspace/boxtrainer test      # Verfügbarkeits-Engine (Vitest)
pnpm --filter @workspace/boxtrainer test:db   # Constraints, Holds, RLS, Parallelität (braucht Postgres-Binaries)
```

## Verfügbarkeits-Regeln (Kurzfassung)

- **Zeiten**: gespeichert als `timestamptz` (UTC). Wochenregeln und Ausnahmen in Wandzeit
  Europe/Berlin (Minuten seit Mitternacht). An Umstellungstagen gilt die echte Dauer
  (z. B. 01–05 Uhr = 3 h im März, 5 h im Oktober); eine nicht existierende Uhrzeit wird
  nach vorne verschoben (02:30 → 03:30).
- **Puffer**: Jede Buchung belegt `[Start − Puffer davor, Ende + Puffer danach)`. Zwei Termine
  kollidieren, wenn sich diese Bereiche überschneiden → Abstand = Puffer danach (A) + Puffer
  davor (B). Externe Google-Termine haben keinen eigenen Puffer. Nur die Session selbst muss
  ins Verfügbarkeitsfenster passen, Puffer dürfen herausragen.
- **Ausnahmen**: Wochenregeln − Sperren (ganztägig oder Zeitfenster, auch über Datumsbereiche)
  + Zusatzfenster. Zusatzfenster haben Vorrang vor Sperren.
- **Einzelangebote** (Kapazität 1): Slots im Raster ab Fensterbeginn, gefiltert nach
  Mindestvorlauf, Horizont, Buchungen, Gruppenterminen und Google Free/Busy.
- **Gruppen-/Sondertermine** (Kapazität > 1): feste Termine aus `special_events`
  (einmalig oder wöchentlich, Wandzeit-stabil über die Zeitumstellung), materialisiert in
  `event_occurrences`. Restplätze = Kapazität − bestätigte − aktiv gehaltene Plätze.
  Volle Termine bleiben sichtbar (`isFull` → Warteliste). Gruppentermine blockieren den
  Trainer für Einzeltermine.
- **Holds**: `pending` hält den Slot bis `hold_expires_at` (Standard 24 h, `settings.hold_hours`).
  Die Engine behandelt abgelaufene Holds sofort als frei; `create_booking_request` setzt
  sie vor jedem Insert auf `expired`, ein Cron-Job verschickt später die Ablauf-Nachricht.

## Doppelbuchungsschutz in der Datenbank

- Exclusion-Constraint `bookings_no_overlap` auf `tstzrange(blocked_from, blocked_until)`
  für aktive Einzelbuchungen.
- Trigger `bookings_capacity` sperrt die Termin-Zeile (`FOR UPDATE`) und prüft die Kapazität.
- Trigger zwischen Einzelbuchungen und Gruppenterminen (in beide Richtungen), serialisiert
  per Advisory-Lock.
- `create_booking_request` ist nur mit `service_role` aufrufbar; die App prüft den Slot vorher
  zusätzlich mit `isSingleSlotAvailable`.

## DSGVO im Datenmodell

- Einwilligungen (`consents`) mit Zeitstempel und Textversion; WhatsApp und Gesundheitsdaten
  getrennt. Gesundheitsangaben werden ohne `health_data`-Einwilligung von der DB abgelehnt.
- `delete_customer_data()` löscht Kunde inkl. Buchungen, Einwilligungen und Nachrichten-Log
  und schreibt einen Audit-Eintrag.
- `messages_log` speichert keine Nachrichtentexte.
- Bestehende Kontaktdaten werden aus dem öffentlichen Formular nicht überschrieben.
- RLS auf allen Tabellen: `anon` liest nur öffentliche Angebote, Admins (Tabelle `admins`) alles.

## Setup (vorläufig)

1. Supabase-Projekt anlegen, Migrationen ausführen: `supabase db push` (oder SQL-Editor)
2. Optional `supabase/seed.sql` einspielen
3. Admin-Nutzer in Supabase Auth anlegen und `insert into admins (user_id) values ('<uuid>');`

Vollständige Setup-Anleitung für alle API-Keys (Google, Resend, WhatsApp, Stripe) folgt mit den
jeweiligen Schritten.
