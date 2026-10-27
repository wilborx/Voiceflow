import { describe, expect, it } from "vitest";
import { formatLocalTime, localDateOf, zonedToUtc } from "../time/zoned";
import {
  computeEventSlots,
  computeSingleSlots,
  computeWorkingWindows,
  isSingleSlotAvailable,
  type SingleSlotInput,
} from "./engine";
import { expandOccurrences } from "./recurrence";
import type { AvailabilityRule, EventOccurrence, ExistingBooking, OfferingRules } from "./types";

/** Berliner Wandzeit → UTC-ms */
function at(date: string, hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedToUtc(date, h! * 60 + m!);
}
const hm = (h: number, m = 0) => h * 60 + m;

/** Slots eines Tages als "HH:MM" in Berlin */
function times(slots: { start: number }[], date: string): string[] {
  return slots.filter((s) => localDateOf(s.start) === date).map((s) => formatLocalTime(s.start));
}

const WEEK: AvailabilityRule[] = [
  ...[1, 2, 3, 4, 5].map((d) => ({ isoWeekday: d, startMinute: hm(17), endMinute: hm(21) })),
  { isoWeekday: 6, startMinute: hm(10), endMinute: hm(14) },
];

const ONE_ON_ONE: OfferingRules = {
  durationMin: 60,
  bufferBeforeMin: 15,
  bufferAfterMin: 15,
  minNoticeMin: 12 * 60,
  maxHorizonDays: 60,
  slotStepMin: 30,
};
const NO_BUFFER: OfferingRules = { ...ONE_ON_ONE, bufferBeforeMin: 0, bufferAfterMin: 0 };

// Montag, 06.07.2026, 08:00 Berlin
const NOW = at("2026-07-06", "08:00");
const TUE = "2026-07-07";

function input(over: Partial<SingleSlotInput> = {}): SingleSlotInput {
  return {
    offering: ONE_ON_ONE,
    rules: WEEK,
    exceptions: [],
    bookings: [],
    occurrences: [],
    externalBusy: [],
    now: NOW,
    ...over,
  };
}

function booking(date: string, from: string, to: string, over: Partial<ExistingBooking> = {}): ExistingBooking {
  return {
    startsAt: at(date, from),
    endsAt: at(date, to),
    bufferBeforeMin: 15,
    bufferAfterMin: 15,
    status: "confirmed",
    ...over,
  };
}

describe("Grundraster", () => {
  it("erzeugt 30-Min-Raster, Session muss ins Fenster passen", () => {
    expect(times(computeSingleSlots(input()), TUE)).toEqual([
      "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
    ]);
    expect(times(computeSingleSlots(input()), "2026-07-11")).toEqual([
      "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00",
    ]);
    expect(times(computeSingleSlots(input()), "2026-07-12")).toEqual([]); // Sonntag
  });

  it("Mindestvorlauf: 12 Std. ab Mo 08:00 → frühestens Mo 20:00 (inklusive)", () => {
    expect(times(computeSingleSlots(input()), "2026-07-06")).toEqual(["20:00"]);
  });

  it("Buchungshorizont: nichts nach jetzt + 60 Tage", () => {
    const slots = computeSingleSlots(input());
    const last = slots[slots.length - 1]!;
    expect(last.start).toBeLessThanOrEqual(NOW + 60 * 86_400_000);
    // Horizontende ist Fr 04.09. 08:00 → der letzte Abendslot liegt am Do 03.09.
    expect(localDateOf(last.start)).toBe("2026-09-03");
  });

  it("überlappende Regeln werden verschmolzen, keine doppelten Slots", () => {
    const rules: AvailabilityRule[] = [
      { isoWeekday: 2, startMinute: hm(17), endMinute: hm(19) },
      { isoWeekday: 2, startMinute: hm(18), endMinute: hm(21) },
    ];
    expect(times(computeSingleSlots(input({ rules })), TUE)).toHaveLength(7);
  });

  it("mehrere getrennte Fenster pro Tag", () => {
    const rules: AvailabilityRule[] = [
      { isoWeekday: 2, startMinute: hm(7), endMinute: hm(9) },
      { isoWeekday: 2, startMinute: hm(18), endMinute: hm(19, 30) },
    ];
    expect(times(computeSingleSlots(input({ rules })), TUE)).toEqual([
      "07:00", "07:30", "08:00", "18:00", "18:30",
    ]);
  });
});

