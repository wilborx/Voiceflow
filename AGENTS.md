
# VoiceFlow-AI

Voice-Agent-Plattform für Unternehmen. DSGVO-konforme Erstellung, Verwaltung und Betrieb von KI-gestützten Telefon-Agents mit Recording, Consent-Management und Datenlöschung.

## Monorepo Structure

```
apps/
  api-server/           – Express API (Auth, Voice-Webhooks, Stripe, Drizzle)
  voiceflow/            – Haupt-Frontend Admin/Dashboard
  mockup-sandbox/       – Mockup-/Test-Sandbox
libs/
  db/                   – Datenbank-Modelle (Drizzle schema)
  api-zod/              – Zod-Schemas + Validierung
  api-client-react/     – React Query Client + Hooks
scripts/
```

## Tech Stack

- **Frontend**: React 19 + Vite + wouter + Radix UI + Tailwind
- **API**: Express 5 + esbuild
- **Auth**: Clerk
- **Voice/Telefonie**: VAPI AI SDK, Telnyx
- **DB**: Drizzle ORM (PostgreSQL)
- **Payments**: Stripe
- **Google APIs**: Kalender / Integration
- **Package Manager**: pnpm workspace (monorepo)
- **Typing**: TypeScript ~5.9 strict

## DSGVO / Compliance-Prinzipien

- Voice-Recordings nur nach ausdrücklichem **Double-Opt-In** Consent
- Datenlöschung auf Knopfdruck (inkl. Recordings) + Auto-Löschung (TTL)
- Verschlüsselung at-rest / in-transit ist Pflicht
- Logging: Keine personenbezogenen Daten in Logs (PII redaction)
- Datenverarbeitungsverträge (AVV) als Dokumente vorsehen
- Audit-Trail für alle Zugriffe auf recordings/pii

## Scripts

- `pnpm install` – Dependencies installieren
- `pnpm run build` – Alles bauen
- `pnpm run typecheck` – TS-Check gesamter Workspace
- `cd apps/api-server && pnpm run dev` – API starten
- `cd apps/voiceflow && pnpm run dev` – Frontend starten

## Local Development

1. `.env` aus `.env.example` erstellen
2. PostgreSQL-Datenbank verbinden (lokal oder Supabase)
3. `pnpm install` ausführen
4. Beide Server starten

## Required Environment Variables

| Variable | Beschreibung |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL-Verbindung |
| `VAPI_API_KEY` | Vapi.ai API Key |
| `VAPI_WEBHOOK_SECRET` | Secret für Webhook-Verifizierung |
| `TELNYX_API_KEY` | Telnyx API Key |
| `TELNYX_CONNECTION_ID` | Telnyx Voice Connection ID |
| `TELNYX_SENDER_NUMBER` | Eigene Telnyx Nummer (+49...) |
| `STRIPE_SECRET_KEY` | Stripe Secret Key |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Signing Secret |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth Credentials |
| `CLERK_SECRET_KEY` | Clerk Backend Key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Frontend Key |

## Rules

- Keine Secrets ins Git (API Keys, Clerk Keys, Stripe Keys, Telnyx Keys)
- DSGVO-relevante Features immer mit Opt-Out und Löschfunktion
- Recording-Pfade nie public zugänglich machen
- Branching nach Feature; Conventional Commits verwenden
- TypeScript strict, kein `any` in neuem Code
