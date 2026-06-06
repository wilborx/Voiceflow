# VoiceFlow AI — Replit Master Build Prompt
### Version 1.0 | Full-Stack Voice Agent Platform | DACH Market

---

## 🎯 PROJECT OVERVIEW

You are building **VoiceFlow AI** — a production-ready, full-stack B2B SaaS platform that enables SMBs in the DACH region (Germany, Austria, Switzerland) to deploy AI-powered phone agents within 24 hours. The platform handles three core use cases:

1. **Appointment & Booking Agents** — for salons, spas, medical practices
2. **Advisory & Consultation Agents** — for insurance brokers, financial advisors
3. **HR Screening & Onboarding Agents** — for recruiters, HR departments

The entire stack must be production-grade, DSGVO-compliant, and deployable from day one.

---

## 🏗️ TECH STACK — NON-NEGOTIABLE

```
Frontend:     Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
Backend:      Node.js + Fastify + TypeScript
Database:     Supabase (PostgreSQL) — EU Frankfurt region
Cache:        Upstash Redis — EU Frankfurt region
Auth:         Clerk.dev (GDPR-compliant)
Payments:     Stripe (+ SEPA Direct Debit)
Voice Engine: Vapi.ai (orchestration)
STT:          Deepgram Nova-3 (German language model)
LLM:          Anthropic Claude (claude-sonnet-4-20250514)
TTS:          ElevenLabs Turbo v2.5
Telephony:    Telnyx (primary) + Twilio (fallback)
Automation:   n8n webhooks (external, self-hosted)
Storage:      Supabase Storage (EU) for call recordings
Monitoring:   Sentry (error tracking) + Posthog (analytics)
Email:        Resend.com (transactional)
```

---

## 📁 PROJECT STRUCTURE

Generate the following complete file structure:

```
voiceflow-ai/
├── apps/
│   ├── web/                          # Next.js 15 customer dashboard
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── sign-in/page.tsx
│   │   │   │   └── sign-up/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx          # Overview dashboard
│   │   │   │   ├── agents/
│   │   │   │   │   ├── page.tsx      # Agent list
│   │   │   │   │   ├── new/page.tsx  # Agent creation wizard
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx  # Agent detail
│   │   │   │   │       ├── settings/page.tsx
│   │   │   │   │       └── conversations/page.tsx
│   │   │   │   ├── calls/
│   │   │   │   │   ├── page.tsx      # Call history & transcripts
│   │   │   │   │   └── [id]/page.tsx # Single call detail
│   │   │   │   ├── analytics/page.tsx
│   │   │   │   ├── integrations/page.tsx
│   │   │   │   ├── billing/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   │   ├── api/
│   │   │   │   ├── webhooks/
│   │   │   │   │   ├── vapi/route.ts       # Vapi event webhooks
│   │   │   │   │   ├── stripe/route.ts     # Stripe billing webhooks
│   │   │   │   │   └── telnyx/route.ts     # Telnyx call events
│   │   │   │   ├── agents/
│   │   │   │   │   ├── route.ts            # CRUD agents
│   │   │   │   │   └── [id]/route.ts
│   │   │   │   ├── calls/route.ts
│   │   │   │   └── integrations/
│   │   │   │       ├── google-calendar/route.ts
│   │   │   │       └── fresha/route.ts
│   │   │   ├── globals.css
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── dashboard/
│   │   │   │   ├── StatsGrid.tsx
│   │   │   │   ├── CallsChart.tsx
│   │   │   │   ├── RecentCalls.tsx
│   │   │   │   └── AgentStatusCard.tsx
│   │   │   ├── agents/
│   │   │   │   ├── AgentCard.tsx
│   │   │   │   ├── AgentWizard.tsx   # Multi-step creation wizard
│   │   │   │   ├── VoiceSelector.tsx
│   │   │   │   └── PromptEditor.tsx
│   │   │   └── shared/
│   │   │       ├── Sidebar.tsx
│   │   │       ├── TopNav.tsx
│   │   │       └── EmptyState.tsx
│   │   ├── lib/
│   │   │   ├── vapi.ts
│   │   │   ├── supabase.ts
│   │   │   ├── stripe.ts
│   │   │   └── utils.ts
│   │   └── types/index.ts
│   └── api/                          # Fastify backend (optional separation)
├── packages/
│   └── shared/                       # Shared types & utils
├── supabase/
│   └── migrations/                   # DB schema migrations
├── .env.example
├── .env.local                        # NEVER commit
└── README.md
```