describe("Puffer", () => {
  it("Puffer beider Termine addieren sich (15 + 15 Min. Abstand)", () => {
    const bookings = [booking(TUE, "18:00", "19:00")];
    // belegt 17:45–19:15 → 17:00 (16:45–18:15) kollidiert, 19:30 (19:15–) passt exakt
    expect(times(computeSingleSlots(input({ bookings })), TUE)).toEqual(["19:30", "20:00"]);
  });

  it("ohne Puffer passen Termine direkt aneinander", () => {
    const bookings = [booking(TUE, "18:00", "19:00", { bufferBeforeMin: 0, bufferAfterMin: 0 })];
    expect(times(computeSingleSlots(input({ offering: NO_BUFFER, bookings })), TUE)).toEqual([
      "17:00", "19:00", "19:30", "20:00",
    ]);
  });

  it("Puffer dürfen über das Arbeitsfenster hinausragen, die Session nicht", () => {
    const offering = { ...ONE_ON_ONE, bufferBeforeMin: 60, bufferAfterMin: 60 };
    const slots = times(computeSingleSlots(input({ offering })), TUE);
    expect(slots[0]).toBe("17:00");
    expect(slots[slots.length - 1]).toBe("20:00");
  });

  it("Puffer-Snapshot der bestehenden Buchung zählt, nicht der des neuen Angebots", () => {
    const bookings = [booking(TUE, "18:00", "19:00", { bufferBeforeMin: 0, bufferAfterMin: 60 })];
    // belegt 18:00–20:00; neue Session ohne Puffer
    expect(times(computeSingleSlots(input({ offering: NO_BUFFER, bookings })), TUE)).toEqual([
      "17:00", "20:00",
    ]);
  });
});

describe("Google Free/Busy", () => {
  it("externe Termine werden inkl. eigenem Puffer ausgeschlossen", () => {
    const externalBusy = [{ start: at(TUE, "17:00"), end: at(TUE, "17:30") }];
    expect(times(computeSingleSlots(input({ externalBusy })), TUE)).toEqual([
      "18:00", "18:30", "19:00", "19:30", "20:00",
    ]);
  });

  it("ganztägiger externer Termin sperrt den Tag", () => {
    const externalBusy = [{ start: at(TUE, "00:00"), end: at("2026-07-08", "00:00") }];
    expect(times(computeSingleSlots(input({ externalBusy })), TUE)).toEqual([]);
  });
});

describe("Holds (pending)", () => {
  const holdUntil = (h: number) => NOW + h * 3_600_000;

  it("aktiver Hold blockiert den Slot", () => {
    const bookings = [booking(TUE, "18:00", "19:00", { status: "pending", holdExpiresAt: holdUntil(24) })];
    expect(times(computeSingleSlots(input({ bookings })), TUE)).not.toContain("18:00");
  });

  it("abgelaufener Hold gibt den Slot frei – auch wenn der Cron noch nicht lief", () => {
    const bookings = [booking(TUE, "18:00", "19:00", { status: "pending", holdExpiresAt: holdUntil(-1) })];
    expect(times(computeSingleSlots(input({ bookings })), TUE)).toHaveLength(7);
  });

  it("Hold-Ende exakt jetzt = abgelaufen", () => {
    const bookings = [booking(TUE, "18:00", "19:00", { status: "pending", holdExpiresAt: NOW })];
    expect(times(computeSingleSlots(input({ bookings })), TUE)).toContain("18:00");
  });

  it.each(["declined", "expired", "cancelled"] as const)("Status %s blockiert nicht", (status) => {
    const bookings = [booking(TUE, "18:00", "19:00", { status })];
    expect(times(computeSingleSlots(input({ bookings })), TUE)).toHaveLength(7);
  });
});

