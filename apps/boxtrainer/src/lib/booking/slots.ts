import "server-only";
import {
  computeEventSlots,
  computeSingleSlots,
  expandOccurrences,
  type EventSlot,
  type SingleSlotInput,
  type Slot,
} from "../availability";
import { sql } from "../db/client";
import {
  getSettings,
  listBookingsForAvailability,
  listExceptions,
  listOccurrences,
  listRules,
  listSpecialEvents,
} from "../db/queries";
import type { Offering } from "../db/types";
import { googleBusy } from "../google";
import { log } from "../server/log";
import { DAY_MS, addDays, localDateOf, startOfLocalDay } from "../time/zoned";

/** Alle Eingaben für Einzelslots eines Zeitraums laden (optional ohne eine Buchung – beim Verschieben). */
export async function loadSingleInput(offering: Offering, fromDate: string, toDate: string, excludeBookingId?: string): Promise<SingleSlotInput> {
  const settings = await getSettings();
  const tz = settings.timezone;
  const from = new Date(startOfLocalDay(fromDate, tz) - DAY_MS);
  const to = new Date(startOfLocalDay(addDays(toDate, 1), tz) + DAY_MS);
  const [rules, exceptions, bookings, occurrences, busy] = await Promise.all([
    listRules(),
    listExceptions(),
    listBookingsForAvailability(from, to),
    listOccurrences(from, to),
    googleBusy(from, to),
  ]);
  return {
    offering,
    rules,
    exceptions,
    bookings: bookings.filter((b) => b.id !== excludeBookingId),
    occurrences: occurrences.map((o) => ({ ...o, startsAt: o.startsAt.getTime(), endsAt: o.endsAt.getTime() })),
    externalBusy: busy,
    now: Date.now(),
    tz,
    fromDate,
    toDate,
  };
}

export async function getSingleSlots(offering: Offering, fromDate: string, toDate: string): Promise<Slot[]> {
  return computeSingleSlots(await loadSingleInput(offering, fromDate, toDate));
}

export async function getEventSlots(offering: Offering, fromDate: string, toDate: string): Promise<(EventSlot & { title: string })[]> {
  const settings = await getSettings();
  await ensureOccurrences();
  const from = new Date(startOfLocalDay(fromDate, settings.timezone));
  const to = new Date(startOfLocalDay(addDays(toDate, 1), settings.timezone));
  const [occurrences, bookings] = await Promise.all([
    listOccurrences(from, to, offering.id),
    listBookingsForAvailability(from, to),
  ]);
  const titles = new Map(occurrences.map((o) => [o.id, o.title]));
  return computeEventSlots({
    offering,
    occurrences: occurrences.map((o) => ({ ...o, startsAt: o.startsAt.getTime(), endsAt: o.endsAt.getTime() })),
    bookings,
    now: Date.now(),
  }).map((s) => ({ ...s, title: titles.get(s.occurrenceId) ?? offering.name }));
}

const g = globalThis as unknown as { __btOccAt?: number };

/**
 * Wiederkehrende Gruppen-/Sondertermine als konkrete Termine anlegen (idempotent).
 * Kollidiert ein Termin mit einer bestehenden Einzelbuchung, wird er übersprungen.
 */
export async function ensureOccurrences(force = false): Promise<void> {
  if (!force && g.__btOccAt && Date.now() - g.__btOccAt < 10 * 60_000) return;
  g.__btOccAt = Date.now();
  const settings = await getSettings();
  const today = localDateOf(Date.now(), settings.timezone);
  const events = await listSpecialEvents();
  const offerings = await sql<{ id: string; bufferBeforeMin: number; bufferAfterMin: number; maxHorizonDays: number }>(
    `select id, buffer_before_min as "bufferBeforeMin", buffer_after_min as "bufferAfterMin", max_horizon_days as "maxHorizonDays" from offerings`,
  );
  const byId = new Map(offerings.map((o) => [o.id, o]));
  for (const e of events.filter((x) => x.isActive)) {
    const o = byId.get(e.offeringId);
    const planned = expandOccurrences(e, today, addDays(today, o?.maxHorizonDays ?? 60), settings.timezone);
    for (const p of planned) {
      try {
        await sql(
          `insert into event_occurrences (special_event_id, starts_at, ends_at, capacity, buffer_before_min, buffer_after_min)
           values ($1, $2, $3, $4, $5, $6) on conflict (special_event_id, starts_at) do nothing`,
          [e.id, new Date(p.startsAt), new Date(p.endsAt), e.capacity, o?.bufferBeforeMin ?? 0, o?.bufferAfterMin ?? 0],
        );
      } catch (err) {
        log.warn("gruppentermin übersprungen (konflikt)", { eventId: e.id, date: p.date });
      }
    }
  }
}

/** Nach dem Bearbeiten einer Vorlage: zukünftige Termine ohne Buchungen neu erzeugen. */
export async function regenerateOccurrences(specialEventId: string): Promise<void> {
  await sql(
    `delete from event_occurrences x
      where x.special_event_id = $1 and x.starts_at > now()
        and not exists (select 1 from bookings b where b.occurrence_id = x.id)
        and not exists (select 1 from waitlist_entries w where w.occurrence_id = x.id)`,
    [specialEventId],
  );
  await sql(
    `update event_occurrences x set capacity = e.capacity
       from special_events e where e.id = x.special_event_id and x.special_event_id = $1 and x.starts_at > now()`,
    [specialEventId],
  );
  await ensureOccurrences(true);
}

/** Alternativvorschläge für eine Anfrage: freie Slots rund um den Wunschtermin (ohne die Anfrage selbst). */
export async function suggestAlternatives(offering: Offering, bookingId: string, around: Date, limit = 12): Promise<Slot[]> {
  const day = localDateOf(around.getTime());
  const today = localDateOf(Date.now());
  const from = addDays(day, -3) < today ? today : addDays(day, -3);
  const input = await loadSingleInput(offering, from, addDays(day, 10), bookingId);
  return computeSingleSlots(input)
    .filter((s) => s.start !== around.getTime())
    .sort((a, b) => Math.abs(a.start - around.getTime()) - Math.abs(b.start - around.getTime()))
    .slice(0, limit)
    .sort((a, b) => a.start - b.start);
}