---

## 🗄️ DATABASE SCHEMA

Create all Supabase migrations for the following schema:

```sql
-- ============================================================
-- USERS & ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,           -- Clerk user ID
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','professional','business','enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing',
  minutes_included INTEGER NOT NULL DEFAULT 300,
  minutes_used INTEGER NOT NULL DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AGENTS
-- ============================================================

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking','advisory','hr_screening','hr_onboarding')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','draft')),
  
  -- Vapi configuration
  vapi_assistant_id TEXT,
  phone_number TEXT,
  telnyx_number_id TEXT,
  
  -- Voice configuration
  voice_provider TEXT DEFAULT '11labs',
  voice_id TEXT,
  voice_name TEXT,
  language TEXT DEFAULT 'de',
  
  -- LLM configuration
  system_prompt TEXT NOT NULL,
  llm_model TEXT DEFAULT 'claude-sonnet-4-20250514',
  temperature NUMERIC DEFAULT 0.7,
  
  -- Business configuration
  business_name TEXT,
  business_hours JSONB,             -- { mon: {open: "09:00", close: "18:00"}, ... }
  timezone TEXT DEFAULT 'Europe/Berlin',
  
  -- Integration config
  calendar_integration JSONB,       -- { provider: 'google', credentials: {...} }
  crm_integration JSONB,
  ats_integration JSONB,
  
  -- Stats
  total_calls INTEGER DEFAULT 0,
  total_minutes NUMERIC DEFAULT 0,
  resolution_rate NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CALLS
-- ============================================================

CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  
  -- Vapi data
  vapi_call_id TEXT UNIQUE,
  
  -- Call metadata
  caller_number TEXT,
  direction TEXT CHECK (direction IN ('inbound','outbound')),
  status TEXT CHECK (status IN ('queued','in_progress','completed','failed','no_answer')),
  duration_seconds INTEGER DEFAULT 0,
  
  -- Outcome
  resolved BOOLEAN DEFAULT false,
  resolution_type TEXT,             -- 'booked', 'info_provided', 'escalated', 'no_action'
  escalated_to_human BOOLEAN DEFAULT false,
  
  -- Content
  transcript TEXT,
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  
  -- Extracted data
  extracted_data JSONB,             -- { name, phone, service, datetime, ... }
  
  -- Recording
  recording_url TEXT,
  recording_expires_at TIMESTAMPTZ,
  
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- APPOINTMENTS (created by booking agents)
-- ============================================================

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  
  service TEXT,
  staff_member TEXT,
  
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','rescheduled','no_show','completed')),
  
  -- External calendar ref
  external_calendar_id TEXT,
  external_event_id TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- HR SCREENING (created by HR agents)
-- ============================================================

CREATE TABLE screening_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  
  candidate_name TEXT,
  candidate_phone TEXT,
  candidate_email TEXT,
  
  position_applied TEXT,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  recommendation TEXT CHECK (recommendation IN ('advance','hold','reject')),
  
  answers JSONB,                    -- Array of { question, answer, score }
  summary TEXT,
  
  -- ATS sync
  ats_candidate_id TEXT,
  ats_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- KNOWLEDGE BASE (for advisory agents)
-- ============================================================

CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,
  
  -- Vector embedding for RAG
  embedding vector(1536),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT LOG (DSGVO compliance)
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  actor_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (DSGVO)
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- Organizations: users only see their own org
CREATE POLICY "org_isolation" ON organizations
  FOR ALL USING (owner_id = requesting_user_id());

-- Agents: org members only
CREATE POLICY "agents_org_isolation" ON agents
  FOR ALL USING (org_id IN (
    SELECT id FROM organizations WHERE owner_id = requesting_user_id()
  ));

-- Apply same pattern to all tables
-- [repeat for calls, appointments, screening_results, knowledge_documents]
```

---

## 🔌 VAPI INTEGRATION

### `lib/vapi.ts` — Complete Vapi Service

