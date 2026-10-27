/**
 * Zentrale Inhalte der Website. Alles in [ECKIGEN KLAMMERN] ist ein Platzhalter und muss
 * vor dem Livegang durch echte, vom Trainer freigegebene Inhalte ersetzt werden.
 * Preise, Dauer und Angebotstexte kommen aus der Datenbank (Admin → Angebote).
 */
export const site = {
  trainerName: "[NAME]",
  brand: "[NAME] Boxing",
  tagline: "Boxtraining, das dich wirklich weiterbringt.",
  city: "[ORT]",
  gym: "[GYM]",
  address: {
    street: "[Straße Nr.]",
    zip: "[PLZ]",
    city: "[ORT]",
    country: "DE",
    lat: 52.52,
    lng: 13.405,
  },
  mapsUrl: "https://maps.google.com/?q=[ADRESSE]",
  email: "kontakt@example.com",
  phone: "+49 [TELEFON]",
  instagram: "https://instagram.com/[HANDLE]",
  /** Antwortversprechen auf der Bestätigungsseite (muss zu settings.response_sla_hours passen) */
  responseHours: 24,
  priceRange: "€€",

  hero: {
    eyebrow: "Personal Boxing · [ORT]",
    title: "Lerne boxen.\nWerde stärker.",
    text: "[Kurze Nutzenaussage: 1:1-Training, Technik von Grund auf, Kondition und Selbstvertrauen – für Einsteiger bis Wettkampf.]",
    cta: "Training anfragen",
    secondary: "Angebote ansehen",
  },

  stats: [
    { value: "[10+]", label: "Jahre Erfahrung" },
    { value: "[500+]", label: "Trainierte Sportler" },
    { value: "[25]", label: "Wettkampfsiege" },
  ],

  about: {
    title: "Über [NAME]",
    paragraphs: [
      "[Werdegang: Wie bist du zum Boxen gekommen, was treibt dich als Trainer an?]",
      "[Trainingsphilosophie: Technik zuerst, individuell, sicher, fordernd.]",
    ],
    licenses: ["[Trainer-Lizenz, z. B. DBV C-Lizenz]", "[Erste-Hilfe-Zertifikat]", "[Weitere Qualifikation]"],
    achievements: ["[Erfolg 1, z. B. Landesmeister 20XX]", "[Erfolg 2]", "[Erfolg 3]"],
  },

  steps: [
    { title: "Anfragen", text: "Angebot und Wunschtermin wählen – dauert unter 2 Minuten." },
    { title: "Bestätigung", text: "Du bekommst innerhalb von 24 Std. eine Zusage per E-Mail oder WhatsApp." },
    { title: "Training", text: "Handschuhe an, los geht's. Alle Infos und der Kalendereintrag kommen mit der Bestätigung." },
  ],

  testimonials: [
    { name: "[Vorname N.]", meta: "[Einsteigerin, seit 6 Monaten]", quote: "[Echtes Zitat einer Kundin – nur mit Einwilligung veröffentlichen.]" },
    { name: "[Vorname N.]", meta: "[Fitness-Boxer]", quote: "[Echtes Zitat eines Kunden.]" },
    { name: "[Vorname N.]", meta: "[Amateur-Wettkämpfer]", quote: "[Echtes Zitat eines Kunden.]" },
  ],

  faq: [
    { q: "Welche Ausrüstung brauche ich?", a: "[Sportkleidung, Hallenschuhe, Getränk. Handschuhe und Bandagen können anfangs gestellt werden.]" },
    { q: "Brauche ich Erfahrung?", a: "[Nein. Das Training wird an dein Level angepasst – vom ersten Jab bis zur Wettkampfvorbereitung.]" },
    { q: "Wie kann ich stornieren?", a: "[Über den Link in deiner Bestätigung. Bis 24 Std. vorher kostenlos, danach gemäß Stornoregeln.]" },
    { q: "Wo findet das Training statt?", a: "[GYM, Straße Nr., PLZ ORT. Parkplätze / ÖPNV-Hinweis.]" },
    { q: "Gibt es Sparring?", a: "[Nur freiwillig, mit Schutzausrüstung und erst nach ausreichender Technikgrundlage.]" },
  ],

  legal: {
    owner: "[Vorname Nachname]",
    vatId: "[USt-IdNr. falls vorhanden]",
    /** Versionskennung der Einwilligungstexte – bei Textänderung hochzählen */
    consentVersion: "2026-10-v1",
  },
} as const;

export type Site = typeof site;
