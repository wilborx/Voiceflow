# Boxtrainer Booking

Buchungs-Funnel mit Admin-Dashboard für einen Boxtrainer – Next.js (App Router) + Supabase/Postgres.
Mobile-first, dunkles Design, ein Akzentfarbton, DSGVO-orientiert.

> **Stand: präsentationsfertiger Prototyp mit Platzhaltern.** Alle Texte, Preise, Fotos und
> Rechtstexte in `[ECKIGEN KLAMMERN]` müssen vor dem Livegang ersetzt werden (Checkliste unten).

---

## Schnellstart: Demo ohne API-Keys

```bash
pnpm install                                   # im Monorepo-Root
cd apps/boxtrainer
pnpm build && pnpm start                       # oder: pnpm dev
```

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin → **admin@demo.de / demo**

Ohne `DATABASE_URL` läuft die App im **Demo-Modus**:

- eingebettete Postgres-Datenbank (PGlite) in `.demo-db/` mit denselben Migrationen wie in Produktion
- fiktive Demo-Daten: Kunden, offene Anfragen, Gruppentermine (einer voll, mit Warteliste), 8 Wochen Historie für die Statistik
- E-Mails und WhatsApp werden **nicht versendet**, sondern unter *Admin → Nachrichten → Simulierter Postausgang* angezeigt
  (inkl. der Links für den Kunden – so lässt sich der komplette Ablauf vorführen)
- Demo zurücksetzen: Server stoppen, `rm -rf .demo-db`, neu starten

### Vorschlag für die Präsentation (≈ 10 Min.)

1. **Landingpage** auf dem Handy zeigen (Sticky-CTA, Angebote aus der DB, FAQ).
2. **Buchung** durchklicken: Probetraining → Kalender mit echten freien Slots → Daten inkl. freiwilliger Gesundheitsangaben → Einwilligungen → Bestätigungsseite.
3. **Gruppentraining** wählen: „noch X Plätze“, ein voller Termin → Warteliste.
4. **Admin → Anfragen**: neue Anfrage mit Countdown, *Bestätigen* / *Ablehnen mit Grund* / *Alternative vorschlagen* (freie Slots werden vorgeschlagen).
5. **Admin → Nachrichten**: die erzeugte Bestätigungs-Mail ansehen, Link „Termin verwalten“ öffnen → Kundensicht (Stornieren/Umbuchen, Gegenvorschlag annehmen).
6. **Gruppen**: Teilnehmerliste, Teilnehmer absagen → Warteliste rückt automatisch nach („Platz frei“-Nachricht).
7. **Kalender** (Woche/Monat), **Kunden** (Historie, No-Shows, Notizen, DSGVO-Export/-Löschung), **Statistik**, **Einstellungen** (Verfügbarkeit, Urlaub, Nachrichtentexte).

---

## Was drin ist

| Bereich | Umsetzung |
|---|---|
| Landingpage | Hero, Angebote aus DB, Über mich, Testimonials/Vorher-Nachher, 3 Schritte, FAQ, Sticky-CTA mobil, LocalBusiness-JSON-LD, Meta/OG, Sitemap/Robots |
| Buchungsflow | 4 Schritte mit Fortschritt, echte Slots, Restplätze, Warteliste, Zod-Validierung (Client + Server), Honeypot, Rate-Limit, UTM-Erfassung ohne Cookies |
| Verfügbarkeit | Wochenregeln (mehrere Fenster/Tag), Urlaub/Sperren/Zusatztage, Puffer, Vorlauf, Horizont, Raster, Google Free/Busy, Holds mit Ablauf, Sommerzeit-fest |
| Doppelbuchungsschutz | Exclusion-Constraint + Trigger in Postgres (getestet mit 20 parallelen Anfragen) |
| Admin | Inbox mit Countdown, Bestätigen/Ablehnen/Gegenvorschlag, Kalender Woche/Monat, Gruppen & Sondertermine (einmalig/wöchentlich), Teilnehmerlisten, Warteliste mit Nachrücken, Mini-CRM, Angebote-CRUD, Pakete, Einstellungen, Nachrichtentexte, Statistik |
| Kommunikation | 10 Nachrichtentypen (React Email), .ics-Anhang, Erinnerungen 24 h/2 h, Danke + Bewertung + Rebooking, Trainer-Benachrichtigung, WhatsApp-Templates mit E-Mail-Fallback |
| Self-Service | Signierter Link ohne Login: stornieren (Frist), umbuchen, Gegenvorschlag/Wartelistenplatz annehmen, .ics |
| Zahlungen (optional) | Stripe Checkout nach Bestätigung (Anzahlung oder Vollzahlung), Pakete/Karten mit Guthaben |
| DSGVO | Einwilligungen mit Zeitstempel + Textversion, getrennte Opt-ins (WhatsApp, Gesundheitsdaten), Löschung auf Knopfdruck, Datenauskunft (JSON), Audit-Log, keine PII in Logs, kein Tracking → kein Cookie-Banner, Refresh-Token AES-GCM-verschlüsselt |