```typescript
import Vapi from '@vapi-ai/server-sdk';

const vapi = new Vapi(process.env.VAPI_API_KEY!);

export interface CreateAgentConfig {
  name: string;
  type: 'booking' | 'advisory' | 'hr_screening' | 'hr_onboarding';
  businessName: string;
  systemPrompt: string;
  voiceId: string;
  language?: string;
  webhookUrl: string;
}

export async function createVapiAssistant(config: CreateAgentConfig) {
  const assistant = await vapi.assistants.create({
    name: config.name,
    model: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: config.systemPrompt,
      temperature: 0.7,
      maxTokens: 500,
      tools: getToolsForAgentType(config.type),
    },
    voice: {
      provider: '11labs',
      voiceId: config.voiceId,
      stability: 0.85,
      similarityBoost: 0.75,
      style: 0.3,
      useSpeakerBoost: true,
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-3',
      language: config.language || 'de',
      smartFormat: true,
      punctuate: true,
    },
    serverUrl: config.webhookUrl,
    serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET!,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundSound: 'office',
    backchannelingEnabled: true,
    backgroundDenoisingEnabled: true,
    firstMessage: buildFirstMessage(config.businessName, config.type),
    endCallMessage: 'Vielen Dank für Ihren Anruf. Auf Wiederhören!',
    endCallPhrases: [
      'auf wiederhören',
      'tschüss',
      'danke tschüss',
      'ich melde mich',
    ],
  });
  return assistant;
}

function buildFirstMessage(businessName: string, type: string): string {
  const greetings = {
    booking: `Herzlich willkommen bei ${businessName}! Mein Name ist Lena, ich bin Ihre digitale Assistentin. Wie kann ich Ihnen heute helfen?`,
    advisory: `Guten Tag, Sie sind verbunden mit ${businessName}. Ich bin Ihre KI-Beratungsassistentin. Wie darf ich Ihnen behilflich sein?`,
    hr_screening: `Hallo und herzlich willkommen! Ich führe heute Ihr erstes Kennenlern-Gespräch im Rahmen Ihrer Bewerbung. Haben Sie gerade einen Moment Zeit?`,
    hr_onboarding: `Willkommen im Team! Ich bin Ihre digitale Onboarding-Assistentin und helfe Ihnen bei Fragen rund um Ihren Start. Was möchten Sie wissen?`,
  };
  return greetings[type as keyof typeof greetings] || greetings.booking;
}

function getToolsForAgentType(type: string) {
  const baseTools = [
    {
      type: 'function' as const,
      function: {
        name: 'transferToHuman',
        description: 'Verbindet den Anrufer mit einem menschlichen Mitarbeiter bei komplexen Anfragen',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Grund für die Weiterleitung' },
          },
          required: ['reason'],
        },
      },
      server: { url: `${process.env.NEXT_PUBLIC_APP_URL}/api/tools/transfer` },
    },
  ];

  if (type === 'booking') {
    return [
      ...baseTools,
      {
        type: 'function' as const,
        function: {
          name: 'checkAvailability',
          description: 'Prüft verfügbare Termine im Kalender',
          parameters: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Datum (YYYY-MM-DD)' },
              service: { type: 'string', description: 'Gewünschte Behandlung/Service' },
              staffMember: { type: 'string', description: 'Gewünschter Mitarbeiter (optional)' },
            },
            required: ['date'],
          },
        },
        server: { url: `${process.env.NEXT_PUBLIC_APP_URL}/api/tools/calendar/availability` },
      },
      {
        type: 'function' as const,
        function: {
          name: 'bookAppointment',
          description: 'Erstellt einen neuen Termin im Kalender',
          parameters: {
            type: 'object',
            properties: {
              customerName: { type: 'string' },
              customerPhone: { type: 'string' },
              service: { type: 'string' },
              datetime: { type: 'string', description: 'ISO 8601 datetime' },
              staffMember: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['customerName', 'customerPhone', 'service', 'datetime'],
          },
        },
        server: { url: `${process.env.NEXT_PUBLIC_APP_URL}/api/tools/calendar/book` },
      },
      {
        type: 'function' as const,
        function: {
          name: 'sendConfirmation',
          description: 'Sendet eine SMS-Bestätigung an den Kunden',
          parameters: {
            type: 'object',
            properties: {
              phone: { type: 'string' },
              message: { type: 'string' },
            },
            required: ['phone', 'message'],
          },
        },
        server: { url: `${process.env.NEXT_PUBLIC_APP_URL}/api/tools/sms/send` },
      },
    ];
  }

  if (type === 'hr_screening') {
    return [
      ...baseTools,
      {
        type: 'function' as const,
        function: {
          name: 'saveScreeningAnswer',
          description: 'Speichert eine Antwort aus dem Screening-Gespräch',
          parameters: {
            type: 'object',
            properties: {
              questionId: { type: 'string' },
              question: { type: 'string' },
              answer: { type: 'string' },
              score: { type: 'number', description: 'Bewertung 0-10' },
            },
            required: ['question', 'answer'],
          },
        },
        server: { url: `${process.env.NEXT_PUBLIC_APP_URL}/api/tools/screening/save` },
      },
      {
        type: 'function' as const,
        function: {
          name: 'scheduleInterview',
          description: 'Vereinbart ein Folge-Interview',
          parameters: {
            type: 'object',
            properties: {
              candidateName: { type: 'string' },
              candidatePhone: { type: 'string' },
              preferredDate: { type: 'string' },
            },
            required: ['candidateName', 'candidatePhone'],
          },
        },
        server: { url: `${process.env.NEXT_PUBLIC_APP_URL}/api/tools/screening/schedule` },
      },
    ];
  }

  return baseTools;
}

export async function updateVapiAssistant(assistantId: string, updates: Partial<CreateAgentConfig>) {
  return vapi.assistants.update(assistantId, updates as any);
}

export async function deleteVapiAssistant(assistantId: string) {
  return vapi.assistants.delete(assistantId);
}

export async function getCallDetails(callId: string) {
  return vapi.calls.get(callId);
}
```

