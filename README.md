# VoiceFlow-AI

**Voice-Agent-Plattform für Unternehmen** — DSGVO-konforme Erstellung, Verwaltung und Betrieb von KI-gestützten Telefon-Agents mit Recording, Consent-Management und Datenlöschung.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange)](https://pnpm.io)

## 🚀 Features

- **KI-Telefon-Agents** mit VAPI.ai und Telnyx Integration
- **DSGVO-konform** mit Double-Opt-In Consent & automatischer Datenlöschung
- **Stripe-Zahlungen** für Abonnements
- **Google Calendar Integration** für Terminbuchung
- **Clerk Auth** für sichere Benutzeranmeldung
- **Audit-Trail** für alle Zugriffe auf personenbezogene Daten

## 📁 Monorepo Structure

```
apps/
  api-server/           – Express API (Auth, Voice-Webhooks, Stripe, Drizzle)
  voiceflow/            – Haupt-Frontend Admin/Dashboard
  mockup-sandbox/       – Mockup-/Test-Sandbox
libs/
  db/                   – Datenbank-Modelle (Drizzle schema)
  api-zod/              – Zod-Schemas + Validierung
scripts/
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + Vite + wouter + Radix UI + Tailwind |
| **API** | Express 5 + esbuild |
| **Auth** | Clerk |
| **Voice/Telefonie** | VAPI AI SDK, Telnyx |
| **DB** | Drizzle ORM (PostgreSQL) |
| **Payments** | Stripe |
| **Google APIs** | Kalender / Integration |
| **Package Manager** | pnpm workspace (monorepo) |
| **Typing** | TypeScript ~5.9 strict |

## 🚦 Development

### Voraussetzungen

- Node.js >= 20
- pnpm >= 9
- PostgreSQL (lokal oder Supabase)

### Installation

```bash
pnpm install
```

### Environment Variables

`.env` aus `.env.example` erstellen und Werte eintragen:

```bash
cp .env.example .env
# Edit .env with your credentials
```

### Scripts

```bash
# Alles bauen
pnpm run build

# TypeScript Check
pnpm run typecheck

# API starten
cd apps/api-server && pnpm run dev

# Frontend starten
cd apps/voiceflow && pnpm run dev
```

## 🔐 DSGVO Compliance

- **Voice-Recordings** nur nach ausdrücklichem Double-Opt-In Consent
- **Datenlöschung** auf Knopfdruck (inkl. Recordings) + Auto-Löschung (TTL)
- **Verschlüsselung** at-rest / in-transit ist Pflicht
- **Logging**: Keine personenbezogenen Daten in Logs (PII redaction)
- **Datenverarbeitungsverträge** (AVV) als Dokumente vorsehen
- **Audit-Trail** für alle Zugriffe auf recordings/pii

## 🤝 Contributing

1. Feature-Branch von `main` erstellen (`feat/xyz` oder `fix/xyz`)
2. Changes implementieren
3. Tests schreiben
4. Pull Request erstellen

### Commit Guidelines

Wir verwenden [Conventional Commits](https://www.conventionalcommits.org):

```
feat(api): add voice recording endpoint with consent validation
fix(web): resolve sidebar navigation active state bug
docs: update README with environment setup
```

## 📄 Lizenz

MIT License — siehe [LICENSE](LICENSE)