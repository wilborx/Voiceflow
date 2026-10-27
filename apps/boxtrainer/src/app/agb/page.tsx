import type { Metadata } from "next";
import { LegalPage } from "@/components/SiteChrome";

export const metadata: Metadata = { title: "AGB, Storno & Gesundheitshinweis" };

export default function Agb() {
  return (
    <LegalPage title="AGB, Storno & Gesundheitshinweis">
      <h2 id="buchung">Buchung</h2>
      <p>[Eine Anfrage ist unverbindlich. Ein Vertrag kommt erst mit der Bestätigung durch den Trainer zustande. Bei Gruppenkursen mit Sofortbestätigung kommt der Vertrag mit der Buchung zustande.]</p>
      <h2 id="storno">Stornierung</h2>
      <p>[Bis 24 Stunden vor Trainingsbeginn ist eine Stornierung oder Umbuchung über den persönlichen Link kostenlos. Bei späterer Absage oder Nichterscheinen wird … berechnet / verfällt die Einheit (Regel festlegen).]</p>
      <h2 id="zahlung">Zahlung</h2>
      <p>[Zahlungsmodalitäten, Anzahlung, Pakete/Karten, Gültigkeit.]</p>
      <h2 id="gesundheit">Gesundheits- und Haftungshinweis</h2>
      <p>[Boxtraining ist eine körperlich fordernde Sportart. Teilnehmende bestätigen, gesundheitlich in der Lage zu sein, am Training teilzunehmen, und klären dies bei Vorerkrankungen vorab ärztlich ab. Bestehende Verletzungen oder Einschränkungen sind vor dem Training mitzuteilen. Haftungsregelung nach anwaltlicher Prüfung ergänzen.]</p>
    </LegalPage>
  );
}