---

## 📞 TELNYX INTEGRATION

### `lib/telnyx.ts`

```typescript
import Telnyx from 'telnyx';

const telnyx = new Telnyx(process.env.TELNYX_API_KEY!);

export async function purchasePhoneNumber(countryCode: 'DE' | 'AT' | 'CH' = 'DE') {
  // Search for available numbers
  const { data: numbers } = await telnyx.availablePhoneNumbers.list({
    filter: {
      country_code: countryCode,
      features: ['voice', 'sms'],
      limit: 5,
    },
  });

  if (!numbers.length) throw new Error('Keine verfügbaren Nummern gefunden');

  // Purchase first available
  const { data: order } = await telnyx.numberOrders.create({
    phone_numbers: [{ phone_number: numbers[0].phone_number }],
    connection_id: process.env.TELNYX_CONNECTION_ID!,
  });

  return order;
}

export async function assignNumberToAgent(
  phoneNumber: string,
  vapiAssistantId: string
) {
  // Configure Telnyx number to forward to Vapi's SIP endpoint
  await telnyx.phoneNumbers.update(phoneNumber, {
    connection_id: process.env.TELNYX_SIP_CONNECTION_ID!,
    messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
  });
}

export async function sendSMS(to: string, message: string) {
  const { data } = await telnyx.messages.create({
    from: process.env.TELNYX_SENDER_NUMBER!,
    to,
    text: message,
  });
  return data;
}
```

---

## 🪝 VAPI WEBHOOK HANDLER

### `app/api/webhooks/vapi/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { verifyVapiSignature } from '@/lib/vapi';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-vapi-secret');

  // Verify webhook authenticity
  if (signature !== process.env.VAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = JSON.parse(body);
  const supabase = createClient();

  switch (event.message.type) {
    case 'call-started':
      await handleCallStarted(event, supabase);
      break;

    case 'call-ended':
      await handleCallEnded(event, supabase);
      break;

    case 'transcript':
      await handleTranscript(event, supabase);
      break;

    case 'function-call':
      return await handleFunctionCall(event, supabase);

    case 'hang':
      await handleHang(event, supabase);
      break;

    default:
      console.log('Unhandled Vapi event:', event.message.type);
  }

  return NextResponse.json({ received: true });
}

async function handleCallStarted(event: any, supabase: any) {
  const { call } = event.message;

  await supabase.from('calls').insert({
    vapi_call_id: call.id,
    caller_number: call.customer?.number,
    direction: 'inbound',
    status: 'in_progress',
    started_at: new Date().toISOString(),
    agent_id: await getAgentIdFromVapiId(call.assistantId, supabase),
  });

  // Update agent call count
  await supabase.rpc('increment_agent_calls', {
    vapi_assistant_id: call.assistantId,
  });
}

async function handleCallEnded(event: any, supabase: any) {
  const { call } = event.message;

  const durationSeconds = call.endedAt
    ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
    : 0;

  await supabase
    .from('calls')
    .update({
      status: 'completed',
      duration_seconds: durationSeconds,
      ended_at: call.endedAt,
      recording_url: call.recordingUrl,
      transcript: call.transcript,
      summary: call.summary,
    })
    .eq('vapi_call_id', call.id);

  // Update org minutes used
  const minutesUsed = Math.ceil(durationSeconds / 60);
  await supabase.rpc('increment_minutes_used', {
    vapi_call_id: call.id,
    minutes: minutesUsed,
  });

  // Trigger post-call analysis
  await triggerPostCallAnalysis(call.id, supabase);
}

