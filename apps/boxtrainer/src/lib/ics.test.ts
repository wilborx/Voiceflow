import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

describe("buildIcs", () => {
  const ics = buildIcs({
    uid: "abc@boxtrainer",
    start: new Date("2026-03-30T16:00:00Z"),
    end: new Date("2026-03-30T17:00:00Z"),
    title: "Boxtraining; 1:1, mit Trainer",
    description: "Zeile 1\nZeile 2",
    location: "Gym, Straße 1, 10115 Berlin",
  });

  it("enthält UTC-Zeiten und CRLF", () => {
    expect(ics).toContain("DTSTART:20260330T160000Z\r\n");
    expect(ics).toContain("DTEND:20260330T170000Z\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escaped Sonderzeichen", () => {
    expect(ics).toContain("SUMMARY:Boxtraining\; 1:1\\, mit Trainer");
    expect(ics).toContain("DESCRIPTION:Zeile 1\\nZeile 2");
  });

  it("faltet lange Zeilen auf ≤ 75 Oktette", () => {
    const long = buildIcs({ uid: "x", start: new Date(), end: new Date(), title: "Ä".repeat(100) });
    for (const line of long.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});
