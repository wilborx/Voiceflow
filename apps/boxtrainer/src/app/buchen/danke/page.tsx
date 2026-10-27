import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ButtonLink } from "@/components/ui";
import { getSettings } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Anfrage eingegangen", robots: { index: false } };

export default async function DankePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const settings = await getSettings();
  const content =
    status === "confirmed"
      ? { title: "Termin gebucht!", text: "Dein Termin ist bestätigt. Du bekommst gleich eine Nachricht mit allen Details und dem Kalendereintrag." }
      : status === "waitlist"
        ? { title: "Du stehst auf der Warteliste", text: "Sobald ein Platz frei wird, bekommst du sofort eine Nachricht und kannst ihn mit einem Klick sichern." }
        : { title: "Anfrage eingegangen", text: `Du erhältst innerhalb von ${settings.responseSlaHours} Std. eine Bestätigung. Eine Eingangsbestätigung ist schon unterwegs – schau auch im Spam-Ordner nach.` };
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <CheckCircle2 aria-hidden size={56} className="text-accent" />
        <h1 className="mt-6 font-display text-5xl">{content.title}</h1>
        <p className="mt-4 text-lg text-zinc-300">{content.text}</p>
        <p className="mt-2 text-sm text-muted">Über den Link in der Nachricht kannst du deinen Termin jederzeit verwalten.</p>
        <ButtonLink href="/" variant="secondary" className="mt-8">Zur Startseite</ButtonLink>
      </main>
      <SiteFooter />
    </>
  );
}
