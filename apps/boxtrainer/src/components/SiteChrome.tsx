import Link from "next/link";
import { site } from "@/content/site";
import { buttonClass } from "./ui";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-display text-xl tracking-wide">
          {site.brand}
        </Link>
        <nav aria-label="Hauptnavigation" className="flex items-center gap-1 sm:gap-4">
          <Link href="/#angebote" className="hidden px-2 text-sm text-muted hover:text-fg sm:block">Angebote</Link>
          <Link href="/#ueber" className="hidden px-2 text-sm text-muted hover:text-fg sm:block">Über mich</Link>
          <Link href="/#faq" className="hidden px-2 text-sm text-muted hover:text-fg sm:block">FAQ</Link>
          <Link href="/buchen" className={buttonClass("primary", "sm")}>
            {site.hero.cta}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface pb-24 sm:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:grid-cols-3">
        <div>
          <p className="font-display text-lg text-fg">{site.brand}</p>
          <p className="mt-2">
            {site.gym}
            <br />
            {site.address.street}, {site.address.zip} {site.address.city}
          </p>
        </div>
        <div>
          <p className="font-semibold text-fg">Kontakt</p>
          <p className="mt-2">
            <a href={`mailto:${site.email}`} className="hover:text-fg">{site.email}</a>
            <br />
            {site.phone}
            <br />
            <a href={site.instagram} className="hover:text-fg" rel="noopener">Instagram</a>
          </p>
        </div>
        <nav aria-label="Rechtliches">
          <p className="font-semibold text-fg">Rechtliches</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/impressum" className="hover:text-fg">Impressum</Link></li>
            <li><Link href="/datenschutz" className="hover:text-fg">Datenschutz</Link></li>
            <li><Link href="/agb" className="hover:text-fg">AGB, Storno & Gesundheitshinweis</Link></li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-line py-4 text-center text-xs text-zinc-500">© {new Date().getFullYear()} {site.brand}</p>
    </footer>
  );
}

/** Sticky CTA auf Mobile */
export function StickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 p-3 backdrop-blur sm:hidden">
      <Link href="/buchen" className={buttonClass("primary", "lg", "w-full")}>
        {site.hero.cta}
      </Link>
    </div>
  );
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl">{title}</h1>
        <div className="mt-2 rounded-lg border border-amber-900 bg-amber-950/50 p-3 text-sm text-amber-200">
          Platzhalter – dieser Text muss vor Veröffentlichung juristisch geprüft und vervollständigt werden.
        </div>
        <div className="prose-legal mt-8 space-y-4 leading-relaxed text-zinc-300 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-fg">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
