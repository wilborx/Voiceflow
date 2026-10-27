import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Button, Card, formatPrice, inputClass } from "@/components/ui";
import { integrations } from "@/lib/config";
import { sql } from "@/lib/db/client";
import { getSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pakete & Karten" };

export default async function PaketePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const settings = await getSettings();
  const packages = settings.features.packages
    ? await sql<{ id: string; name: string; credits: number; priceCents: number; validDays: number | null }>(
        `select id, name, credits, price_cents as "priceCents", valid_days as "validDays" from packages where is_active order by price_cents`,
      )
    : [];
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-display text-5xl">Pakete & Karten</h1>
        {q.gekauft && <p role="status" className="mt-4 rounded-lg border border-green-900 bg-green-950/50 p-3 text-green-200">Danke für deinen Kauf! Das Guthaben wird deinem Konto (E-Mail) gutgeschrieben.</p>}
        {(q.demo || !integrations.stripe) && packages.length > 0 && (
          <p className="mt-4 rounded-lg border border-amber-900 bg-amber-950/50 p-3 text-sm text-amber-200">Demo: Stripe ist nicht konfiguriert – der Kauf ist deaktiviert.</p>
        )}
        {packages.length === 0 && <p className="mt-6 text-muted">Aktuell sind keine Pakete verfügbar.</p>}
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {packages.map((p) => (
            <li key={p.id}>
              <Card>
                <h2 className="text-xl font-semibold">{p.name}</h2>
                <p className="mt-1 text-3xl font-bold">{formatPrice(p.priceCents)}</p>
                <p className="mt-1 text-sm text-muted">
                  {p.credits} Einheiten · {formatPrice(Math.round(p.priceCents / p.credits))} pro Einheit{p.validDays ? ` · ${p.validDays} Tage gültig` : ""}
                </p>
                <form action="/api/packages/checkout" method="post" className="mt-4 space-y-3">
                  <input type="hidden" name="packageId" value={p.id} />
                  <label htmlFor={`e-${p.id}`} className="sr-only">E-Mail</label>
                  <input id={`e-${p.id}`} name="email" type="email" required placeholder="Deine E-Mail" className={inputClass} />
                  <Button type="submit" className="w-full" disabled={!integrations.stripe}>Kaufen</Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
