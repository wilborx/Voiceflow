/**
 * Zeitzonen-Hilfen ohne externe Abhängigkeiten (Intl-basiert).
 *
 * Grundsatz: gespeichert und gerechnet wird in UTC (epoch ms / ISO-Strings mit "Z"),
 * Wandzeit (lokale Uhrzeit) gibt es nur an den Rändern: Verfügbarkeitsregeln
 * ("Mo 17:00–21:00") und Anzeige.
 */

export const DEFAULT_TZ = "Europe/Berlin";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Kalenderdatum ohne Uhrzeit, Format YYYY-MM-DD. */
export type LocalDate = string;

export interface LocalDateTimeParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  /** ISO-Wochentag: 1 = Montag … 7 = Sonntag */
  isoWeekday: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Zerlegt einen UTC-Zeitpunkt in die Wandzeit der Zone. */
export function toZonedParts(utcMs: number, tz: string = DEFAULT_TZ): LocalDateTimeParts & { second: number } {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(new Date(utcMs))) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    isoWeekday: WEEKDAYS[out.weekday ?? ""] ?? 0,
  };
}

/** Offset der Zone zum Zeitpunkt utcMs in ms (Berlin: +1h im Winter, +2h im Sommer). */
export function tzOffsetMs(utcMs: number, tz: string = DEFAULT_TZ): number {
  const p = toZonedParts(utcMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const flooredUtc = Math.floor(utcMs / 1000) * 1000;
  return asUtc - flooredUtc;
}

export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Ungültiges Datum: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  // Über Date.UTC normalisieren (z. B. day = 32 → nächster Monat)
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  return formatLocalDate(year, month, day + days);
}

/** ISO-Wochentag eines Kalenderdatums (zeitzonenunabhängig). */
export function isoWeekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  const wd = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = So
  return wd === 0 ? 7 : wd;
}

/** Kalenderdatum (in der Zone) eines UTC-Zeitpunkts. */
export function localDateOf(utcMs: number, tz: string = DEFAULT_TZ): LocalDate {
  const p = toZonedParts(utcMs, tz);
  return formatLocalDate(p.year, p.month, p.day);
}

/**
 * Wandzeit → UTC. `minuteOfDay` darf 0…1440 sein (1440 = Mitternacht am Folgetag).
 *
 * Disambiguierung wie Temporal "compatible":
 *  - Uhr wird zurückgestellt (Zeit existiert doppelt): früherer Zeitpunkt.
 *  - Uhr wird vorgestellt (Zeit existiert nicht): um die Lücke nach vorne verschoben
 *    (02:30 am Umstellungstag im März → 03:30 MESZ).
 */
export function zonedToUtc(date: LocalDate, minuteOfDay: number, tz: string = DEFAULT_TZ): number {
  const { year, month, day } = parseLocalDate(date);
  const naive = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  // Berlin hat höchstens eine Umstellung pro Tag → Offsets ±1 Tag decken beide Seiten ab.
  const before = tzOffsetMs(naive - DAY_MS, tz);
  const after = tzOffsetMs(naive + DAY_MS, tz);
  const candidates = [...new Set([naive - before, naive - after])]
    .filter((c) => c + tzOffsetMs(c, tz) === naive)
    .sort((a, b) => a - b);
  if (candidates.length > 0) return candidates[0]!;
  // Lücke: mit dem Offset vor der Umstellung rechnen → Zeitpunkt nach der Lücke.
  return naive - before;
}

/** Beginn des Kalendertags (00:00 Wandzeit) als UTC. */
export function startOfLocalDay(date: LocalDate, tz: string = DEFAULT_TZ): number {
  return zonedToUtc(date, 0, tz);
}

const displayCache = new Map<string, Intl.DateTimeFormat>();

/** Anzeige in deutscher Schreibweise, z. B. "Mo., 30.03.2026, 18:00". */
export function formatForDisplay(
  utcMs: number,
  tz: string = DEFAULT_TZ,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  const key = `${tz}|${JSON.stringify(options)}`;
  let f = displayCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("de-DE", { ...options, timeZone: tz });
    displayCache.set(key, f);
  }
  return f.format(new Date(utcMs));
}

/** "HH:MM" in der Zone. */
export function formatLocalTime(utcMs: number, tz: string = DEFAULT_TZ): string {
  const p = toZonedParts(utcMs, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}
