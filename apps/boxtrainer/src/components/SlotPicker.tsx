"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { addDays, formatForDisplay, formatLocalTime, isoWeekdayOf, localDateOf } from "@/lib/time/zoned";
import { cx } from "./ui";

export interface PickedSlot {
  start: string;
  end: string;
  occurrenceId?: string;
  title?: string;
  remaining?: number;
  isFull?: boolean;
}

type Api =
  | { kind: "slots"; slots: { start: string; end: string }[] }
  | { kind: "events"; events: { occurrenceId: string; start: string; end: string; title: string; remaining: number; capacity: number; isFull: boolean }[] };

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}
function monthEnd(first: string): string {
  const [y, m] = first.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return `${first.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Kalender mit echten freien Slots (Einzel) bzw. Terminen mit Restplätzen (Gruppe). */
export function SlotPicker({ offeringSlug, value, onSelect, reloadKey = 0 }: { offeringSlug: string; value: PickedSlot | null; onSelect: (s: PickedSlot) => void; reloadKey?: number }) {
  const today = localDateOf(Date.now());
  const [month, setMonth] = useState(() => monthStart(value ? localDateOf(Date.parse(value.start)) : today));
  const [data, setData] = useState<PickedSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(value ? localDateOf(Date.parse(value.start)) : null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    const from = month < today ? today : month;
    fetch(`/api/availability?offering=${encodeURIComponent(offeringSlug)}&from=${from}&to=${monthEnd(month)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Api>) : Promise.reject(new Error(String(r.status)))))
      .then((json) => {
        if (cancelled) return;
        const list: PickedSlot[] =
          json.kind === "slots"
            ? json.slots
            : json.events.map((e) => ({ start: e.start, end: e.end, occurrenceId: e.occurrenceId, title: e.title, remaining: e.remaining, isFull: e.isFull }));
        setData(list);
      })
      .catch(() => !cancelled && setError("Termine konnten nicht geladen werden. Bitte lade die Seite neu."));
    return () => {
      cancelled = true;
    };
  }, [offeringSlug, month, today, reloadKey]);

  const byDay = useMemo(() => {
    const m = new Map<string, PickedSlot[]>();
    for (const s of data ?? []) {
      const d = localDateOf(Date.parse(s.start));
      m.set(d, [...(m.get(d) ?? []), s]);
    }
    return m;
  }, [data]);

  // Ersten Tag mit Slots automatisch wählen, wenn noch nichts gewählt ist
  useEffect(() => {
    if (data && (!day || !byDay.has(day) || monthStart(day) !== month)) {
      const first = [...byDay.keys()].sort()[0];
      setDay(first ?? null);
    }
  }, [data, byDay, day, month]);

  const first = month;
  const lead = isoWeekdayOf(first) - 1;
  const days: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = first; d <= monthEnd(first); d = addDays(d, 1)) days.push(d);

  const canPrev = month > monthStart(today);
  const monthLabel = formatForDisplay(Date.parse(`${month}T12:00:00Z`), "Europe/Berlin", { month: "long", year: "numeric" });
  const slots = day ? (byDay.get(day) ?? []) : [];

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setMonth(monthStart(addDays(month, -1)))} disabled={!canPrev} className="rounded-lg p-2 hover:bg-surface-2 disabled:opacity-30" aria-label="Vorheriger Monat">
            <ChevronLeft aria-hidden />
          </button>
          <p className="font-semibold capitalize" aria-live="polite">{monthLabel}</p>
          <button type="button" onClick={() => setMonth(monthStart(addDays(monthEnd(month), 1)))} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Nächster Monat">
            <ChevronRight aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden>
          {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Kalender">
          {days.map((d, i) => {
            if (!d) return <div key={`x${i}`} />;
            const has = byDay.has(d);
            const selected = d === day;
            return (
              <button
                key={d}
                type="button"
                disabled={!has}
                onClick={() => setDay(d)}
                aria-pressed={selected}
                aria-label={`${formatForDisplay(Date.parse(`${d}T12:00:00Z`), "Europe/Berlin", { weekday: "long", day: "numeric", month: "long" })}${has ? ", Termine frei" : ", keine Termine"}`}
                className={cx(
                  "aspect-square rounded-lg text-sm transition-colors",
                  selected ? "bg-accent font-bold text-white" : has ? "bg-surface-2 font-semibold hover:bg-line" : "text-zinc-600",
                  d === today && !selected && "ring-1 ring-muted",
                )}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        {data === null && !error && <p className="mt-3 text-sm text-muted" aria-live="polite">Lade freie Termine …</p>}
        {data && data.length === 0 && <p className="mt-3 text-sm text-muted">In diesem Monat ist nichts mehr frei – schau in den nächsten Monat.</p>}
        {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}
      </div>

      <div>
        <p className="mb-3 font-semibold">
          {day ? formatForDisplay(Date.parse(`${day}T12:00:00Z`), "Europe/Berlin", { weekday: "long", day: "numeric", month: "long" }) : "Tag wählen"}
        </p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
          {slots.map((s) => {
            const selected = value?.start === s.start && value?.occurrenceId === s.occurrenceId;
            return (
              <li key={`${s.start}${s.occurrenceId ?? ""}`} className={s.occurrenceId ? "col-span-2 sm:col-span-3 md:col-span-2 lg:col-span-3" : ""}>
                <button
                  type="button"
                  onClick={() => onSelect(s)}
                  aria-pressed={selected}
                  className={cx(
                    "w-full rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                    selected ? "border-accent bg-accent/15" : "border-line bg-surface-2 hover:border-muted",
                  )}
                >
                  <span className="block text-base font-semibold">
                    {formatLocalTime(Date.parse(s.start))}
                    {s.occurrenceId && <> – {formatLocalTime(Date.parse(s.end))}</>}
                  </span>
                  {s.occurrenceId && (
                    <span className="mt-0.5 flex items-center justify-between gap-2 text-muted">
                      <span>{s.title}</span>
                      <span className={s.isFull ? "text-amber-400" : s.remaining! <= 3 ? "text-accent" : ""}>
                        {s.isFull ? "Ausgebucht · Warteliste" : `noch ${s.remaining} ${s.remaining === 1 ? "Platz" : "Plätze"}`}
                      </span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted">Alle Zeiten in deutscher Zeit (Europe/Berlin).</p>
      </div>
    </div>
  );
}