async function handleFunctionCall(event: any, supabase: any) {
  const { functionCall } = event.message;

  // Route to appropriate handler
  switch (functionCall.name) {
    case 'checkAvailability':
      return await handleCheckAvailability(functionCall.parameters);
    case 'bookAppointment':
      return await handleBookAppointment(functionCall.parameters, supabase);
    case 'saveScreeningAnswer':
      return await handleSaveScreeningAnswer(functionCall.parameters, supabase);
    case 'transferToHuman':
      return NextResponse.json({ result: 'Transferring to human agent...' });
    default:
      return NextResponse.json({ error: 'Unknown function' }, { status: 400 });
  }
}

async function handleCheckAvailability(params: any) {
  // Query Google Calendar API or Fresha API
  // Return available slots
  const slots = await getCalendarAvailability(params.date, params.service);
  return NextResponse.json({
    result: JSON.stringify({
      available: slots.length > 0,
      slots: slots.slice(0, 3).map(s => ({
        datetime: s.start,
        label: formatGermanDateTime(s.start),
      })),
    }),
  });
}

async function handleBookAppointment(params: any, supabase: any) {
  // Create appointment in external calendar
  const appointment = await createCalendarEvent(params);

  // Store in database
  await supabase.from('appointments').insert({
    customer_name: params.customerName,
    customer_phone: params.customerPhone,
    service: params.service,
    scheduled_at: params.datetime,
    status: 'confirmed',
    external_event_id: appointment.id,
  });

  return NextResponse.json({
    result: JSON.stringify({
      success: true,
      confirmationNumber: appointment.id.slice(-6).toUpperCase(),
      message: `Termin erfolgreich eingetragen für ${formatGermanDateTime(params.datetime)}`,
    }),
  });
}

function formatGermanDateTime(isoString: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(isoString));
}

async function getAgentIdFromVapiId(vapiAssistantId: string, supabase: any) {
  const { data } = await supabase
    .from('agents')
    .select('id')
    .eq('vapi_assistant_id', vapiAssistantId)
    .single();
  return data?.id;
}

async function triggerPostCallAnalysis(callId: string, supabase: any) {
  // Async: sentiment analysis, CRM sync, etc.
  // In production: queue this as a background job
}
```

---

## 📅 GOOGLE CALENDAR INTEGRATION

### `app/api/integrations/google-calendar/route.ts`

```typescript
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`
);

export async function GET(req: NextRequest) {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
  });
  return NextResponse.redirect(url);
}

export async function getAvailableSlots(
  accessToken: string,
  refreshToken: string,
  date: string,
  durationMinutes = 60
): Promise<{ start: string; end: string }[]> {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const startOfDay = new Date(`${date}T08:00:00+02:00`);
  const endOfDay = new Date(`${date}T19:00:00+02:00`);

  // Get busy times
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      items: [{ id: 'primary' }],
    },
  });

  const busyPeriods = data.calendars?.primary?.busy || [];

  // Calculate free slots
  return calculateFreeSlots(startOfDay, endOfDay, busyPeriods, durationMinutes);
}

export async function createCalendarEvent(
  accessToken: string,
  refreshToken: string,
  params: {
    summary: string;
    datetime: string;
    durationMinutes: number;
    customerName: string;
    customerPhone: string;
    description?: string;
  }
) {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const start = new Date(params.datetime);
  const end = new Date(start.getTime() + params.durationMinutes * 60000);

  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    sendUpdates: 'externalOnly',
    requestBody: {
      summary: `${params.summary} — ${params.customerName}`,
      description: `📞 Gebucht per KI-Telefon\nKunde: ${params.customerName}\nTelefon: ${params.customerPhone}\n${params.description || ''}`,
      start: { dateTime: start.toISOString(), timeZone: 'Europe/Berlin' },
      end: { dateTime: end.toISOString(), timeZone: 'Europe/Berlin' },
      status: 'confirmed',
    },
  });

  return data;
}

function calculateFreeSlots(
  start: Date,
  end: Date,
  busyPeriods: any[],
  slotDuration: number
): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  const slotMs = slotDuration * 60000;
  let cursor = new Date(start);

  while (cursor.getTime() + slotMs <= end.getTime()) {
    const slotEnd = new Date(cursor.getTime() + slotMs);
    const isConflict = busyPeriods.some(busy => {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      return cursor < busyEnd && slotEnd > busyStart;
    });

    if (!isConflict) {
      slots.push({
        start: cursor.toISOString(),
        end: slotEnd.toISOString(),
      });
    }
    cursor = new Date(cursor.getTime() + slotMs);
  }

  return slots;
}
```

