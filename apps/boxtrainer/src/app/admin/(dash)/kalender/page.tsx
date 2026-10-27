import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/bits";
import { cx } from "@/components/ui";
import { listBookings, listOccurrences } from "@/lib/db/queries";
import { addDays, formatForDisplay, formatLocalTime, isoWeekdayOf, localDateOf, startOfLocalDay } from "@/lib/time/zoned";

interface Item {
  id: string;
  href: string;
  start: Date;
  end: Date;
  title: string;
  sub: string;
  color: string;
  pending: boolean;
}

export default async function KalenderPage({ searchParams }: { searchParams: Promise<{ ansicht?: string; datum?: string }> }) {
  const q = await searchParams;
  const view = q.ansicht === "monat" ? "monat" : "woche";
  const today = localDateOf(Date.now());
  const anchor = q.datum && /^\d{4}-\d{2}-\d{2}$/.test(q.datum) ? q.datum : today;

  let from: string;
  let to: string;
  if (view === "woche") {
    from = addDays(anchor, 1 - isoWeekdayOf(anchor));
    to = addDays(from, 6);
  } else {
    const first = `${anchor.slice(0, 7)}-01`;
    from = addDays(first, 1 - isoWeekdayOf(first));
    const [y, m] = anchor.split("-").map(Number);
    const last = `${anchor.slice(0, 7)}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, "0")}`;
    to = addDays(last, 7 - isoWeekdayOf(last));
  }
  const fromD = new Date(startOfLocalDay(from));
  const toD = new Date(startOfLocalDay(addDays(to, 1)));

  const [bookings, occurrences] = await Promise.all([
    listBookings({ status: ["pending", "confirmed", "completed", "no_show"], from: fromD, to: toD }),
    listOccurrences(fromD, toD),
  ]);
  const items: Item[] = [
    ...bookings
      .filter((b) => !b.occurrenceId)
      .map((b) => ({ id: b.id, href: `/admin/buchung/${b.id}`, start: b.startsAt, end: b.endsAt, title: b.customer.name, sub: b.offering.name, color: b.offering.color, pending: b.status === "pending" })),
    ...occurrences
      .filter((o) => o.status === "scheduled")
      .map((o) => ({ id: o.id, href: `/admin/termine/${o.id}`, start: o.startsAt, end: o.endsAt, title: o.title, sub: `${o.booked}/${o.capacity} Plätze${o.waitlist ? ` · ${o.waitlist} Warteliste` : ""}`, color: "#a855f7", pending: false })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  const byDay = new Map<string, Item[]>();
  for (const it of items) {
    const d = localDateOf(it.start.getTime());
    byDay.set(d, [...(byDay.get(d) ?? []), it]);
  }
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

  const prev = view === "woche" ? addDays(anchor, -7) : `${addDays(`${anchor.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
  const next = view === "woche" ? addDays(anchor, 7) : `${addDays(`${anchor.slice(0, 7)}-01`, 32).slice(0, 7)}-01`;
  const label =
    view === "woche"
      ? `${formatForDisplay(startOfLocalDay(from), "Europe/Berlin", { day: "numeric", month: "short" })} – ${formatForDisplay(startOfLocalDay(to), "Europe/Berlin", { day: "numeric", month: "short", year: "numeric" })}`
      : formatForDisplay(startOfLocalDay(`${anchor.slice(0, 7)}-15`), "Europe/Berlin", { month: "long", year: "numeric" });
  const link = (d: string, v = view) => `/admin/kalender?ansicht=${v}&datum=${d}`;

  return (
    <>
      <PageHeader title="Kalender">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            <Link href={link(anchor, "woche")} className={cx("rounded-md px-3 py-1.5", view === "woche" && "bg-surface-2 font-semibold")}>Woche</Link>
            <Link href={link(anchor, "monat")} className={cx("rounded-md px-3 py-1.5", view === "monat" && "bg-surface-2 font-semibold")}>Monat</Link>
          </div>
          <Link href={link(today)} className="rounded-lg border border-line px-3 py-2 text-sm">Heute</Link>
        </div>
      </PageHeader>
      <div className="mb-4 flex items-center gap-3">
        <Link href={link(prev)} aria-label="Zurück" className="rounded-lg p-2 hover:bg-surface-2"><ChevronLeft aria-hidden /></Link>
        <p className="font-semibold capitalize">{label}</p>
        <Link href={link(next)} aria-label="Weiter" className="rounded-lg p-2 hover:bg-surface-2"><ChevronRight aria-hidden /></Link>
      </div>

      {view === "woche" ? (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => (
            <section key={d} aria-label={d} className={cx("min-h-24 rounded-xl border bg-surface p-2", d === today ? "border-accent" : "border-line")}>
              <h2 className="mb-2 px-1 text-sm font-semibold">{formatForDisplay(startOfLocalDay(d), "Europe/Berlin", { weekday: "short", day: "numeric", month: "numeric" })}</h2>
              <ul className="space-y-1.5">
                {(byDay.get(d) ?? []).map((it) => (
                  <li key={it.id}>
                    <Link href={it.href} className={cx("block rounded-md bg-surface-2 px-2 py-1.5 text-xs hover:bg-line", it.pending && "border border-dashed border-amber-500/60")} style={{ borderLeft: `3px solid ${it.color}` }}>
                      <span className="font-semibold tabular-nums">{formatLocalTime(it.start.getTime())}–{formatLocalTime(it.end.getTime())}</span>
                      <span className="block truncate">{it.title}</span>
                      <span className="block truncate text-muted">{it.pending ? "Anfrage · " : ""}{it.sub}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-7 gap-1">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => <div key={w} className="p-1 text-center text-xs text-muted">{w}</div>)}
            {days.map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
              return (
                <Link key={d} href={link(d, "woche")} className={cx("min-h-24 rounded-lg border p-1.5 text-xs hover:border-muted", d === today ? "border-accent" : "border-line", inMonth ? "bg-surface" : "bg-transparent opacity-50")}>
                  <span className="font-semibold">{Number(d.slice(8))}</span>
                  <ul className="mt-1 space-y-0.5">
                    {list.slice(0, 3).map((it) => (
                      <li key={it.id} className="truncate rounded px-1" style={{ backgroundColor: `${it.color}33` }}>
                        {formatLocalTime(it.start.getTime())} {it.title}
                      </li>
                    ))}
                    {list.length > 3 && <li className="text-muted">+{list.length - 3} weitere</li>}
                  </ul>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">Gestrichelt = offene Anfrage (Slot ist reserviert). Lila = Gruppen-/Sondertermin.</p>
    </>
  );
}
