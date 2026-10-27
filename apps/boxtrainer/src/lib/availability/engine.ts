/**
 * Verfügbarkeits-Engine (reine Funktionen, keine I/O).
 *
 * Puffer-Semantik – identisch zum Exclusion-Constraint in der DB:
 *   Jede Buchung belegt [start − Puffer davor, ende + Puffer danach).
 *   Zwei Einzelbuchungen kollidieren, wenn sich diese belegten Bereiche überschneiden.
 *   Zwischen zwei Terminen liegt also mindestens Puffer-danach(A) + Puffer-davor(B).
 *   Externe Termine (Google Free/Busy) haben keinen eigenen Puffer.
 *
 * Nur die eigentliche Session (ohne Puffer) muss in ein Verfügbarkeitsfenster passen.
 */
import {
  DAY_MS,
  DEFAULT_TZ,
  MINUTE_MS,
  addDays,
  isoWeekdayOf,
  localDateOf,
  zonedToUtc,
  type LocalDate,
} from "../time/zoned";
import { type Interval, mergeIntervals, overlaps, subtractIntervals } from "./intervals";
import type {
  AvailabilityException,
  AvailabilityRule,
  EventOccurrence,
  EventSlot,
  ExistingBooking,
  OfferingRules,
  Slot,
} from "./types";

/** Blockiert diese Buchung (noch) Zeit/Plätze? */
export function isBlocking(b: ExistingBooking, now: number): boolean {
  switch (b.status) {
    case "confirmed":
    case "completed":
    case "no_show":
      return true;
    case "pending":
      // Hold läuft ab → Slot wird wieder frei, auch bevor der Cron den Status umstellt.
      return b.holdExpiresAt == null || b.holdExpiresAt > now;
    default:
      return false;
  }
}

export function bufferedRange(startsAt: number, endsAt: number, beforeMin: number, afterMin: number): Interval {
  return { start: startsAt - beforeMin * MINUTE_MS, end: endsAt + afterMin * MINUTE_MS };
}

function inDateRange(date: LocalDate, ex: AvailabilityException): boolean {
  return date >= ex.startDate && date <= ex.endDate;
}

function windowOn(date: LocalDate, startMinute: number, endMinute: number, tz: string): Interval {
  return { start: zonedToUtc(date, startMinute, tz), end: zonedToUtc(date, endMinute, tz) };
}

/**
 * Arbeitsfenster (UTC) für alle Kalendertage von `fromDate` bis `toDate` (inklusive):
 * Wochenregeln − Sperren + Zusatzfenster.
 */
export function computeWorkingWindows(params: {
  rules: readonly AvailabilityRule[];
  exceptions: readonly AvailabilityException[];
  fromDate: LocalDate;
  toDate: LocalDate;
  tz?: string;
}): Interval[] {
  const tz = params.tz ?? DEFAULT_TZ;
  const result: Interval[] = [];
  for (let date = params.fromDate; date <= params.toDate; date = addDays(date, 1)) {
    const weekday = isoWeekdayOf(date);
    const base = params.rules
      .filter((r) => r.isoWeekday === weekday)
      .map((r) => windowOn(date, r.startMinute, r.endMinute, tz));

    const todays = params.exceptions.filter((e) => inDateRange(date, e));
    const blocks = todays
      .filter((e) => e.kind === "blocked")
      .map((e) =>
        e.startMinute == null || e.endMinute == null
          ? windowOn(date, 0, 1440, tz)
          : windowOn(date, e.startMinute, e.endMinute, tz),
      );
    const extras = todays
      .filter((e) => e.kind === "extra" && e.startMinute != null && e.endMinute != null)
      .map((e) => windowOn(date, e.startMinute!, e.endMinute!, tz));

    result.push(...subtractIntervals(base, blocks), ...extras);
  }
  return mergeIntervals(result);
}

export interface SingleSlotInput {
  offering: OfferingRules;
  rules: readonly AvailabilityRule[];
  exceptions: readonly AvailabilityException[];
  /** Alle Buchungen im Zeitraum (Einzel und Gruppe) */
  bookings: readonly ExistingBooking[];
  /** Gruppen-/Sondertermine im Zeitraum – blockieren den Trainer für Einzeltermine */
  occurrences: readonly EventOccurrence[];
  /** Belegte Zeiten aus Google Calendar (Free/Busy) */
  externalBusy: readonly Interval[];
  now: number;
  tz?: string;
  /** Optional: Berechnung auf diese Tage einschränken (z. B. eine Kalenderwoche) */
  fromDate?: LocalDate;
  toDate?: LocalDate;
}

