import Link from "next/link";
import { PageHeader } from "@/components/admin/bits";
import { cx } from "@/components/ui";
import { computeWorkingWindows } from "@/lib/availability";
import { sql, sqlOne } from "@/lib/db/client";
import { listExceptions, listRules } from "@/lib/db/queries";
import { addDays, localDateOf } from "@/lib/time/zoned";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "–");

export default async function StatistikPage({ searchParams }: { searchParams: Promise<{ tage?: string }> }) {
  const days = [7, 30, 90, 365].includes(Number((await searchParams).tage)) ? Number((await searchParams).tage) : 30;
  const since = new Date(Date.now() - days * 86_400_000);

  const counts = await sqlOne<{ requests: number; confirmed: number; declined: number; expired: number; completed: number; noShow: number; cancelled: number; late: number }>(
    `select count(*)::int as requests,
            count(*) filter (where status in ('confirmed', 'completed', 'no_show'))::int as confirmed,
            count(*) filter (where status = 'declined')::int as declined,
            count(*) filter (where status = 'expired')::int as expired,
            count(*) filter (where status = 'completed')::int as completed,
            count(*) filter (where status = 'no_show')::int as "noShow",
            count(*) filter (where status = 'cancelled')::int as cancelled,
            count(*) filter (where late_cancellation)::int as late
       from bookings where created_at >= $1 and occurrence_id is null`,
    [since],
  );
  const c = counts!;
  const decided = c.confirmed + c.declined + c.expired;

  // Auslastung Einzeltermine: gebuchte Stunden / verfügbare Stunden im Zeitraum (Vergangenheit)
  const today = localDateOf(Date.now());
  const windows = computeWorkingWindows({ rules: await listRules(), exceptions: await listExceptions(), fromDate: addDays(today, -days), toDate: addDays(today, -1) });
  const availableH = windows.reduce((s, w) => s + (w.end - w.start), 0) / 3_600_000;
  const booked = await sqlOne<{ h: number }>(
    `select coalesce(sum(extract(epoch from ends_at - starts_at)) / 3600, 0)::float as h from bookings
      where occurrence_id is null and status in ('completed', 'no_show', 'confirmed') and starts_at >= $1 and starts_at < now()`,
    [since],
  );
  const groupFill = await sqlOne<{ seats: number; capacity: number }>(
    `select coalesce(sum(x.capacity), 0)::int as capacity,
            coalesce(sum((select count(*) from bookings b where b.occurrence_id = x.id and b.status in ('confirmed', 'completed', 'no_show'))), 0)::int as seats
       from event_occurrences x where x.status = 'scheduled' and x.starts_at >= $1 and x.starts_at < now() + interval '14 days'`,
    [since],
  );
  const sources = await sql<{ source: string; n: number }>(
    `select coalesce(nullif(utm ->> 'utm_source', ''), nullif(utm ->> 'referrer', ''), 'direkt') as source, count(*)::int as n
       from bookings where created_at >= $1 group by 1 order by 2 desc limit 8`,
    [since],
  );
  const byOffering = await sql<{ name: string; color: string; n: number }>(
    `select o.name, o.color, count(*)::int as n from bookings b join offerings o on o.id = b.offering_id
      where b.created_at >= $1 group by o.name, o.color order by 3 desc`,
    [since],
  );
  const maxSource = Math.max(1, ...sources.map((s) => s.n));
  const maxOffering = Math.max(1, ...byOffering.map((s) => s.n));

  const kpis = [
    { label: "Anfragen (Einzel)", value: String(c.requests) },
    { label: "Bestätigungsquote", value: pct(c.confirmed, decided), hint: `${c.confirmed} von ${decided} entschieden · ${c.expired} abgelaufen` },
    { label: "Auslastung Einzel", value: pct(booked?.h ?? 0, availableH), hint: `${Math.round(booked?.h ?? 0)} von ${Math.round(availableH)} verfügbaren Std.` },
    { label: "Auslastung Gruppen", value: pct(groupFill?.seats ?? 0, groupFill?.capacity ?? 0), hint: `${groupFill?.seats ?? 0} von ${groupFill?.capacity ?? 0} Plätzen` },
    { label: "No-Show-Rate", value: pct(c.noShow, c.completed + c.noShow), hint: `${c.noShow} No-Shows` },
    { label: "Stornos", value: String(c.cancelled), hint: `${c.late} kurzfristig` },
  ];

  return (
    <>
      <PageHeader title="Statistik">
        <div className="flex rounded-lg border border-line p-0.5 text-sm">
          {[7, 30, 90, 365].map((d) => (
            <Link key={d} href={`/admin/statistik?tage=${d}`} className={cx("rounded-md px-3 py-1.5", d === days && "bg-surface-2 font-semibold")}>{d === 365 ? "1 Jahr" : `${d} Tage`}</Link>
          ))}
        </div>
      </PageHeader>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{k.label}</dt>
            <dd className="mt-1 font-display text-4xl tabular-nums">{k.value}</dd>
            {k.hint && <dd className="mt-1 text-xs text-muted">{k.hint}</dd>}
          </div>
        ))}
      </dl>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Bars title="Herkunft (UTM / Referrer)" rows={sources.map((s) => ({ label: s.source, n: s.n }))} max={maxSource} />
        <Bars title="Anfragen nach Angebot" rows={byOffering.map((s) => ({ label: s.name, n: s.n, color: s.color }))} max={maxOffering} />
      </div>
    </>
  );
}

function Bars({ title, rows, max }: { title: string; rows: { label: string; n: number; color?: string }[]; max: number }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">Keine Daten im Zeitraum.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${(r.n / max) * 100}%`, backgroundColor: r.color ?? "var(--color-accent)" }} />
              </span>
              <span className="text-right tabular-nums">{r.n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