describe("Ausnahmen", () => {
  it("Urlaub (Datumsbereich) sperrt ganze Tage", () => {
    const exceptions = [{ startDate: "2026-07-13", endDate: "2026-07-17", kind: "blocked" as const }];
    const slots = computeSingleSlots(input({ exceptions }));
    for (const d of ["2026-07-13", "2026-07-15", "2026-07-17"]) expect(times(slots, d)).toEqual([]);
    expect(times(slots, "2026-07-18")).toHaveLength(7);
  });

  it("teilweise Sperre", () => {
    const exceptions = [
      { startDate: TUE, endDate: TUE, kind: "blocked" as const, startMinute: hm(17), endMinute: hm(18) },
    ];
    expect(times(computeSingleSlots(input({ exceptions })), TUE)[0]).toBe("18:00");
  });

  it("Zusatztag (Sonntag) und Zusatzfenster im Urlaub", () => {
    const exceptions = [
      { startDate: "2026-07-12", endDate: "2026-07-12", kind: "extra" as const, startMinute: hm(10), endMinute: hm(12) },
      { startDate: "2026-07-13", endDate: "2026-07-17", kind: "blocked" as const },
      { startDate: "2026-07-15", endDate: "2026-07-15", kind: "extra" as const, startMinute: hm(9), endMinute: hm(10) },
    ];
    const slots = computeSingleSlots(input({ exceptions }));
    expect(times(slots, "2026-07-12")).toEqual(["10:00", "10:30", "11:00"]);
    expect(times(slots, "2026-07-15")).toEqual(["09:00"]);
  });
});

describe("Sommerzeit", () => {
  const night: AvailabilityRule[] = [{ isoWeekday: 7, startMinute: hm(1), endMinute: hm(5) }];
  const hourly: OfferingRules = { ...NO_BUFFER, slotStepMin: 60, minNoticeMin: 0, maxHorizonDays: 365 };

  it("Umstellung März: 01–05 Uhr hat nur 3 echte Stunden", () => {
    const slots = computeSingleSlots(
      input({ rules: night, offering: hourly, now: at("2026-03-20", "12:00") }),
    );
    expect(times(slots, "2026-03-29")).toEqual(["01:00", "03:00", "04:00"]);
  });

  it("Umstellung Oktober: 01–05 Uhr hat 5 echte Stunden (02:00 doppelt)", () => {
    const slots = computeSingleSlots(
      input({ rules: night, offering: hourly, now: at("2026-10-20", "12:00") }),
    );
    expect(times(slots, "2026-10-25")).toEqual(["01:00", "02:00", "02:00", "03:00", "04:00"]);
  });

  it("18:00 bleibt 18:00 Wandzeit vor und nach der Umstellung", () => {
    const now = at("2026-10-20", "08:00");
    const slots = computeSingleSlots(input({ now }));
    const fri = slots.find((s) => localDateOf(s.start) === "2026-10-23")!;
    const mon = slots.find((s) => localDateOf(s.start) === "2026-10-26")!;
    expect(new Date(fri.start).toISOString()).toBe("2026-10-23T15:00:00.000Z"); // MESZ
    expect(new Date(mon.start).toISOString()).toBe("2026-10-26T16:00:00.000Z"); // MEZ
    expect(formatLocalTime(fri.start)).toBe("17:00");
    expect(formatLocalTime(mon.start)).toBe("17:00");
  });

  it("Mindestvorlauf über die Umstellung ist echte Zeit (12 h, nicht Wandzeit)", () => {
    // Sa 24.10. 20:00 MESZ + 12 h = So 25.10. 07:00 MEZ
    const rules: AvailabilityRule[] = [{ isoWeekday: 7, startMinute: hm(6), endMinute: hm(9) }];
    const slots = computeSingleSlots(
      input({ rules, offering: { ...NO_BUFFER, durationMin: 30 }, now: at("2026-10-24", "20:00") }),
    );
    expect(times(slots, "2026-10-25")[0]).toBe("07:00");
  });

  it("Arbeitsfenster eines Sommerzeit-Tags in UTC", () => {
    const [w] = computeWorkingWindows({ rules: WEEK, exceptions: [], fromDate: TUE, toDate: TUE });
    expect(new Date(w!.start).toISOString()).toBe("2026-07-07T15:00:00.000Z");
    expect(new Date(w!.end).toISOString()).toBe("2026-07-07T19:00:00.000Z");
  });
});