/** Freie Slots für Angebote mit Kapazität 1 (1:1, Partner, Probetraining). */
export function computeSingleSlots(input: SingleSlotInput): Slot[] {
  const tz = input.tz ?? DEFAULT_TZ;
  const { offering, now } = input;
  const earliest = now + offering.minNoticeMin * MINUTE_MS;
  const latest = now + offering.maxHorizonDays * DAY_MS;

  const firstDate = maxDate(input.fromDate, localDateOf(earliest, tz));
  const lastDate = minDate(input.toDate, localDateOf(latest, tz));
  if (firstDate > lastDate) return [];

  const windows = computeWorkingWindows({
    rules: input.rules,
    exceptions: input.exceptions,
    fromDate: firstDate,
    toDate: lastDate,
    tz,
  });

  const busy: Interval[] = [
    ...input.bookings
      .filter((b) => b.occurrenceId == null && isBlocking(b, now))
      .map((b) => bufferedRange(b.startsAt, b.endsAt, b.bufferBeforeMin, b.bufferAfterMin)),
    ...input.occurrences
      .filter((o) => o.status === "scheduled")
      .map((o) => bufferedRange(o.startsAt, o.endsAt, o.bufferBeforeMin, o.bufferAfterMin)),
    ...input.externalBusy,
  ];
  const mergedBusy = mergeIntervals(busy);

  const durationMs = offering.durationMin * MINUTE_MS;
  const stepMs = offering.slotStepMin * MINUTE_MS;
  if (durationMs <= 0 || stepMs <= 0) return [];

  const slots: Slot[] = [];
  const seen = new Set<number>();
  for (const w of windows) {
    // Raster ab Fensterbeginn in echter Zeit (UTC). Da Berlin um volle Stunden umstellt,
    // bleibt das Raster auch an Umstellungstagen auf :00/:30 der Wandzeit.
    for (let start = w.start; start + durationMs <= w.end; start += stepMs) {
      if (start < earliest || start > latest || seen.has(start)) continue;
      const end = start + durationMs;
      const occupied = bufferedRange(start, end, offering.bufferBeforeMin, offering.bufferAfterMin);
      if (mergedBusy.some((b) => overlaps(b, occupied))) continue;
      seen.add(start);
      slots.push({ start, end });
    }
  }
  return slots.sort((a, b) => a.start - b.start);
}

/** Server-seitige Prüfung vor dem Insert: ist genau dieser Start buchbar? */
export function isSingleSlotAvailable(input: SingleSlotInput, start: number): boolean {
  const tz = input.tz ?? DEFAULT_TZ;
  // Fenster enden spätestens um 24:00 desselben Tages → der Kalendertag des Starts genügt.
  const day = localDateOf(start, tz);
  return computeSingleSlots({ ...input, fromDate: day, toDate: day }).some((s) => s.start === start);
}

/** Gruppen-/Sondertermine mit Restplätzen. Volle Termine bleiben sichtbar (Warteliste). */
export function computeEventSlots(params: {
  offering: Pick<OfferingRules, "minNoticeMin" | "maxHorizonDays">;
  occurrences: readonly EventOccurrence[];
  bookings: readonly ExistingBooking[];
  now: number;
}): EventSlot[] {
  const { now } = params;
  const earliest = now + params.offering.minNoticeMin * MINUTE_MS;
  const latest = now + params.offering.maxHorizonDays * DAY_MS;

  const booked = new Map<string, number>();
  for (const b of params.bookings) {
    if (!b.occurrenceId || !isBlocking(b, now)) continue;
    booked.set(b.occurrenceId, (booked.get(b.occurrenceId) ?? 0) + (b.seats ?? 1));
  }

  return params.occurrences
    .filter((o) => o.status === "scheduled" && o.startsAt >= earliest && o.startsAt <= latest)
    .map((o) => {
      const count = booked.get(o.id) ?? 0;
      const remaining = Math.max(0, o.capacity - count);
      return {
        occurrenceId: o.id,
        start: o.startsAt,
        end: o.endsAt,
        capacity: o.capacity,
        booked: count,
        remaining,
        isFull: remaining === 0,
      };
    })
    .sort((a, b) => a.start - b.start);
}

function maxDate(a: LocalDate | undefined, b: LocalDate): LocalDate {
  return a && a > b ? a : b;
}

function minDate(a: LocalDate | undefined, b: LocalDate): LocalDate {
  return a && a < b ? a : b;
}
