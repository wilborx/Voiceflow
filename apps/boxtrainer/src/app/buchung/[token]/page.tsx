import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Badge, ButtonLink } from "@/components/ui";
import { site } from "@/content/site";
import { getManageView } from "@/lib/booking/service";
import { STATUS_LABELS } from "@/lib/db/types";
import { formatForDisplay, formatLocalTime } from "@/lib/time/zoned";
import { ManageActions } from "./ManageActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Termin verwalten", robots: { index: false, follow: false } };

export default async function ManagePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ bezahlt?: string }> }) {
  const { token } = await params;
  const { bezahlt } = await searchParams;
  const view = await getManageView(token);
  if (!view) notFound();
  const b = view.booking;
  const tone = b.status === "confirmed" ? "ok" : b.status === "pending" ? "warn" : "neutral";

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted">Hallo {b.customer.name.split(" ")[0]},</p>
        <h1 className="mt-1 font-display text-4xl">
          {view.awaitingCustomer ? (b.occurrenceId ? "Ein Platz ist frei!" : "Neuer Terminvorschlag") : "Dein Termin"}
        </h1>
        {bezahlt && <p role="status" className="mt-4 rounded-lg border border-green-900 bg-green-950/50 p-3 text-green-200">Danke, deine Zahlung ist eingegangen.</p>}

        <div className="mt-6 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xl font-semibold">{b.offering.name}</p>
              <p className="mt-1 text-lg">
                {formatForDisplay(b.startsAt.getTime(), "Europe/Berlin", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                <br />
                {formatLocalTime(b.startsAt.getTime())}–{formatLocalTime(b.endsAt.getTime())} Uhr
              </p>
              <p className="mt-2 text-sm text-muted">{b.offering.location || site.gym}</p>
            </div>
            <Badge tone={tone}>{view.awaitingCustomer ? "Wartet auf dich" : STATUS_LABELS[b.status]}</Badge>
          </div>
          {b.status === "pending" && !view.awaitingCustomer && b.holdExpiresAt && (
            <p className="mt-4 text-sm text-muted">Deine Anfrage wird geprüft. Der Termin ist bis {formatForDisplay(b.holdExpiresAt.getTime())} Uhr für dich reserviert.</p>
          )}
          {view.awaitingCustomer && b.holdExpiresAt && (
            <p className="mt-4 text-sm text-amber-300">Bitte bestätige bis {formatForDisplay(b.holdExpiresAt.getTime())} Uhr – danach wird der Platz weitergegeben.</p>
          )}
          {b.declineReason && b.status !== "confirmed" && <p className="mt-4 text-sm text-muted">Hinweis: {b.declineReason}</p>}
          {b.paymentStatus === "open" && <p className="mt-4 text-sm text-amber-300">Zahlung offen – den Link findest du in deiner Bestätigung.</p>}
          {["pending", "confirmed"].includes(b.status) && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <a href={`/api/ics/${token}`} className="underline hover:text-accent">Kalendereintrag (.ics)</a>
              <a href={site.mapsUrl} className="underline hover:text-accent" rel="noopener">Anfahrt (Google Maps)</a>
            </div>
          )}
        </div>

        <div className="mt-6">
          <ManageActions
            token={token}
            offeringSlug={b.offering.slug}
            canCancel={view.canCancel}
            freeCancellation={view.freeCancellation}
            cancellationHours={view.settings.cancellationHours}
            canReschedule={view.canReschedule}
            awaitingCustomer={view.awaitingCustomer}
          />
        </div>

        {["cancelled", "declined", "expired", "completed"].includes(b.status) && (
          <ButtonLink href={`/buchen?angebot=${b.offering.slug}`} className="mt-8">Neuen Termin buchen</ButtonLink>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
