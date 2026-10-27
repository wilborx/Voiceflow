import type { Metadata } from "next";
import { LegalPage } from "@/components/SiteChrome";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Datenschutz" };

export default function Datenschutz() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <p className="text-sm text-muted">Version {site.legal.consentVersion}</p>
      <h2>1. Verantwortlicher</h2>
      <p>{site.legal.owner}, {site.address.street}, {site.address.zip} {site.address.city}, {site.email}</p>
      <h2>2. Welche Daten wir verarbeiten</h2>
      <p>
        [Bei einer Buchungsanfrage: Name, E-Mail, optional Telefonnummer, bevorzugter Kontaktkanal, Erfahrungslevel, Trainingsziel,
        Nachricht, Termin. Freiwillig und nur mit ausdrücklicher Einwilligung: Angaben zu Verletzungen/Einschränkungen (Gesundheitsdaten,
        Art. 9 Abs. 2 lit. a DSGVO). Technisch: gekürzte/gehashte IP-Adresse zum Spamschutz, Herkunftsangaben (UTM-Parameter).]
      </p>
      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <p>[Vertragsanbahnung und -durchführung (Art. 6 Abs. 1 lit. b DSGVO), Einwilligung für WhatsApp-Nachrichten und Gesundheitsdaten (Art. 6 Abs. 1 lit. a, Art. 9 Abs. 2 lit. a DSGVO), berechtigtes Interesse an Spamschutz (Art. 6 Abs. 1 lit. f DSGVO).]</p>
      <h2>4. Empfänger / Auftragsverarbeiter</h2>
      <ul className="list-disc pl-6">
        <li>[Hosting: Vercel Inc. – AVV, Standardvertragsklauseln]</li>
        <li>[Datenbank: Supabase – Serverstandort EU (Frankfurt), AVV]</li>
        <li>[E-Mail-Versand: Resend – AVV]</li>
        <li>[WhatsApp: Meta Platforms Ireland – nur bei Einwilligung]</li>
        <li>[Kalender: Google Ireland (Google Calendar) – AVV]</li>
        <li>[Zahlungen: Stripe Payments Europe – nur falls aktiviert]</li>
      </ul>
      <h2>5. Speicherdauer</h2>
      <p>[Anfragen ohne Termin: Löschung nach X Monaten. Kundendaten: bis Widerruf/Ende der Geschäftsbeziehung bzw. gesetzlicher Aufbewahrungsfristen.]</p>
      <h2>6. Cookies & Tracking</h2>
      <p>Diese Website verwendet keine Tracking- oder Marketing-Cookies. Für den Admin-Bereich wird ein technisch notwendiges Sitzungs-Cookie gesetzt.</p>
      <h2>7. Deine Rechte</h2>
      <p>[Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Widerruf von Einwilligungen mit Wirkung für die Zukunft, Beschwerde bei einer Aufsichtsbehörde. Kontakt: {site.email}]</p>
    </LegalPage>
  );
}
