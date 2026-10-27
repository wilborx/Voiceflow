/**
 * Nachrichtenvorlagen. Betreff und Text sind im Admin (Einstellungen → Nachrichten)
 * überschreibbar; Platzhalter in {geschweiften Klammern}.
 * WhatsApp nutzt ausschließlich die bei Meta freigegebenen Templates (Name hier), deren
 * Parameter-Reihenfolge in `whatsappParams` festgelegt ist.
 */
export const MESSAGE_KINDS = [
  "request_received",
  "booking_confirmed",
  "booking_declined",
  "alternative_proposed",
  "request_expired",
  "reminder",
  "waitlist_joined",
  "waitlist_offer",
  "booking_cancelled",
  "followup",
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export type TemplateVar =
  | "name"
  | "angebot"
  | "datum"
  | "uhrzeit"
  | "ort"
  | "grund"
  | "stunden"
  | "link";

export interface TemplateDef {
  label: string;
  subject: string;
  body: string;
  /** Name des freigegebenen WhatsApp-Templates */
  whatsappTemplate: string;
  whatsappParams: TemplateVar[];
  /** Beschriftung des Haupt-Buttons (Link = {link}) */
  cta?: string;
  showDetails: boolean;
}

export const DEFAULT_TEMPLATES: Record<MessageKind, TemplateDef> = {
  request_received: {
    label: "Anfrage eingegangen",
    subject: "Deine Anfrage für {angebot} ist eingegangen",
    body: "Hi {name},\n\ndanke für deine Anfrage! Ich prüfe den Termin und melde mich innerhalb von {stunden} Stunden mit einer Bestätigung.\n\nDer Termin ist so lange für dich reserviert.",
    whatsappTemplate: "booking_request_received",
    whatsappParams: ["name", "angebot", "datum", "uhrzeit"],
    cta: "Anfrage verwalten",
    showDetails: true,
  },
  booking_confirmed: {
    label: "Termin bestätigt",
    subject: "Bestätigt: {angebot} am {datum} um {uhrzeit}",
    body: "Hi {name},\n\ndein Termin steht! Im Anhang findest du den Kalendereintrag.\n\nBitte sei 10 Minuten vorher da und bring Sportkleidung, Hallenschuhe und etwas zu trinken mit.",
    whatsappTemplate: "booking_confirmed",
    whatsappParams: ["name", "angebot", "datum", "uhrzeit", "ort", "link"],
    cta: "Termin verwalten / umbuchen",
    showDetails: true,
  },
  booking_declined: {
    label: "Anfrage abgelehnt",
    subject: "Zu deiner Anfrage für {angebot}",
    body: "Hi {name},\n\nleider kann ich den Termin am {datum} um {uhrzeit} nicht wahrnehmen.\n{grund}\n\nSuch dir gerne einen anderen Termin aus – ich freue mich auf dich.",
    whatsappTemplate: "booking_declined",
    whatsappParams: ["name", "datum", "uhrzeit", "link"],
    cta: "Neuen Termin wählen",
    showDetails: false,
  },
  alternative_proposed: {
    label: "Gegenvorschlag",
    subject: "Terminvorschlag: {datum} um {uhrzeit}",
    body: "Hi {name},\n\nzu deinem Wunschtermin kann ich leider nicht, aber wie wäre es mit {datum} um {uhrzeit}?\n\nBestätige den Vorschlag einfach über den Button – oder lehne ab, dann such dir gern einen anderen Termin aus.",
    whatsappTemplate: "booking_alternative",
    whatsappParams: ["name", "datum", "uhrzeit", "link"],
    cta: "Vorschlag ansehen",
    showDetails: true,
  },
  request_expired: {
    label: "Anfrage abgelaufen",
    subject: "Deine Anfrage ist abgelaufen",
    body: "Hi {name},\n\nleider konnte ich deine Anfrage für {datum} um {uhrzeit} nicht rechtzeitig bestätigen. Das tut mir leid!\n\nBuch gern einen neuen Termin – ich melde mich diesmal schneller.",
    whatsappTemplate: "booking_expired",
    whatsappParams: ["name", "datum", "uhrzeit", "link"],
    cta: "Neuen Termin wählen",
    showDetails: false,
  },
  reminder: {
    label: "Erinnerung",
    subject: "Erinnerung: {angebot} {datum} um {uhrzeit}",
    body: "Hi {name},\n\nkurze Erinnerung: In {stunden} Stunden geht's los. Ich freu mich auf dich!",
    whatsappTemplate: "booking_reminder",
    whatsappParams: ["name", "angebot", "datum", "uhrzeit", "ort"],
    cta: "Termin verwalten",
    showDetails: true,
  },
  waitlist_joined: {
    label: "Warteliste: eingetragen",
    subject: "Du stehst auf der Warteliste: {angebot}",
    body: "Hi {name},\n\ndu stehst auf der Warteliste für {angebot} am {datum} um {uhrzeit}. Sobald ein Platz frei wird, melde ich mich sofort.",
    whatsappTemplate: "waitlist_joined",
    whatsappParams: ["name", "angebot", "datum", "uhrzeit"],
    showDetails: true,
  },
  waitlist_offer: {
    label: "Warteliste: Platz frei",
    subject: "Platz frei: {angebot} am {datum}",
    body: "Hi {name},\n\ngute Nachrichten: Für {angebot} am {datum} um {uhrzeit} ist ein Platz frei geworden. Er ist {stunden} Stunden für dich reserviert.",
    whatsappTemplate: "waitlist_spot_available",
    whatsappParams: ["name", "angebot", "datum", "uhrzeit", "link"],
    cta: "Platz sichern",
    showDetails: true,
  },
  booking_cancelled: {
    label: "Stornierung",
    subject: "Storniert: {angebot} am {datum}",
    body: "Hi {name},\n\ndein Termin am {datum} um {uhrzeit} wurde storniert.\n{grund}",
    whatsappTemplate: "booking_cancelled",
    whatsappParams: ["name", "datum", "uhrzeit"],
    cta: "Neuen Termin buchen",
    showDetails: false,
  },
  followup: {
    label: "Nach dem Training",
    subject: "Danke fürs Training, {name}!",
    body: "Hi {name},\n\nstark gemacht heute! Wenn dir das Training gefallen hat, würde mir eine kurze Google-Bewertung sehr helfen.\n\nUnd: Dranbleiben lohnt sich – buch dir direkt deine nächste Einheit.",
    whatsappTemplate: "training_followup",
    whatsappParams: ["name", "link"],
    cta: "Nächstes Training buchen",
    showDetails: false,
  },
};

export function fillTemplate(text: string, vars: Partial<Record<TemplateVar, string>>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? (vars[k as TemplateVar] ?? "") : m));
}
