import { SiteHeader } from "@/components/SiteChrome";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-6xl">404</h1>
        <p className="mt-4 text-muted">Diese Seite gibt es nicht – oder der Link ist nicht mehr gültig.</p>
        <ButtonLink href="/" className="mt-8">Zur Startseite</ButtonLink>
      </main>
    </>
  );
}
