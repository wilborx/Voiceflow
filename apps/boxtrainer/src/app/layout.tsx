import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import { site } from "@/content/site";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: `${site.brand} – Boxtraining in ${site.city}`, template: `%s | ${site.brand}` },
  description: `Personal Boxtraining mit ${site.trainerName} in ${site.city}: 1:1, Partner- und Gruppentraining für Einsteiger bis Wettkampf. Jetzt Probetraining anfragen.`,
  openGraph: { type: "website", locale: "de_DE", siteName: site.brand },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#0b0b0c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${anton.variable} ${inter.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-4 focus:py-2">
          Zum Inhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
