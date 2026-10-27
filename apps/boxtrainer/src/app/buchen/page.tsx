import type { Metadata } from "next";
import { BookingFlow } from "@/components/BookingFlow";
import { SiteHeader } from "@/components/SiteChrome";
import { listOfferings } from "@/lib/db/queries";
import { getSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Training anfragen", description: "Angebot wählen, freien Termin aussuchen, Anfrage senden – in unter 2 Minuten." };

export default async function BuchenPage({ searchParams }: { searchParams: Promise<{ angebot?: string }> }) {
  const { angebot } = await searchParams;
  const [all, settings] = await Promise.all([listOfferings(), getSettings()]);
  // Öffentliche Angebote + per Link geteilte (unlisted) nur bei direktem Aufruf
  const offerings = all
    .filter((o) => o.isActive && (o.visibility === "public" || o.slug === angebot))
    .map(({ slug, name, description, durationMin, priceCents, capacity, kind, color }) => ({ slug, name, description, durationMin, priceCents, capacity, kind, color }));
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <BookingFlow offerings={offerings} initialSlug={angebot} responseHours={settings.responseSlaHours} />
      </main>
    </>
  );
}
