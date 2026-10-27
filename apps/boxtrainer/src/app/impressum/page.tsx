import type { Metadata } from "next";
import { LegalPage } from "@/components/SiteChrome";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Impressum" };

export default function Impressum() {
  return (
    <LegalPage title="Impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {site.legal.owner}
        <br />
        {site.brand}
        <br />
        {site.address.street}
        <br />
        {site.address.zip} {site.address.city}
      </p>
      <h2>Kontakt</h2>
      <p>
        Telefon: {site.phone}
        <br />
        E-Mail: {site.email}
      </p>
      <h2>Umsatzsteuer</h2>
      <p>{site.legal.vatId}</p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>[Name, Anschrift – gemäß § 18 Abs. 2 MStV]</p>
      <h2>Verbraucherstreitbeilegung</h2>
      <p>[Hinweis zur Teilnahme/Nichtteilnahme an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle.]</p>
    </LegalPage>
  );
}
