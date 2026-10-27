import Link from "next/link";
import { notFound } from "next/navigation";
import { assignPackageAction, customerNotesAction, deleteCustomerAction } from "@/app/admin/actions";
import { Flash, PageHeader, StatusBadge } from "@/components/admin/bits";
import { when } from "@/components/admin/BookingCard";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ButtonLink, Card, inputClass } from "@/components/ui";
import { sql } from "@/lib/db/client";
import { audit, getCustomer, listBookings } from "@/lib/db/queries";
import { EXPERIENCE_LABELS, type ExperienceLevel } from "@/lib/db/types";
import { formatForDisplay } from "@/lib/time/zoned";

const CONSENT_LABELS: Record<string, string> = { privacy: "Datenschutz", whatsapp: "WhatsApp", health_data: "Gesundheitsdaten", marketing: "Marketing" };

export default async function KundePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; fehler?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const c = await getCustomer(id);
  if (!c) notFound();
  await audit("view_customer", "customers", id);
  const history = (await listBookings({ customerId: id })).reverse();
  const packages = await sql<{ id: string; name: string; total: number; used: number; expiresAt: Date | null }>(
    `select cp.id, p.name, cp.credits_total as total, cp.credits_used as used, cp.expires_at as "expiresAt"
       from customer_packages cp join packages p on p.id = cp.package_id where cp.customer_id = $1 order by cp.purchased_at desc`,
    [id],
  );
  const allPackages = await sql<{ id: string; name: string }>("select id, name from packages where is_active order by price_cents");
  const stats = {
    sessions: history.filter((b) => b.status === "completed").length,
    noShows: history.filter((b) => b.status === "no_show").length,
    cancelled: history.filter((b) => b.status === "cancelled").length,
  };

  return (
    <>
      <PageHeader title={c.name}>
        <ButtonLink href={`/admin/kunden/${id}/export`} variant="secondary" size="sm" prefetch={false}>Datenauskunft (JSON)</ButtonLink>
      </PageHeader>
      <Flash ok={q.ok} error={q.fehler} />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">E-Mail</dt><dd><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></dd>
              <dt className="text-muted">Telefon</dt><dd>{c.phone ?? "–"}</dd>
              <dt className="text-muted">Kanal</dt><dd>{c.preferredChannel === "whatsapp" ? "WhatsApp" : "E-Mail"}</dd>
              <dt className="text-muted">Level</dt><dd>{c.experienceLevel ? EXPERIENCE_LABELS[c.experienceLevel as ExperienceLevel] : "–"}</dd>
              <dt className="text-muted">Kunde seit</dt><dd>{formatForDisplay(c.createdAt.getTime(), "Europe/Berlin", { day: "2-digit", month: "2-digit", year: "numeric" })}</dd>
              <dt className="text-muted">Bilanz</dt><dd>{stats.sessions} Sessions · <span className={stats.noShows ? "text-red-400" : ""}>{stats.noShows} No-Shows</span> · {stats.cancelled} Stornos</dd>
            </dl>
          </Card>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Historie</h2>
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {history.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/buchung/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-surface-2">
                    <span><strong>{when(b.startsAt)}</strong> · {b.offering.name}{b.lateCancellation ? " · kurzfristig storniert" : ""}</span>
                    <StatusBadge status={b.status} awaiting={b.awaitingCustomer} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <form action={customerNotesAction} className="rounded-xl border border-line bg-surface p-4">
            <input type="hidden" name="id" value={c.id} />
            <label htmlFor="notes" className="mb-2 block font-semibold">Notizen</label>
            <textarea id="notes" name="notes" rows={5} defaultValue={c.adminNotes} className={inputClass} placeholder="Technik-Fortschritt, Vorlieben, Absprachen …" />
            <SubmitButton size="sm" variant="secondary" className="mt-2">Speichern</SubmitButton>
          </form>
        </div>

        <aside className="space-y-4">
          <Card>
            <p className="mb-2 font-semibold">Einwilligungen</p>
            <ul className="space-y-1 text-sm">
              {c.consents.map((k, i) => (
                <li key={i}>
                  {CONSENT_LABELS[k.type] ?? k.type}: {formatForDisplay(Date.parse(k.grantedAt))}
                  <span className="text-muted"> (v{k.textVersion}){k.revokedAt ? " – widerrufen" : ""}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <p className="mb-2 font-semibold">Pakete & Guthaben</p>
            {packages.length === 0 ? <p className="text-sm text-muted">Keine Pakete.</p> : (
              <ul className="mb-3 space-y-1 text-sm">
                {packages.map((p) => (
                  <li key={p.id}>{p.name}: <strong>{p.total - p.used}</strong>/{p.total} übrig{p.expiresAt ? ` · bis ${formatForDisplay(p.expiresAt.getTime(), "Europe/Berlin", { day: "2-digit", month: "2-digit", year: "2-digit" })}` : ""}</li>
                ))}
              </ul>
            )}
            {allPackages.length > 0 && (
              <form action={assignPackageAction} className="flex gap-2">
                <input type="hidden" name="customerId" value={c.id} />
                <label htmlFor="pkg" className="sr-only">Paket</label>
                <select id="pkg" name="packageId" className={inputClass}>{allPackages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <SubmitButton size="sm" variant="secondary">Zuweisen</SubmitButton>
              </form>
            )}
          </Card>

          <details className="rounded-xl border border-red-900 bg-red-950/20 p-4">
            <summary className="cursor-pointer font-semibold text-red-300">Kundendaten löschen (DSGVO)</summary>
            <p className="mt-2 text-sm text-muted">Löscht den Kunden inkl. aller Buchungen, Einwilligungen, Nachrichten-Logs und Gesundheitsangaben unwiderruflich.</p>
            <form action={deleteCustomerAction} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <label htmlFor="confirm" className="text-sm">Zur Bestätigung <strong>LÖSCHEN</strong> eintippen:</label>
              <input id="confirm" name="confirm" className={inputClass} autoComplete="off" />
              <SubmitButton variant="danger" size="sm">Endgültig löschen</SubmitButton>
            </form>
          </details>
        </aside>
      </div>
    </>
  );
}
