import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelOccurrenceAction, offerWaitlistAction } from "@/app/admin/actions";
import { Empty, Flash, PageHeader, StatusBadge } from "@/components/admin/bits";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Badge, Card, inputClass } from "@/components/ui";
import { sql } from "@/lib/db/client";
import { getOccurrence, listBookings } from "@/lib/db/queries";
import { EXPERIENCE_LABELS } from "@/lib/db/types";
import { formatForDisplay, formatLocalTime } from "@/lib/time/zoned";

export default async function OccurrencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; fehler?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const occ = await getOccurrence(id);
  if (!occ) notFound();
  const participants = (await listBookings({ occurrenceId: id })).filter((b) => ["pending", "confirmed", "completed", "no_show"].includes(b.status));
  const waitlist = await sql<{ id: string; name: string; email: string; status: string; createdAt: Date; offerExpiresAt: Date | null }>(
    `select w.id, c.name, c.email::text as email, w.status, w.created_at as "createdAt", w.offer_expires_at as "offerExpiresAt"
       from waitlist_entries w join customers c on c.id = w.customer_id
      where w.occurrence_id = $1 and w.status in ('waiting', 'offered') order by w.created_at`,
    [id],
  );
  const free = occ.capacity - occ.booked;

  return (
    <>
      <PageHeader title={occ.title} />
      <Flash ok={q.ok} error={q.fehler} />
      <p className="-mt-4 mb-6 text-lg">
        {formatForDisplay(occ.startsAt.getTime(), "Europe/Berlin", { weekday: "long", day: "numeric", month: "long" })}, {formatLocalTime(occ.startsAt.getTime())}–{formatLocalTime(occ.endsAt.getTime())} Uhr
        {" · "}<span className="tabular-nums">{occ.booked}/{occ.capacity}</span> Plätze
        {occ.status === "cancelled" && <> · <Badge tone="bad">abgesagt</Badge></>}
      </p>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Teilnehmer ({participants.length})</h2>
          {participants.length === 0 ? <Empty>Noch keine Anmeldungen.</Empty> : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-muted"><tr><th className="p-3">Name</th><th className="p-3">Level</th><th className="p-3">Hinweise</th><th className="p-3">Status</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {participants.map((b) => (
                    <tr key={b.id}>
                      <td className="p-3"><Link href={`/admin/buchung/${b.id}`} className="font-semibold hover:underline">{b.customer.name}</Link><span className="block text-xs text-muted">{b.customer.phone ?? b.customer.email}</span></td>
                      <td className="p-3">{b.experienceLevel ? EXPERIENCE_LABELS[b.experienceLevel] : "–"}</td>
                      <td className="p-3 text-amber-300">{b.healthNotes ?? ""}</td>
                      <td className="p-3"><StatusBadge status={b.status} awaiting={b.awaitingCustomer} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-widest text-muted">Warteliste ({waitlist.length})</h2>
          {waitlist.length === 0 ? <Empty>Niemand auf der Warteliste.</Empty> : (
            <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
              {waitlist.map((w, i) => (
                <li key={w.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span>{i + 1}. <strong>{w.name}</strong> <span className="text-muted">{w.email}</span></span>
                  {w.status === "offered" ? <Badge tone="warn">Platz angeboten{w.offerExpiresAt ? ` bis ${formatLocalTime(w.offerExpiresAt.getTime())}` : ""}</Badge> : <Badge>wartet</Badge>}
                </li>
              ))}
            </ol>
          )}
        </section>

        {occ.status === "scheduled" && occ.startsAt > new Date() && (
          <aside className="space-y-4">
            {free > 0 && waitlist.some((w) => w.status === "waiting") && (
              <Card>
                <p className="mb-2 font-semibold">{free} Platz/Plätze frei</p>
                <form action={offerWaitlistAction}>
                  <input type="hidden" name="id" value={occ.id} />
                  <SubmitButton size="sm" variant="secondary">Warteliste nachrücken lassen</SubmitButton>
                </form>
              </Card>
            )}
            <Card>
              <p className="mb-2 font-semibold">Termin absagen</p>
              <form action={cancelOccurrenceAction} className="space-y-2">
                <input type="hidden" name="id" value={occ.id} />
                <input name="reason" aria-label="Grund" placeholder="Grund (geht an alle Teilnehmer)" className={inputClass} />
                <SubmitButton variant="danger" size="sm" confirm="Termin absagen und alle Teilnehmer benachrichtigen?">Absagen</SubmitButton>
              </form>
            </Card>
          </aside>
        )}
      </div>
    </>
  );
}
