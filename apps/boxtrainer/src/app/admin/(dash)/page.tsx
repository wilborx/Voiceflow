import Link from "next/link";
import { Empty, Flash, PageHeader } from "@/components/admin/bits";
import { BookingCard, when } from "@/components/admin/BookingCard";
import { suggestAlternatives } from "@/lib/booking/slots";
import { getOffering, listBookings } from "@/lib/db/queries";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ ok?: string; fehler?: string }> }) {
  const q = await searchParams;
  const open = await listBookings({ status: ["pending"], from: new Date() });
  const pending = open.filter((b) => !b.awaitingCustomer && b.holdExpiresAt && b.holdExpiresAt > new Date()).sort((a, z) => a.holdExpiresAt!.getTime() - z.holdExpiresAt!.getTime());
  const awaiting = open.filter((b) => b.awaitingCustomer);
  const soon = await listBookings({ status: ["confirmed"], from: new Date(), to: new Date(Date.now() + 2 * 86_400_000) });

  // Gruppentermine zusammenfassen statt jeden Teilnehmer einzeln
  const soonItems: { key: string; href: string; start: Date; label: string; offering: string; color: string }[] = [];
  const groups = new Map<string, (typeof soonItems)[number] & { n: number }>();
  for (const b of soon) {
    if (b.occurrenceId) {
      const g = groups.get(b.occurrenceId);
      if (g) {
        g.n += b.seats;
        g.label = `${g.n} Teilnehmer`;
      } else {
        const item = { key: b.occurrenceId, href: `/admin/termine/${b.occurrenceId}`, start: b.startsAt, label: "1 Teilnehmer", offering: b.offering.name, color: b.offering.color, n: b.seats };
        groups.set(b.occurrenceId, item);
        soonItems.push(item);
      }
    } else {
      soonItems.push({ key: b.id, href: `/admin/buchung/${b.id}`, start: b.startsAt, label: b.customer.name, offering: b.offering.name, color: b.offering.color });
    }
  }

  const suggestions = await Promise.all(
    pending.map(async (b) => {
      if (b.occurrenceId) return undefined;
      const o = await getOffering(b.offering.id);
      return o ? suggestAlternatives(o, b.id, b.startsAt) : [];
    }),
  );

  return (
    <>
      <PageHeader title="Anfragen" />
      <Flash ok={q.ok} error={q.fehler} />

      <section aria-labelledby="h-open">
        <h2 id="h-open" className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Offen ({pending.length})</h2>
        {pending.length === 0 ? (
          <Empty>Keine offenen Anfragen – alles erledigt. 💪</Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {pending.map((b, i) => <BookingCard key={b.id} b={b} suggestions={suggestions[i]} />)}
          </div>
        )}
      </section>

      {awaiting.length > 0 && (
        <section aria-labelledby="h-wait" className="mt-10">
          <h2 id="h-wait" className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Wartet auf Kunde ({awaiting.length})</h2>
          <div className="grid gap-4 xl:grid-cols-2">{awaiting.map((b) => <BookingCard key={b.id} b={b} />)}</div>
        </section>
      )}

      <section aria-labelledby="h-soon" className="mt-10">
        <h2 id="h-soon" className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Nächste 48 Stunden</h2>
        {soon.length === 0 ? (
          <Empty>Keine bestätigten Termine in den nächsten 48 Stunden.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {soonItems.map((it) => (
              <li key={it.key}>
                <Link href={it.href} className="flex items-center justify-between gap-3 p-4 hover:bg-surface-2">
                  <span>
                    <span className="font-semibold">{when(it.start)}</span> · {it.label}
                  </span>
                  <span className="text-sm" style={{ color: it.color }}>{it.offering}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
