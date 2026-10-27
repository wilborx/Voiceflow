import { z } from "zod";

export const CHANNELS = ["email", "whatsapp"] as const;
export const LEVELS = ["beginner", "intermediate", "advanced", "competitive"] as const;

const trimmed = (max: number) => z.string().trim().max(max);

/** Intake-Daten (Schritt 3) – Client und Server nutzen dasselbe Schema. */
export const contactSchema = z
  .object({
    name: trimmed(100).min(2, "Bitte gib deinen Namen an."),
    email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse an.").max(200),
    phone: trimmed(40)
      .regex(/^[+\d][\d\s/()-]{5,}$/, "Bitte gib eine gültige Telefonnummer an.")
      .optional()
      .or(z.literal("")),
    preferredChannel: z.enum(CHANNELS),
    experienceLevel: z.enum(LEVELS, { errorMap: () => ({ message: "Bitte wähle dein Erfahrungslevel." }) }),
    goal: trimmed(500).optional().or(z.literal("")),
    healthNotes: trimmed(1000).optional().or(z.literal("")),
    message: trimmed(2000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.preferredChannel === "whatsapp" && !v.phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Für WhatsApp brauchen wir deine Handynummer." });
    }
  });

export const consentSchema = z.object({
  privacy: z.literal(true, { errorMap: () => ({ message: "Bitte stimme der Datenschutzerklärung zu." }) }),
  whatsapp: z.boolean(),
  health: z.boolean(),
});

export const bookingRequestSchema = z
  .object({
    mode: z.enum(["book", "waitlist"]).default("book"),
    offeringSlug: z.string().regex(/^[a-z0-9-]+$/),
    startsAt: z.string().datetime().optional(),
    occurrenceId: z.string().uuid().optional(),
    contact: contactSchema,
    consents: consentSchema,
    utm: z.record(z.string().max(100)).default({}),
    /** Honeypot: muss leer bleiben */
    website: z.string().max(0).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (!v.startsAt && !v.occurrenceId) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Bitte wähle einen Termin." });
    if (v.contact.healthNotes && !v.consents.health) {
      ctx.addIssue({ code: "custom", path: ["consents", "health"], message: "Für Angaben zu Verletzungen brauchen wir deine Einwilligung – oder lass das Feld leer." });
    }
    if (v.contact.preferredChannel === "whatsapp" && !v.consents.whatsapp) {
      ctx.addIssue({ code: "custom", path: ["consents", "whatsapp"], message: "Für Nachrichten per WhatsApp brauchen wir deine Einwilligung." });
    }
  });

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

/** Fehlercodes aus der DB → verständliche Meldungen */
export const BOOKING_ERRORS: Record<string, string> = {
  slot_taken: "Dieser Termin ist leider gerade vergeben worden. Bitte wähle einen anderen.",
  occurrence_full: "Dieser Termin ist inzwischen ausgebucht. Du kannst dich auf die Warteliste setzen.",
  occurrence_not_bookable: "Dieser Termin ist nicht mehr buchbar.",
  offering_unavailable: "Dieses Angebot ist aktuell nicht buchbar.",
  already_booked: "Du bist für diesen Termin bereits angemeldet.",
  already_waiting: "Du stehst für diesen Termin bereits auf der Warteliste.",
  privacy_consent_missing: "Bitte stimme der Datenschutzerklärung zu.",
  health_consent_missing: "Bitte willige in die Verarbeitung deiner Gesundheitsangaben ein.",
  rate_limited: "Zu viele Anfragen. Bitte versuche es in ein paar Minuten erneut.",
  booking_not_pending: "Diese Anfrage ist nicht mehr offen.",
  booking_not_movable: "Dieser Termin kann nicht verschoben werden.",
};
