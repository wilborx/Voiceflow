import { google } from "googleapis";
import { getApiBaseUrl } from "./base-url.js";
import { createHmac } from "crypto";

const oauthStateSecret = process.env.OAUTH_STATE_SECRET;

if (!oauthStateSecret) {
  throw new Error("OAUTH_STATE_SECRET must be set");
}

const STATE_SECRET = oauthStateSecret;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${getApiBaseUrl()}/api/integrations/google/callback`,
);

export function getAuthUrl(agentId: string): string {
  const signature = createHmac("sha256", STATE_SECRET)
    .update(agentId)
    .digest("hex")
    .slice(0, 16);
  const state = `${agentId}:${signature}`;
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar"],
    prompt: "consent",
    state,
  });
}

export function verifyState(state: string): string | null {
  const parts = state.split(":");
  if (parts.length !== 2) return null;
  const [agentId, signature] = parts;
  const expectedSignature = createHmac("sha256", STATE_SECRET)
    .update(agentId)
    .digest("hex")
    .slice(0, 16);
  if (signature !== expectedSignature) return null;
  return agentId;
}

export async function exchangeCodeForTokens(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getAvailableSlots(
  accessToken: string,
  refreshToken: string,
  date: string,
  durationMinutes = 60,
): Promise<string[]> {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const startOfDay = new Date(`${date}T08:00:00+02:00`);
  const endOfDay = new Date(`${date}T19:00:00+02:00`);

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      items: [{ id: "primary" }],
    },
  });

  const busyPeriods = data.calendars?.primary?.busy ?? [];
  const slotMs = durationMinutes * 60000;
  const slots: string[] = [];
  let cursor = new Date(startOfDay);

  while (cursor.getTime() + slotMs <= endOfDay.getTime()) {
    const slotEnd = new Date(cursor.getTime() + slotMs);
    const isConflict = busyPeriods.some((busy) => {
      return cursor < new Date(busy.end!) && slotEnd > new Date(busy.start!);
    });
    if (!isConflict) slots.push(cursor.toISOString());
    cursor = new Date(cursor.getTime() + slotMs);
  }

  return slots.slice(0, 3);
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
  },
) {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const start = new Date(params.datetime);
  const end = new Date(start.getTime() + params.durationMinutes * 60000);

  const { data } = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: `${params.summary} — ${params.customerName}`,
      description: `Gebucht via VoiceFlow AI\nKunde: ${params.customerName}\nTel: ${params.customerPhone}`,
      start: { dateTime: start.toISOString(), timeZone: "Europe/Berlin" },
      end: { dateTime: end.toISOString(), timeZone: "Europe/Berlin" },
      status: "confirmed",
    },
  });

  return data;
}