## Platzhalter-Checkliste vor dem Livegang

- [ ] `src/content/site.ts` – Name, Ort, Gym, Adresse/Koordinaten, Kontakt, Hero-Text, Zahlen, Werdegang, Lizenzen, Erfolge, Testimonials (nur mit Einwilligung!), FAQ
- [ ] Akzentfarbe `[FARBE]`: `src/app/globals.css` (`--color-accent`, `--color-accent-strong`) und `src/lib/theme.ts`
- [ ] Fotos: `PhotoPlaceholder` in `src/app/page.tsx` durch `next/image` mit echten Fotos ersetzen
- [ ] Angebote, Preise, Dauer, Puffer: *Admin → Angebote*
- [ ] Verfügbarkeit, Haltezeit, Storno-Frist, Antwortzeit: *Admin → Einstellungen*
- [ ] Nachrichtentexte prüfen: *Admin → Einstellungen → Nachrichtentexte*
- [ ] Rechtstexte juristisch prüfen: `src/app/impressum`, `src/app/datenschutz`, `src/app/agb` (Storno-, Haftungs- und Gesundheitshinweis)
- [ ] AVV mit Vercel, Supabase, Resend, Meta, Google, Stripe abschließen

---

## Produktiv-Setup

### 1. Datenbank (Supabase)

1. Projekt in der Region **EU (Frankfurt)** anlegen.
2. Connection-String (Settings → Database → *Transaction pooler*, Port 6543) als `DATABASE_URL` setzen.
3. Migrationen einspielen: `DATABASE_URL=… pnpm db:setup --seed` (oder `supabase db push`).
4. Admin anlegen – entweder
   - **Supabase Auth**: Nutzer unter Authentication anlegen, `SUPABASE_URL` + `SUPABASE_ANON_KEY` setzen und
     `insert into admins (user_id) values ('<auth-user-uuid>');` ausführen, **oder**
   - **einfach**: `ADMIN_EMAIL` + `ADMIN_PASSWORD` (langes Passwort) setzen.

### 2. Grundkonfiguration

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_APP_URL` | öffentliche URL, z. B. `https://boxing-name.de` (für Links in Nachrichten) |
| `APP_SECRET` | `openssl rand -base64 48` – signiert Links/Sessions, verschlüsselt Tokens. **Nie ändern** (alte Links werden sonst ungültig) |
| `CRON_SECRET` | schützt `/api/cron` |

**Cron**: `/api/cron` alle 5–15 Min. aufrufen (Header `Authorization: Bearer $CRON_SECRET`).
`vercel.json` ist auf 15 Min. eingestellt (benötigt Vercel Pro; im Hobby-Plan nur täglich → alternativ
Supabase `pg_cron` + `pg_net` oder cron-job.org). Der Cron gibt abgelaufene Holds frei, versendet
Erinnerungen/Danke-Nachrichten, rückt die Warteliste nach und legt wiederkehrende Gruppentermine an.
Zusätzlich läuft die Wartung gedrosselt beim Öffnen des Admin-Bereichs und der Slot-Abfrage.

### 3. E-Mail (Resend)

1. Konto anlegen, Domain verifizieren (SPF/DKIM-DNS-Einträge).
2. `RESEND_API_KEY`, `EMAIL_FROM="[NAME] Boxing <buchung@deine-domain.de>"`, `TRAINER_NOTIFY_EMAIL` setzen.

### 4. WhatsApp Business Cloud API

1. Meta-Business-Konto + WhatsApp-App in developers.facebook.com anlegen, Telefonnummer verifizieren.
2. Permanenten System-User-Token erzeugen → `WHATSAPP_TOKEN`; Telefonnummer-ID → `WHATSAPP_PHONE_NUMBER_ID`.
3. **Templates bei Meta einreichen** (Kategorie *Utility*, Sprache `de`). Namen und Parameter-Reihenfolge:

| Template | Parameter {{1}}, {{2}}, … |
|---|---|
| `booking_request_received` | Name, Angebot, Datum, Uhrzeit |
| `booking_confirmed` | Name, Angebot, Datum, Uhrzeit, Ort, Link |
| `booking_declined` | Name, Datum, Uhrzeit, Link |
| `booking_alternative` | Name, Datum, Uhrzeit, Link |
| `booking_expired` | Name, Datum, Uhrzeit, Link |
| `booking_reminder` | Name, Angebot, Datum, Uhrzeit, Ort |
| `waitlist_joined` | Name, Angebot, Datum, Uhrzeit |
| `waitlist_spot_available` | Name, Angebot, Datum, Uhrzeit, Link |
| `booking_cancelled` | Name, Datum, Uhrzeit |
| `training_followup` | Name, Link |

WhatsApp wird nur mit Opt-in genutzt; bei Fehlern automatisch Fallback auf E-Mail. Die .ics-Datei geht bei
Bestätigungen immer zusätzlich per E-Mail raus.

### 5. Google Calendar

