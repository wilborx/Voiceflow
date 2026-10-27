import { AlertTriangle, Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { confirmAction, declineAction, proposeAction } from "@/app/admin/actions";
import type { Slot } from "@/lib/availability";
import type { BookingDetail } from "@/lib/db/types";
import { EXPERIENCE_LABELS } from "@/lib/db/types";
import { formatForDisplay, formatLocalTime } from "@/lib/time/zoned";
import { inputClass } from "../ui";
import { StatusBadge } from "./bits";
import { Countdown } from "./Countdown";
import { SubmitButton } from "./SubmitButton";

export function when(d: Date): string {
  return `${formatForDisplay(d.getTime(), "Europe/Berlin", { weekday: "short", day: "2-digit", month: "2-digit" })}, ${formatLocalTime(d.getTime())}`;
}

/** Anfrage mit Intake-Infos und Aktionen (Bestätigen | Ablehnen | Alternative) */
export function BookingCard({ b, suggestions, back = "/admin" }: { b: BookingDetail; suggestions?: Slot[]; back?: string }) {
  const pending = b.status === "pending" && !b.awaitingCustomer;
  return (
    <article className="rounded-xl border border-line bg-surface p-4 sm:p-5" style={{ borderLeft: `4px solid ${b.offering.color}` }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">{b.offering.name}</p>
          <h2 className="text-lg font-semibold">
            <Link href={`/admin/buchung/${b.id}`} className="hover:underline">{b.customer.name}</Link>
          </h2>
          <p className="text-base">{when(b.startsAt)}–{formatLocalTime(b.endsAt.getTime())} Uhr</p>
        </div>
        <div className="text-right text-sm">
          <StatusBadge status={b.status} awaiting={b.awaitingCustomer} />
          {b.status === "pending" && b.holdExpiresAt && <p className="mt-1"><Countdown until={b.holdExpiresAt.toISOString()} /></p>}
        </div>
      </div>

      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Kontakt</dt>
        <dd className="flex flex-wrap gap-x-3">
          <a href={`mailto:${b.customer.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail aria-hidden size={14} />{b.customer.email}</a>
          {b.customer.phone && <a href={`tel:${b.customer.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone aria-hidden size={14} />{b.customer.phone}</a>}
          <span className="inline-flex items-center gap-1 text-muted">
            {b.preferredChannel === "whatsapp" ? <MessageCircle aria-hidden size={14} /> : <Mail aria-hidden size={14} />}
            {b.preferredChannel === "whatsapp" ? (b.whatsappConsent ? "WhatsApp" : "WhatsApp (ohne Opt-in → E-Mail)") : "E-Mail"}
          </span>
        </dd>
        {b.experienceLevel && (<><dt className="text-muted">Level</dt><dd>{EXPERIENCE_LABELS[b.experienceLevel]}</dd></>)}
        {b.goal && (<><dt className="text-muted">Ziel</dt><dd>{b.goal}</dd></>)}
        {b.message && (<><dt className="text-muted">Nachricht</dt><dd className="whitespace-pre-line">{b.message}</dd></>)}
        {b.healthNotes && (
          <><dt className="text-muted">Gesundheit</dt><dd className="inline-flex items-start gap-1 text-amber-300"><AlertTriangle aria-hidden size={14} className="mt-0.5 shrink-0" />{b.healthNotes}</dd></>
        )}
        {b.utm?.utm_source && (<><dt className="text-muted">Herkunft</dt><dd>{b.utm.utm_source}</dd></>)}
        {b.originalStartsAt && (<><dt className="text-muted">Ursprünglich</dt><dd>{when(b.originalStartsAt)}</dd></>)}
      </dl>

      {pending && (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:flex-wrap sm:items-start">
          <form action={confirmAction}>
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton className="w-full sm:w-auto">Bestätigen</SubmitButton>
          </form>
          <details className="group rounded-lg sm:min-w-0">
            <summary className="cursor-pointer list-none rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-center text-sm font-semibold hover:border-muted">Ablehnen</summary>
            <form action={declineAction} className="mt-2 space-y-2">
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="back" value={back} />
              <label htmlFor={`r-${b.id}`} className="sr-only">Grund (optional)</label>
              <input id={`r-${b.id}`} name="reason" placeholder="Grund (optional, geht an den Kunden)" className={inputClass} />
              <SubmitButton variant="danger" size="sm">Ablehnung senden</SubmitButton>
            </form>
          </details>
          {suggestions && b.occurrenceId === null && (
            <details className="group rounded-lg">
              <summary className="cursor-pointer list-none rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-center text-sm font-semibold hover:border-muted">Alternative vorschlagen</summary>
              <form action={proposeAction} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="back" value={back} />
                <label htmlFor={`p-${b.id}`} className="sr-only">Freier Termin</label>
                <select id={`p-${b.id}`} name="start" required className={inputClass}>
                  {suggestions.length === 0 && <option value="">Keine freien Slots in der Nähe</option>}
                  {suggestions.map((s) => (
                    <option key={s.start} value={new Date(s.start).toISOString()}>{when(new Date(s.start))} Uhr</option>
                  ))}
                </select>
                <SubmitButton variant="secondary" size="sm" disabled={suggestions.length === 0}>Vorschlag senden</SubmitButton>
              </form>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