---

## 💳 STRIPE BILLING

### `lib/stripe.ts`

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 9900,          // €99 in cents
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    minutes: 300,
    agents: 1,
  },
  professional: {
    name: 'Professional',
    price: 24900,
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID!,
    minutes: 1000,
    agents: 3,
  },
  business: {
    name: 'Business',
    price: 54900,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID!,
    minutes: 3000,
    agents: 10,
  },
};

export async function createCheckoutSession(
  orgId: string,
  planKey: keyof typeof PLANS,
  email: string
) {
  const plan = PLANS[planKey];

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card', 'sepa_debit'],
    customer_email: email,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    metadata: { orgId, planKey },
    subscription_data: {
      trial_period_days: 14,
      metadata: { orgId, planKey },
    },
    locale: 'de',
  });
}

export async function createCustomerPortalSession(stripeCustomerId: string) {
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
  });
}
```

---

## 🎨 UI — DASHBOARD COMPONENTS

### `components/dashboard/StatsGrid.tsx`

```tsx
import { Phone, Clock, CheckCircle, TrendingUp } from 'lucide-react';

interface Stat {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ElementType;
  color: string;
}

export function StatsGrid({ stats }: { stats: Stat[] }) {
  const defaultStats: Stat[] = [
    {
      label: 'Anrufe heute',
      value: '24',
      change: '+12%',
      positive: true,
      icon: Phone,
      color: 'text-blue-500',
    },
    {
      label: 'Ø Gesprächsdauer',
      value: '3:42 Min',
      change: '-0:18',
      positive: true,
      icon: Clock,
      color: 'text-purple-500',
    },
    {
      label: 'Lösungsrate',
      value: '78%',
      change: '+4%',
      positive: true,
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      label: 'Buchungen',
      value: '18',
      change: '+6',
      positive: true,
      icon: TrendingUp,
      color: 'text-orange-500',
    },
  ];

  const displayStats = stats || defaultStats;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {displayStats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500 font-medium">{stat.label}</span>
              <div className={`p-2 rounded-lg bg-gray-50 ${stat.color}`}>
                <Icon size={18} />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
              <span className={`text-sm font-medium ${stat.positive ? 'text-green-600' : 'text-red-500'}`}>
                {stat.change}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### `components/agents/AgentWizard.tsx` — Multi-Step Agent Creation

```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const STEPS = [
  { id: 1, title: 'Agent-Typ', description: 'Was soll Ihr Agent tun?' },
  { id: 2, title: 'Business-Daten', description: 'Informationen zu Ihrem Unternehmen' },
  { id: 3, title: 'Stimme & Sprache', description: 'Wie soll Ihr Agent klingen?' },
  { id: 4, title: 'Verhalten', description: 'Anweisungen und Gesprächsführung' },
  { id: 5, title: 'Integrationen', description: 'Kalender, CRM und mehr verbinden' },
  { id: 6, title: 'Telefonnummer', description: 'Nummer zuweisen und aktivieren' },
];

const AGENT_TYPES = [
  {
    id: 'booking',
    title: '📅 Terminbuchung',
    description: 'Nimmt Terminanfragen entgegen, prüft Verfügbarkeit und bucht direkt ins Kalender',
    useCases: ['Frisörsalons', 'Beautystudios', 'Arztpraxen', 'Fitnessstudios'],
  },
  {
    id: 'advisory',
    title: '💼 Beratung & Qualifizierung',
    description: 'Beantwortet Fragen, qualifiziert Leads und leitet komplexe Anfragen weiter',
    useCases: ['Versicherungsmakler', 'Finanzberater', 'Immobilien', 'Rechtsanwälte'],
  },
  {
    id: 'hr_screening',
    title: '👥 HR Screening',
    description: 'Führt strukturierte Erstgespräche durch und bewertet Kandidaten automatisch',
    useCases: ['Recruiting-Agenturen', 'HR-Abteilungen', 'Zeitarbeitsfirmen'],
  },
  {
    id: 'hr_onboarding',
    title: '🚀 Onboarding',
    description: 'Beantwortet Fragen neuer Mitarbeiter zu Einarbeitung, Tools und Abläufen',
    useCases: ['Konzerne', 'Retail', 'Logistik', 'Gastronomie'],
  },
];

export function AgentWizard({ onComplete }: { onComplete: (data: any) => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    type: '',
    businessName: '',
    businessType: '',
    timezone: 'Europe/Berlin',
    businessHours: { open: '09:00', close: '18:00' },
    voiceId: '',
    voiceName: '',
    language: 'de',
    systemPromptAdditions: '',
    calendarProvider: '',
    phoneNumber: '',
  });

  const updateData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step > s.id
                  ? 'bg-green-500 text-white'
                  : step === s.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {step > s.id ? '✓' : s.id}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 ${step > s.id ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-1">{STEPS[step - 1].title}</h2>
        <p className="text-gray-500 mb-6">{STEPS[step - 1].description}</p>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            {AGENT_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => updateData({ type: type.id })}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  formData.type === type.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-lg font-semibold mb-1">{type.title}</div>
                <p className="text-sm text-gray-600 mb-3">{type.description}</p>
                <div className="flex flex-wrap gap-1">
                  {type.useCases.map(uc => (
                    <span key={uc} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {uc}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Unternehmensname</label>
              <Input
                placeholder="z.B. Salon Bella München"
                value={formData.businessName}
                onChange={e => updateData({ businessName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Öffnung</label>
                <Input
                  type="time"
                  value={formData.businessHours.open}
                  onChange={e => updateData({ businessHours: { ...formData.businessHours, open: e.target.value } })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Schluss</label>
                <Input
                  type="time"
                  value={formData.businessHours.close}
                  onChange={e => updateData({ businessHours: { ...formData.businessHours, close: e.target.value } })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Additional steps 3-6 follow same pattern */}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
          Zurück
        </Button>
        <Button
          onClick={() => {
            if (step < STEPS.length) {
              setStep(s => s + 1);
            } else {
              onComplete(formData);
            }
          }}
          disabled={step === 1 && !formData.type}
        >
          {step === STEPS.length ? 'Agent aktivieren 🚀' : 'Weiter'}
        </Button>
      </div>
    </div>
  );
}
```

---

## 🔒 ENVIRONMENT VARIABLES

Create `.env.example` with all required variables:

```bash
# ═══════════════════════════════════════════════
# VoiceFlow AI — Environment Variables
# NEVER commit .env.local to git
# ═══════════════════════════════════════════════

# App
NEXT_PUBLIC_APP_URL=https://your-app.replit.app

# ── Authentication (Clerk) ───────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard/onboarding

# ── Database (Supabase EU Frankfurt) ─────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── Voice: Vapi ──────────────────────────────────
VAPI_API_KEY=...
VAPI_WEBHOOK_SECRET=...
NEXT_PUBLIC_VAPI_PUBLIC_KEY=...

# ── Voice: ElevenLabs ────────────────────────────
ELEVENLABS_API_KEY=...

# ── STT: Deepgram ────────────────────────────────
DEEPGRAM_API_KEY=...

# ── Telephony: Telnyx (primary) ──────────────────
TELNYX_API_KEY=KEY...
TELNYX_CONNECTION_ID=...
TELNYX_SIP_CONNECTION_ID=...
TELNYX_MESSAGING_PROFILE_ID=...
TELNYX_SENDER_NUMBER=+49...

# ── Telephony: Twilio (fallback) ─────────────────
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+49...

# ── Payments (Stripe) ────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PROFESSIONAL_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...

# ── Calendar Integrations ────────────────────────
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# ── Email (Resend) ───────────────────────────────
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@voiceflow.ai

# ── Cache (Upstash Redis) ────────────────────────
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# ── Monitoring ───────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=https://...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
```

---

## 🧠 SYSTEM PROMPTS — PRODUCTION QUALITY

### Booking Agent System Prompt Template

```
Du bist [BUSINESS_NAME]s freundliche KI-Telefonassistentin. Dein Name ist Lena.

AUFGABE:
Nimm Terminanfragen entgegen und buche Termine direkt ins Kalendersystem.

GESPRÄCHSFÜHRUNG:
- Sprich immer Deutsch, professionell und warmherzig
- Halte Antworten kurz (max. 2 Sätze)
- Frage nur EINE Sache auf einmal
- Bestätige wichtige Angaben durch Wiederholen

PFLICHTINFORMATIONEN für eine Buchung:
1. Gewünschte Behandlung/Service
2. Wunschdatum und -uhrzeit
3. Vollständiger Name des Kunden
4. Rückrufnummer für Bestätigung

ÖFFNUNGSZEITEN: [BUSINESS_HOURS]
ANGEBOTENE SERVICES: [SERVICE_LIST]

TOOLS:
- checkAvailability: Immer prüfen bevor du einen Termin bestätigst
- bookAppointment: Erst aufrufen wenn ALLE Pflichtinfos vorliegen
- sendConfirmation: Nach erfolgreicher Buchung immer SMS senden
- transferToHuman: Bei Beschwerden, komplexen Sonderwünschen oder ausdrücklichem Kundenwunsch

WICHTIGE REGELN:
- Erfinde KEINE Verfügbarkeiten — prüfe immer via checkAvailability
- Bestätige einen Termin erst NACH erfolgreichem bookAppointment-Aufruf
- Bei Unsicherheit: lieber nachfragen als falsch buchen
- Datenschutz: Sammle nur notwendige Daten (Name, Telefon)

GESPRÄCHSENDE:
Beende jeden Anruf freundlich mit einer Bestätigung was vereinbart wurde.
```

---

## 🚀 REPLIT DEPLOYMENT SETUP

### `.replit` Configuration

```toml
run = "npm run dev"
entrypoint = "apps/web/app/page.tsx"

[nix]
channel = "stable-24_05"

[deployment]
run = ["sh", "-c", "npm run build && npm start"]
deploymentTarget = "cloudrun"

[[ports]]
localPort = 3000
externalPort = 80

[[ports]]
localPort = 3001
externalPort = 3001
```

### `package.json` Root

```json
{
  "name": "voiceflow-ai",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "db:migrate": "supabase db push",
    "db:generate": "supabase gen types typescript --local > types/supabase.ts"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "@clerk/nextjs": "^6.0.0",
    "@supabase/supabase-js": "^2.47.0",
    "@supabase/ssr": "^0.5.0",
    "@vapi-ai/server-sdk": "^0.10.0",
    "stripe": "^17.0.0",
    "telnyx": "^2.0.0",
    "twilio": "^5.0.0",
    "googleapis": "^144.0.0",
    "@upstash/redis": "^1.34.0",
    "resend": "^4.0.0",
    "@sentry/nextjs": "^8.0.0",
    "posthog-js": "^1.190.0",
    "lucide-react": "^0.454.0",
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "zod": "^3.23.0",
    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.1.0",
    "@tanstack/react-query": "^5.59.0",
    "recharts": "^2.13.0",
    "sonner": "^1.5.0"
  }
}
```

---

## ✅ BUILD CHECKLIST

Before considering the MVP complete, verify:

- [ ] Agent creation wizard (all 4 types) works end-to-end
- [ ] Vapi assistant gets created in Vapi dashboard on agent save
- [ ] Telnyx number purchased and assigned to Vapi assistant
- [ ] Inbound test call reaches the agent and gets answered
- [ ] `checkAvailability` tool returns real Google Calendar data
- [ ] `bookAppointment` creates real calendar event + DB record
- [ ] SMS confirmation sent via Telnyx after booking
- [ ] Vapi webhook `/api/webhooks/vapi` receives and processes all event types
- [ ] Call transcript saved to Supabase after call ends
- [ ] Dashboard shows real-time call stats
- [ ] Stripe checkout flow works with SEPA + credit card
- [ ] Stripe webhook updates org subscription status
- [ ] All API keys in environment variables — zero hardcoded secrets
- [ ] Row Level Security enabled on all Supabase tables
- [ ] DSGVO: Privacy policy page exists, DPA downloadable
- [ ] Error states handled gracefully (API down, calendar fail, etc.)
- [ ] German language throughout entire UI
- [ ] Mobile responsive dashboard

---

## 🎯 MVP SCOPE (Build in this order)

```
Priority 1 — Core Loop:
  Agent creation → Vapi config → Phone number → Inbound call works

Priority 2 — Booking Value:
  Calendar check → Slot suggestion → Booking → SMS confirmation

Priority 3 — Dashboard:
  Call history → Transcripts → Basic analytics

Priority 4 — Monetization:
  Stripe billing → Plan limits enforcement → Usage tracking

Priority 5 — Polish:
  Onboarding flow → Error handling → Loading states → Empty states
```

---

*VoiceFlow AI — Built for the DACH market. Powered by Vapi, Claude, ElevenLabs & Telnyx.*
*Version 1.0 | Confidential*