1. Google Cloud Console → Projekt → *Google Calendar API* aktivieren.
2. OAuth-Zustimmungsbildschirm (extern, Scopes `calendar.events`, `calendar.freebusy`), Trainer als Testnutzer bzw. App veröffentlichen.
3. OAuth-Client (Webanwendung) mit Redirect-URI `https://<domain>/api/google/callback` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
4. Optional `GOOGLE_CALENDAR_ID` (Standard `primary`).
5. *Admin → Einstellungen → Integrationen → Mit Google verbinden*.

Sync: Belegte Zeiten aus Google (Free/Busy, 2 Min. Cache) blockieren Slots; bestätigte Einzeltermine werden als
Event eingetragen und bei Storno/Umbuchung gelöscht. Gruppentermine werden nur im Admin-Kalender geführt.

### 6. Stripe (optional)

1. `STRIPE_SECRET_KEY` setzen; Webhook auf `https://<domain>/api/stripe/webhook` mit Event
   `checkout.session.completed` → `STRIPE_WEBHOOK_SECRET`.
2. *Admin → Einstellungen*: Zahlungen auf „Anzahlung“ oder „Vollzahlung“ stellen; Pakete aktivieren.

### 7. Deployment (Vercel)

- Root Directory `apps/boxtrainer`, Install Command `pnpm install` (im Monorepo-Root), Framework Next.js.
- Alle Variablen aus `.env.example` eintragen. **Ohne `DATABASE_URL` würde Vercel im Demo-Modus mit
  flüchtiger Datenbank laufen** – für eine geteilte Online-Demo daher ein (kostenloses) Supabase-Projekt verwenden.

---

## Architektur

```
src/
  app/                    Seiten (Landing, /buchen, /buchung/[token], Recht, /admin/*) und API-Routen
  components/             UI-Bausteine, BookingFlow, SlotPicker, Admin-Komponenten
  content/site.ts         alle Website-Texte (Platzhalter)
  emails/                 React-Email-Layout
  lib/
    availability/         reine Verfügbarkeits-Engine (+ Tests)
    time/zoned.ts         Europe/Berlin ↔ UTC ohne Abhängigkeiten (+ Tests)
    booking/              Slots aus DB-Daten, Buchungs-Service (Workflow, Warteliste, Wartung)
    db/                   SQL-Zugriff (pg oder PGlite), Demo-Daten
    notify/               Vorlagen, Versand (Resend, WhatsApp, Fallback)
    google.ts, payments.ts, ics.ts, auth.ts, validation.ts
supabase/
  migrations/             Schema, Buchungsfunktionen, RLS, Workflow
  seed.sql                Grunddaten (Platzhalter)
  tests/                  DB-Tests (Constraints, Holds, RLS, Parallelität)
```

### Kernregeln

- **Zeiten**: gespeichert als `timestamptz` (UTC); Regeln in Wandzeit Europe/Berlin. An Umstellungstagen zählt
  die echte Dauer; nicht existierende Uhrzeiten werden nach vorne verschoben.
- **Puffer**: Jede Buchung belegt `[Start − Puffer davor, Ende + Puffer danach)`; zwei Termine kollidieren, wenn
  sich diese Bereiche überschneiden (Abstand = Puffer danach A + Puffer davor B). Nur die Session muss ins Fenster passen.
- **Ausnahmen**: Wochenregeln − Sperren + Zusatzfenster (Zusatzfenster haben Vorrang).
- **Gruppen/Sondertermine**: feste Termine aus Vorlagen (einmalig/wöchentlich), blockieren Einzeltermine.
- **Holds**: `pending` reserviert den Slot bis `hold_expires_at` (Standard 24 h); danach `expired` + Nachricht.
- **Gegenvorschlag**: Anfrage wird auf den neuen Slot verschoben und dort gehalten; Kunde bestätigt per Link.
- **Warteliste**: Wird ein Platz frei, bekommt der Nächste einen reservierten Platz (Hold) und sagt per Link zu;
  läuft das Angebot ab, rückt der Nächste nach.
- **Self-Service-Links**: `/buchung/<id>.<HMAC>` – reproduzierbar signiert, Gültigkeit über den Buchungsstatus.

## Tests

```bash
pnpm test        # Verfügbarkeits-Engine, Zeitzonen, .ics (Vitest)
pnpm test:db     # Postgres: Constraints, Holds, Kapazität, RLS, 20 parallele Anfragen
pnpm typecheck
```

## Bekannte Grenzen / nächste Schritte

- Google→App: Löscht der Trainer ein Event direkt in Google, bleibt die Buchung bestehen (Slot-Sperre über Free/Busy funktioniert).
- Web-Push für den Trainer ist nicht umgesetzt (E-Mail-Benachrichtigung vorhanden).
- Paket-Guthaben wird im Admin manuell pro Buchung abgebucht, nicht automatisch im Buchungsflow.
- Lighthouse/WCAG: semantisches HTML, Fokus-Management, Kontraste und reduzierte Bewegung sind berücksichtigt;
  ein formaler Audit mit echten Fotos steht vor dem Livegang aus.
