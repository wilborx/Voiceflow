import { Check, ChevronDown, Clock, Users } from "lucide-react";
import { PhotoPlaceholder, SectionTitle, ButtonLink, formatPrice, Card } from "@/components/ui";
import { SiteFooter, SiteHeader, StickyCta } from "@/components/SiteChrome";
import { site } from "@/content/site";
import { listOfferings } from "@/lib/db/queries";
import { KIND_LABELS } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const offerings = await listOfferings({ publicOnly: true });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: site.brand,
    description: site.tagline,
    url: appUrl,
    email: site.email,
    telephone: site.phone,
    priceRange: site.priceRange,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      postalCode: site.address.zip,
      addressLocality: site.address.city,
      addressCountry: site.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: site.address.lat, longitude: site.address.lng },
    makesOffer: offerings.map((o) => ({
      "@type": "Offer",
      name: o.name,
      ...(o.priceCents !== null ? { price: (o.priceCents / 100).toFixed(2), priceCurrency: "EUR" } : {}),
    })),
  };

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:pt-16 lg:grid-cols-2">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-accent">{site.hero.eyebrow}</p>
              <h1 className="whitespace-pre-line font-display text-6xl leading-[1.02] sm:text-7xl lg:text-8xl">{site.hero.title}</h1>
              <p className="mt-6 max-w-lg text-lg text-zinc-300">{site.hero.text}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/buchen" size="lg">{site.hero.cta}</ButtonLink>
                <ButtonLink href="#angebote" size="lg" variant="secondary">{site.hero.secondary}</ButtonLink>
              </div>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6">
                {site.stats.map((s) => (
                  <div key={s.label}>
                    <dt className="text-xs text-muted">{s.label}</dt>
                    <dd className="font-display text-3xl">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <PhotoPlaceholder label={`${site.trainerName} an den Pratzen`} className="aspect-[4/5] w-full lg:aspect-[4/5]" />
          </div>
        </section>

        {/* Angebote */}
        <section id="angebote" className="scroll-mt-20 border-t border-line bg-surface/40 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <SectionTitle eyebrow="Angebote" title="Dein Training" intro="Wähle das Format, das zu dir passt. Unsicher? Starte mit einem Probetraining." />
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {offerings.map((o) => (
                <li key={o.id}>
                  <Card className="flex h-full flex-col">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: o.color }}>{KIND_LABELS[o.kind]}</span>
                      <span className="text-lg font-bold">{formatPrice(o.priceCents, o.capacity > 1 ? "/ Person" : undefined)}</span>
                    </div>
                    <h3 className="font-display text-2xl">{o.name}</h3>
                    <p className="mt-2 flex-1 text-sm text-muted">{o.description}</p>
                    <div className="mt-4 flex gap-4 text-sm text-zinc-300">
                      <span className="inline-flex items-center gap-1.5"><Clock aria-hidden size={16} /> {o.durationMin} Min.</span>
                      {o.capacity > 1 && <span className="inline-flex items-center gap-1.5"><Users aria-hidden size={16} /> max. {o.capacity}</span>}
                    </div>
                    <ButtonLink href={`/buchen?angebot=${o.slug}`} variant="secondary" className="mt-5 w-full">
                      {o.kind === "trial" ? "Probetraining anfragen" : "Termin wählen"}
                    </ButtonLink>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Über */}
        <section id="ueber" className="scroll-mt-20 py-20">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2">
            <PhotoPlaceholder label="Portrait im Gym" className="aspect-square w-full" />
            <div>
              <SectionTitle eyebrow="Trainer" title={site.about.title} />
              {site.about.paragraphs.map((p) => <p key={p} className="mb-4 text-zinc-300">{p}</p>)}
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="mb-3 font-semibold">Lizenzen</h3>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {site.about.licenses.map((l) => <li key={l} className="flex gap-2"><Check aria-hidden size={18} className="shrink-0 text-accent" />{l}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-3 font-semibold">Erfolge</h3>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {site.about.achievements.map((l) => <li key={l} className="flex gap-2"><Check aria-hidden size={18} className="shrink-0 text-accent" />{l}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="border-y border-line bg-surface/40 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <SectionTitle eyebrow="Stimmen" title="Was Kunden sagen" />
            <ul className="grid gap-5 md:grid-cols-3">
              {site.testimonials.map((t, i) => (
                <li key={i}>
                  <figure className="h-full rounded-xl border border-line bg-surface p-6">
                    <blockquote className="text-lg leading-relaxed">“{t.quote}”</blockquote>
                    <figcaption className="mt-4 text-sm"><span className="font-semibold">{t.name}</span> · <span className="text-muted">{t.meta}</span></figcaption>
                  </figure>
                </li>
              ))}
            </ul>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <PhotoPlaceholder label="Vorher (nur mit Einwilligung)" className="aspect-video" />
              <PhotoPlaceholder label="Nachher (nur mit Einwilligung)" className="aspect-video" />
            </div>
          </div>
        </section>

        {/* Ablauf */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4">
            <SectionTitle eyebrow="So läuft's" title="In 3 Schritten zum Training" />
            <ol className="grid gap-5 md:grid-cols-3">
              {site.steps.map((s, i) => (
                <li key={s.title} className="rounded-xl border border-line p-6">
                  <span className="font-display text-5xl text-accent">{i + 1}</span>
                  <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-line bg-surface/40 py-20">
          <div className="mx-auto max-w-3xl px-4">
            <SectionTitle eyebrow="FAQ" title="Häufige Fragen" />
            <div className="divide-y divide-line rounded-xl border border-line bg-surface">
              {site.faq.map((f) => (
                <details key={f.q} className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {f.q}
                    <ChevronDown aria-hidden className="shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Abschluss-CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="font-display text-5xl sm:text-6xl">Bereit für die erste Runde?</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">Anfrage in unter 2 Minuten. Bestätigung innerhalb von {site.responseHours} Stunden.</p>
            <ButtonLink href="/buchen" size="lg" className="mt-8">{site.hero.cta}</ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyCta />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
