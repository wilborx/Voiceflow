import { VapiClient } from "@vapi-ai/server-sdk";

export const vapi = process.env.VAPI_API_KEY
  ? new VapiClient({ token: process.env.VAPI_API_KEY })
  : null;

export interface CreateAssistantParams {
  name: string;
  type: "booking" | "advisory" | "hr_screening" | "hr_onboarding";
  systemPrompt: string;
  voiceId?: string | null;
  language?: string;
  businessName?: string | null;
}

const FIRST_MESSAGES: Record<string, string> = {
  booking: "Herzlich willkommen! Wie kann ich Ihnen heute helfen?",
  advisory: "Guten Tag, ich bin Ihre KI-Beratungsassistentin. Wie darf ich Ihnen behilflich sein?",
  hr_screening: "Hallo! Ich führe heute Ihr erstes Gespräch im Rahmen Ihrer Bewerbung. Haben Sie einen Moment Zeit?",
  hr_onboarding: "Willkommen im Team! Ich beantworte gerne Ihre Fragen zum Start. Was möchten Sie wissen?",
};

const BOOKING_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "checkAvailability",
      description: "Prüft verfügbare Termine im Kalender des Unternehmens",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Datum im Format YYYY-MM-DD" },
          service: { type: "string", description: "Gewünschte Behandlung oder Dienstleistung" },
        },
        required: ["date"],
      },
    },
    server: { url: `${process.env.API_BASE_URL}/api/tools/calendar/availability` },
  },
  {
    type: "function" as const,
    function: {
      name: "bookAppointment",
      description: "Erstellt einen neuen Termin nach Bestätigung durch den Kunden",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string", description: "Vollständiger Name des Kunden" },
          customerPhone: { type: "string", description: "Telefonnummer des Kunden" },
          service: { type: "string", description: "Gebuchte Behandlung" },
          datetime: { type: "string", description: "Termin als ISO 8601 Datetime" },
        },
        required: ["customerName", "customerPhone", "service", "datetime"],
      },
    },
    server: { url: `${process.env.API_BASE_URL}/api/tools/calendar/book` },
  },
  {
    type: "function" as const,
    function: {
      name: "transferToHuman",
      description: "Verbindet den Anrufer mit einem menschlichen Mitarbeiter bei Beschwerden oder sehr komplexen Anfragen",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Grund für die Weiterleitung" },
        },
        required: ["reason"],
      },
    },
    server: { url: `${process.env.API_BASE_URL}/api/tools/transfer` },
  },
];

export async function createVapiAssistant(params: CreateAssistantParams) {
  if (!vapi) throw new Error("Vapi not configured — VAPI_API_KEY missing");

  const tools = params.type === "booking" ? BOOKING_TOOLS : [
    {
      type: "function" as const,
      function: {
        name: "transferToHuman",
        description: "Verbindet mit einem Mitarbeiter",
        parameters: {
          type: "object",
          properties: { reason: { type: "string" } },
          required: ["reason"],
        },
      },
      server: { url: `${process.env.API_BASE_URL}/api/tools/transfer` },
    },
  ];

  const assistant = await (vapi.assistants.create as any)({
    name: params.name,
    model: {
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      systemPrompt: params.systemPrompt,
      temperature: 0.7,
      tools,
    },
    voice: {
      provider: "11labs",
      voiceId: params.voiceId ?? "21m00Tcm4TlvDq8ikWAM",
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-3",
      language: params.language ?? "de",
    },
    firstMessage: FIRST_MESSAGES[params.type] ?? FIRST_MESSAGES.booking,
    endCallMessage: "Vielen Dank für Ihren Anruf. Auf Wiederhören!",
    endCallPhrases: ["auf wiederhören", "tschüss", "danke tschüss"],
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    serverUrl: `${process.env.API_BASE_URL}/api/webhooks/vapi`,
    serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET,
  });

  return assistant;
}

export async function deleteVapiAssistant(assistantId: string) {
  if (!vapi) return;
  try {
    await vapi.assistants.delete({ id: assistantId });
  } catch (err) {
    console.error("Failed to delete Vapi assistant:", assistantId, err);
  }
}
