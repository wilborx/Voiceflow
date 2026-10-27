import "server-only";
import { env, integrations } from "./config";
import { sql, sqlOne } from "./db/client";
import type { BookingDetail } from "./db/types";
import { decrypt, encrypt } from "./server/crypto";
import { log } from "./server/log";
import type { Interval } from "./availability/intervals";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];
const API = "https://www.googleapis.com/calendar/v3";

const redirectUri = () => `${env.appUrl}/api/google/callback`;

export function googleAuthUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: env.googleClientId ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function googleExchangeCode(code: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId ?? "",
      client_secret: env.googleClientSecret ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as { refresh_token?: string; error?: string };
  if (!res.ok || !json.refresh_token) throw new Error(`google oauth: ${json.error ?? res.status}`);
  await sql(
    `insert into integrations (key, ciphertext) values ('google', $1)
     on conflict (key) do update set ciphertext = excluded.ciphertext, updated_at = now()`,
    [encrypt(JSON.stringify({ refreshToken: json.refresh_token }))],
  );
  cache.token = undefined;
}

export async function googleDisconnect(): Promise<void> {
  await sql("delete from integrations where key = 'google'");
  cache.token = undefined;
}

export async function isGoogleConnected(): Promise<boolean> {
  if (!integrations.google) return false;
  return Boolean(await sqlOne("select 1 from integrations where key = 'google'"));
}

interface GoogleCache {
  token?: { value: string; exp: number };
  busy: Map<string, { at: number; data: Interval[] }>;
}
const gg = globalThis as unknown as { __btGoogle?: GoogleCache };
const cache: GoogleCache = (gg.__btGoogle ??= { busy: new Map() });

async function accessToken(): Promise<string | null> {
  if (!integrations.google) return null;
  if (cache.token && cache.token.exp > Date.now() + 60_000) return cache.token.value;
  const row = await sqlOne<{ ciphertext: string }>("select ciphertext from integrations where key = 'google'");
  if (!row) return null;
  const { refreshToken } = JSON.parse(decrypt(row.ciphertext)) as { refreshToken: string };
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId ?? "",
      client_secret: env.googleClientSecret ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`google refresh: ${json.error ?? res.status}`);
  cache.token = { value: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 204 || res.status === 410) return null;
  if (!res.ok) throw new Error(`google api ${path.split("?")[0]}: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Belegte Zeiten aus Google Calendar (2 Min. Cache). Bei Fehlern leer – der Trainer
 * bestätigt manuell, eine Google-Störung soll keine Buchungen verhindern.
 */
export async function googleBusy(from: Date, to: Date): Promise<Interval[]> {
  if (!integrations.google) return [];
  const key = `${from.toISOString()}|${to.toISOString()}`;
  const hit = cache.busy.get(key);
  if (hit && Date.now() - hit.at < 120_000) return hit.data;
  try {
    const res = await api<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>("/freeBusy", {
      method: "POST",
      body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: env.googleCalendarId }] }),
    });
    const busy = Object.values(res?.calendars ?? {}).flatMap((c) => c.busy ?? []);
    const data = busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
    cache.busy.set(key, { at: Date.now(), data });
    if (cache.busy.size > 200) cache.busy.clear();
    return data;
  } catch (err) {
    log.error("google free/busy fehlgeschlagen", err);
    return [];
  }
}

export function invalidateBusyCache(): void {
  cache.busy.clear();
}

export async function googleCreateEvent(b: BookingDetail, description: string): Promise<string | null> {
  try {
    const ev = await api<{ id: string }>(`/calendars/${encodeURIComponent(env.googleCalendarId)}/events`, {
      method: "POST",
      body: JSON.stringify({
        summary: `${b.offering.name}: ${b.customer.name}`,
        description,
        location: b.offering.location || undefined,
        start: { dateTime: b.startsAt.toISOString(), timeZone: "Europe/Berlin" },
        end: { dateTime: b.endsAt.toISOString(), timeZone: "Europe/Berlin" },
        extendedProperties: { private: { bookingId: b.id } },
      }),
    });
    invalidateBusyCache();
    return ev?.id ?? null;
  } catch (err) {
    log.error("google event anlegen fehlgeschlagen", err, { bookingId: b.id });
    return null;
  }
}

export async function googleDeleteEvent(eventId: string | null): Promise<void> {
  if (!eventId) return;
  try {
    await api(`/calendars/${encodeURIComponent(env.googleCalendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
    invalidateBusyCache();
  } catch (err) {
    log.error("google event löschen fehlgeschlagen", err);
  }
}
