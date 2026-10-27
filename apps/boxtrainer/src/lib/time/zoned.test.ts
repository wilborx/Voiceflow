import { describe, expect, it } from "vitest";
import {
  addDays,
  formatLocalTime,
  isoWeekdayOf,
  localDateOf,
  tzOffsetMs,
  zonedToUtc,
} from "./zoned";

const iso = (ms: number) => new Date(ms).toISOString();

describe("zonedToUtc (Europe/Berlin)", () => {
  it("Winterzeit = UTC+1", () => {
    expect(iso(zonedToUtc("2026-01-15", 18 * 60))).toBe("2026-01-15T17:00:00.000Z");
  });

  it("Sommerzeit = UTC+2", () => {
    expect(iso(zonedToUtc("2026-07-15", 18 * 60))).toBe("2026-07-15T16:00:00.000Z");
  });

  it("Umstellungstag März: Zeiten vor und nach der Lücke", () => {
    expect(iso(zonedToUtc("2026-03-29", 60))).toBe("2026-03-29T00:00:00.000Z"); // 01:00 MEZ
    expect(iso(zonedToUtc("2026-03-29", 3 * 60))).toBe("2026-03-29T01:00:00.000Z"); // 03:00 MESZ
  });

  it("Umstellungstag März: nicht existierende 02:30 wird auf 03:30 MESZ verschoben", () => {
    const t = zonedToUtc("2026-03-29", 150);
    expect(iso(t)).toBe("2026-03-29T01:30:00.000Z");
    expect(formatLocalTime(t)).toBe("03:30");
  });

  it("Umstellungstag Oktober: doppelte 02:30 → frühere (MESZ)", () => {
    expect(iso(zonedToUtc("2026-10-25", 150))).toBe("2026-10-25T00:30:00.000Z");
  });

  it("24:00 = Mitternacht des Folgetags", () => {
    expect(zonedToUtc("2026-03-28", 1440)).toBe(zonedToUtc("2026-03-29", 0));
  });

  it("Roundtrip für jede Viertelstunde eines Jahres außerhalb der Lücke", () => {
    for (let d = "2026-01-01"; d <= "2026-12-31"; d = addDays(d, 1)) {
      for (const m of [0, 15 * 60 + 45, 23 * 60 + 45]) {
        const t = zonedToUtc(d, m);
        expect(localDateOf(t)).toBe(d);
        expect(formatLocalTime(t)).toBe(
          `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
        );
      }
    }
  });
});

describe("Hilfsfunktionen", () => {
  it("tzOffsetMs", () => {
    expect(tzOffsetMs(Date.UTC(2026, 0, 1))).toBe(3_600_000);
    expect(tzOffsetMs(Date.UTC(2026, 6, 1))).toBe(7_200_000);
  });

  it("isoWeekdayOf / addDays über Monats- und Jahresgrenzen", () => {
    expect(isoWeekdayOf("2026-10-26")).toBe(1); // Montag
    expect(isoWeekdayOf("2026-11-01")).toBe(7); // Sonntag
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("localDateOf: kurz vor Mitternacht Berlin ist in UTC noch Vortag", () => {
    expect(localDateOf(Date.parse("2026-07-14T22:30:00Z"))).toBe("2026-07-15");
  });
});
