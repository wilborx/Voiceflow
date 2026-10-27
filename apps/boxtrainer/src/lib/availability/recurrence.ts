import { DEFAULT_TZ, MINUTE_MS, addDays, type LocalDate, zonedToUtc } from "../time/zoned";

/** Vorlage eines Gruppen-/Sondertermins (Spalten aus `special_events`). */
export interface SpecialEventTemplate {
  /** Datum des ersten Termins (Wandzeit) */
  firstDate: LocalDate;
  /** Startzeit in Minuten seit Mitternacht (Wandzeit) */
  startMinute: number;
  durationMin: number;
  recurrence: "none" | "weekly";
  /** Letztes mögliches Datum (inklusive) bei wöchentlicher Wiederholung */
  recurrenceUntil?: LocalDate | null;
  /** Einzelne ausgelassene Daten (z. B. Feiertage) */
  skipDates?: readonly LocalDate[];
}

export interface PlannedOccurrence {
  date: LocalDate;
  startsAt: number;
  endsAt: number;
}

/**
 * Expandiert eine Vorlage in konkrete Termine im Bereich [fromDate, toDate].
 * Wiederholung erfolgt in Wandzeit: "jeden Dienstag 18:00" bleibt 18:00 – auch über die
 * Zeitumstellung hinweg (der UTC-Zeitpunkt verschiebt sich dabei um eine Stunde).
 */
export function expandOccurrences(
  tpl: SpecialEventTemplate,
  fromDate: LocalDate,
  toDate: LocalDate,
  tz: string = DEFAULT_TZ,
): PlannedOccurrence[] {
  const skip = new Set(tpl.skipDates ?? []);
  const out: PlannedOccurrence[] = [];
  const lastDate =
    tpl.recurrence === "none"
      ? tpl.firstDate
      : tpl.recurrenceUntil && tpl.recurrenceUntil < toDate
        ? tpl.recurrenceUntil
        : toDate;
  const stepDays = tpl.recurrence === "weekly" ? 7 : 1;

  for (let date = tpl.firstDate; date <= lastDate; date = addDays(date, stepDays)) {
    if (date < fromDate || date > toDate || skip.has(date)) continue;
    const startsAt = zonedToUtc(date, tpl.startMinute, tz);
    out.push({ date, startsAt, endsAt: startsAt + tpl.durationMin * MINUTE_MS });
  }
  return out;
}
