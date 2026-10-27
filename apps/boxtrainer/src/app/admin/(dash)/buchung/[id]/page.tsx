import { notFound } from "next/navigation";
import { attendanceAction, bookingNotesAction, cancelBookingAction, redeemCreditAction, resendConfirmationAction } from "@/app/admin/actions";
import { Flash, PageHeader } from "@/components/admin/bits";
import { BookingCard } from "@/components/admin/BookingCard";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ButtonLink, inputClass } from "@/components/ui";
import { suggestAlternatives } from "@/lib/booking/slots";
import { sqlOne } from "@/lib/db/client";
import { getBooking, getOffering, getSettings } from "@/lib/db/queries";

export default async function BookingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; fehler?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const b = await getBooking(id);
  if (!b) notFound();
  const back = `/admin/buchung/${id}`;
  const settings = await getSettings();
  const offering = await getOffering(b.offering.id);
  const suggestions = b.status === "pending" && !b.occurrenceId && offering ? await suggestAlternatives(offering, b.id, b.startsAt) : undefined;
  const past = b.startsAt < new Date();
  const credits = settings.features.packages
    ? await sqlOne<{ left: number }>(
        `select coalesce(sum(credits_total - credits_used), 0)::int as left from customer_packages
          where customer_id = $1 and (expires_at is null or expires_at > now())`,
        [b.customer.id],
      )
    : undefined;
  const redeemed = await sqlOne("select 1 from package_redemptions where booking_id = $1", [b.id]);

  return (
    <>
      <PageHeader title="Buchung">
        <ButtonLink href={`/admin/kunden/${b.customer.id}`} variant="secondary" size="sm">Kundenprofil</ButtonLink>
      </PageHeader>
      <Flash ok={q.ok} error={q.fehler} />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <BookingCard b={b} suggestions={suggestions} back={back} />
        <aside className="space-y-4">
          {["pending", "confirmed"].includes(b.status) && !past && (
            <details className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer font-semibold">Termin absagen</summary>
              <form action={cancelBookingAction} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="back" value={back} />
                <input name="reason" placeholder="Grund (geht an den Kunden)" className={inputClass} aria-label="Grund" />
                <SubmitButton variant="danger" size="sm" confirm="Termin wirklich absagen? Der Kunde wird benachrichtigt.">Absagen</SubmitButton>
              </form>
            </details>
          )}
          {b.status === "confirmed" && !past && (
            <form action={resendConfirmationAction} className="rounded-xl border border-line bg-surface p-4">
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="back" value={back} />
              <p className="mb-2 font-semibold">Erinnerung</p>
              <SubmitButton variant="secondary" size="sm">Jetzt Erinnerung senden</SubmitButton>
            </form>
          )}
          {["confirmed", "completed", "no_show"].includes(b.status) && past && (
            <div className="rounded-xl border border-line bg-surface p-4">
              <p className="mb-2 font-semibold">Anwesenheit</p>
              <div className="flex flex-wrap gap-2">
                {(["completed", "no_show"] as const).map((s) => (
                  <form key={s} action={attendanceAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="status" value={s} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton size="sm" variant={b.status === s ? "primary" : "secondary"}>{s === "completed" ? "Erschienen" : "No-Show"}</SubmitButton>
                  </form>
                ))}
              </div>
            </div>
          )}
          {credits && credits.left > 0 && !redeemed && ["confirmed", "completed"].includes(b.status) && (
            <form action={redeemCreditAction} className="rounded-xl border border-line bg-surface p-4">
              <input type="hidden" name="customerId" value={b.customer.id} />
              <input type="hidden" name="bookingId" value={b.id} />
              <input type="hidden" name="back" value={back} />
              <p className="mb-2 font-semibold">Paket-Guthaben: {credits.left} Einheiten</p>
              <SubmitButton size="sm" variant="secondary">1 Einheit abbuchen</SubmitButton>
            </form>
          )}
          {b.paymentStatus !== "none" && (
            <p className="rounded-xl border border-line bg-surface p-4 text-sm">Zahlung: <strong>{{ open: "offen", paid: "bezahlt", refunded: "erstattet", none: "-" }[b.paymentStatus]}</strong>{b.amountDueCents ? ` (${(b.amountDueCents / 100).toFixed(2)} €)` : ""}</p>
          )}
          <form action={bookingNotesAction} className="rounded-xl border border-line bg-surface p-4">
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="back" value={back} />
            <label htmlFor="notes" className="mb-2 block font-semibold">Interne Notiz</label>
            <textarea id="notes" name="notes" rows={4} defaultValue={b.adminNotes} className={inputClass} />
            <SubmitButton size="sm" variant="secondary" className="mt-2">Speichern</SubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}