describe("Gruppen", () => {
  const occ = (id: string, date: string, from: string, to: string, capacity = 8): EventOccurrence => ({
    id,
    startsAt: at(date, from),
    endsAt: at(date, to),
    capacity,
    bufferBeforeMin: 0,
    bufferAfterMin: 15,
    status: "scheduled",
  });
  const groupOffering = { minNoticeMin: 60, maxHorizonDays: 60 };
  const seat = (occurrenceId: string, over: Partial<ExistingBooking> = {}): ExistingBooking => ({
    ...booking(TUE, "18:00", "19:00"),
    occurrenceId,
    ...over,
  });

  it("Restplätze zählen bestätigte Buchungen und aktive Holds (inkl. Sitzplätze)", () => {
    const bookings = [
      seat("g1"),
      seat("g1"),
      seat("g1", { seats: 2 }),
      seat("g1", { status: "pending", holdExpiresAt: NOW + 3_600_000 }),
      seat("g1", { status: "pending", holdExpiresAt: NOW - 1 }),
      seat("g1", { status: "cancelled" }),
      seat("g2"),
    ];
    const [g1] = computeEventSlots({
      offering: groupOffering,
      occurrences: [occ("g1", TUE, "18:00", "19:00")],
      bookings,
      now: NOW,
    });
    expect(g1).toMatchObject({ booked: 5, remaining: 3, isFull: false });
  });

  it("volle Gruppe → isFull (Warteliste), Überbuchung wird als 0 Restplätze angezeigt", () => {
    const bookings = [seat("g1"), seat("g1"), seat("g1")];
    const [g1] = computeEventSlots({
      offering: groupOffering,
      occurrences: [occ("g1", TUE, "18:00", "19:00", 2)],
      bookings,
      now: NOW,
    });
    expect(g1).toMatchObject({ remaining: 0, isFull: true });
  });

  it("abgesagte und zu kurzfristige Termine werden nicht angeboten", () => {
    const cancelled = { ...occ("c", TUE, "18:00", "19:00"), status: "cancelled" as const };
    const tooSoon = occ("s", "2026-07-06", "08:30", "09:30");
    const slots = computeEventSlots({
      offering: groupOffering,
      occurrences: [cancelled, tooSoon, occ("ok", TUE, "18:00", "19:00")],
      bookings: [],
      now: NOW,
    });
    expect(slots.map((s) => s.occurrenceId)).toEqual(["ok"]);
  });

  it("Gruppentermine blockieren den Trainer für Einzeltermine (inkl. Puffer)", () => {
    const occurrences = [occ("g1", TUE, "18:00", "19:00")]; // belegt 18:00–19:15
    expect(times(computeSingleSlots(input({ offering: NO_BUFFER, occurrences })), TUE)).toEqual([
      "17:00", "19:30", "20:00",
    ]);
  });

  it("Gruppen-Buchungen selbst blockieren keine Einzelslots doppelt", () => {
    const bookings = [seat("g1")];
    expect(times(computeSingleSlots(input({ bookings })), TUE)).toHaveLength(7);
  });
});

describe("isSingleSlotAvailable (Server-Prüfung)", () => {
  it("akzeptiert freien Rasterslot, lehnt belegten und krummen Start ab", () => {
    const i = input({ bookings: [booking(TUE, "18:00", "19:00")] });
    expect(isSingleSlotAvailable(i, at(TUE, "20:00"))).toBe(true);
    expect(isSingleSlotAvailable(i, at(TUE, "18:30"))).toBe(false);
    expect(isSingleSlotAvailable(i, at(TUE, "20:10"))).toBe(false);
    expect(isSingleSlotAvailable(i, at("2026-07-12", "11:00"))).toBe(false);
  });
});

describe("expandOccurrences", () => {
  it("wöchentlich 18:00 Wandzeit über die Zeitumstellung", () => {
    const occ = expandOccurrences(
      { firstDate: "2026-10-13", startMinute: hm(18), durationMin: 90, recurrence: "weekly", recurrenceUntil: "2026-11-03" },
      "2026-10-01",
      "2026-12-31",
    );
    expect(occ.map((o) => new Date(o.startsAt).toISOString())).toEqual([
      "2026-10-13T16:00:00.000Z",
      "2026-10-20T16:00:00.000Z",
      "2026-10-27T17:00:00.000Z",
      "2026-11-03T17:00:00.000Z",
    ]);
    expect(occ[0]!.endsAt - occ[0]!.startsAt).toBe(90 * 60_000);
  });

  it("Bereichsfilter, ausgelassene Daten und Einzeltermin", () => {
    const weekly = expandOccurrences(
      { firstDate: "2026-10-13", startMinute: hm(18), durationMin: 60, recurrence: "weekly", skipDates: ["2026-10-27"] },
      "2026-10-20",
      "2026-11-10",
    );
    expect(weekly.map((o) => o.date)).toEqual(["2026-10-20", "2026-11-03", "2026-11-10"]);

    const once = expandOccurrences(
      { firstDate: "2026-11-14", startMinute: hm(11), durationMin: 180, recurrence: "none" },
      "2026-11-01",
      "2026-11-30",
    );
    expect(once).toHaveLength(1);
  });
});
