import "server-only";
import { render } from "@react-email/render";
import { createElement } from "react";
import { site } from "@/content/site";
import { BookingEmail, type BookingEmailProps } from "@/emails/BookingEmail";
import { env, integrations } from "../config";
import { getSettings, logMessage } from "../db/queries";
import type { Channel } from "../db/types";
import { log } from "../server/log";
import { formatForDisplay, formatLocalTime } from "../time/zoned";
import { ACCENT } from "../theme";
import { DEFAULT_TEMPLATES, fillTemplate, type MessageKind, type TemplateVar } from "./templates";

export interface NotifyTarget {
  customerId: string;
  bookingId?: string | null;
  name: string;
  email: string;
  phone: string | null;
  channel: Channel;
  whatsappConsent: boolean;
  offeringName: string;
  startsAt: Date;
  location?: string | null;
}

export interface NotifyOptions {
  link?: string;
  reason?: string | null;
  hours?: number;
  ics?: string;
  extraLinks?: { label: string; href: string }[];
}

interface OutboxItem {
  at: Date;
  to: string;
  channel: Channel;
  kind: string;
  subject: string;
  html: string;
}

/** Demo/Dry-Run: zuletzt "versendete" Nachrichten im Speicher (nur ohne echten Provider). */
const g = globalThis as unknown as { __btOutbox?: OutboxItem[] };
export function getOutbox(): OutboxItem[] {
  return (g.__btOutbox ??= []);
}
function pushOutbox(item: OutboxItem) {
  const box = getOutbox();
  box.unshift(item);
  box.length = Math.min(box.length, 50);
}

export async function renderMessage(kind: MessageKind, t: Pick<NotifyTarget, "name" | "offeringName" | "startsAt" | "location">, opts: NotifyOptions = {}) {
  const settings = await getSettings();
  const def = DEFAULT_TEMPLATES[kind];
  const override = settings.messageTemplates[kind] ?? {};
  const tz = settings.timezone;
  const vars: Record<TemplateVar, string> = {
    name: t.name.split(" ")[0] ?? t.name,
    angebot: t.offeringName,
    datum: formatForDisplay(t.startsAt.getTime(), tz, { weekday: "long", day: "numeric", month: "long" }),
    uhrzeit: formatLocalTime(t.startsAt.getTime(), tz),
    ort: t.location || settings.address || site.gym,
    grund: opts.reason ? `Grund: ${opts.reason}` : "",
    stunden: String(opts.hours ?? settings.responseSlaHours),
    link: opts.link ?? env.appUrl,
  };
  const subject = fillTemplate(override.subject || def.subject, vars);
  const body = fillTemplate(override.body || def.body, vars);
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const links = [...(opts.extraLinks ?? [])];
  if (def.showDetails && (settings.googleMapsUrl || site.mapsUrl)) {
    links.push({ label: "Anfahrt in Google Maps", href: settings.googleMapsUrl || site.mapsUrl });
  }
  const props: BookingEmailProps = {
    brand: settings.businessName || site.brand,
    accent: ACCENT,
    preview: subject,
    heading: subject,
    paragraphs,
    details: def.showDetails
      ? [
          { label: "Angebot", value: vars.angebot },
          { label: "Datum", value: vars.datum },
          { label: "Uhrzeit", value: `${vars.uhrzeit} Uhr` },
          { label: "Ort", value: vars.ort },
        ]
      : undefined,
    cta: def.cta && opts.link ? { label: def.cta, href: opts.link } : undefined,
    secondaryLinks: links,
    footer: `${settings.businessName || site.brand} · ${settings.address || site.gym} · Diese Nachricht wurde automatisch zu deiner Buchung versendet. Datenschutz: ${env.appUrl}/datenschutz`,
  };
  const element = createElement(BookingEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { subject, html, text, vars, def };
}

async function sendEmail(to: string, subject: string, html: string, text: string, ics?: string): Promise<string> {
  if (!integrations.email) return "dry-run";
  const { Resend } = await import("resend");
  const resend = new Resend(env.resendApiKey);
  const { data, error } = await resend.emails.send({
    from: env.emailFrom,
    to,
    subject,
    html,
    text,
    attachments: ics ? [{ filename: "termin.ics", content: Buffer.from(ics).toString("base64"), contentType: "text/calendar" }] : undefined,
  });
  if (error) throw new Error(`resend: ${error.message}`);
  return data?.id ?? "unknown";
}

export function normalizePhone(phone: string): string | null {
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  else if (p.startsWith("00")) p = p.slice(2);
  else if (p.startsWith("0")) p = `49${p.slice(1)}`;
  return /^\d{8,15}$/.test(p) ? p : null;
}

async function sendWhatsApp(phone: string, template: string, params: string[]): Promise<string> {
  const to = normalizePhone(phone);
  if (!to) throw new Error("whatsapp: ungültige Telefonnummer");
  const res = await fetch(`https://graph.facebook.com/v21.0/${env.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.whatsappToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: env.whatsappTemplateLang },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text || "-" })) }],
      },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`whatsapp: ${res.status} ${json.error?.message ?? ""}`);
  return json.messages?.[0]?.id ?? "unknown";
}

/**
 * Kundennachricht über den bevorzugten Kanal. WhatsApp nur mit Opt-in und freigegebenem
 * Template; bei Fehler Fallback auf E-Mail. Fehler werden geloggt, nie geworfen –
 * eine fehlgeschlagene Nachricht darf den Buchungsvorgang nicht abbrechen.
 */
export async function notifyCustomer(kind: MessageKind, t: NotifyTarget, opts: NotifyOptions = {}): Promise<void> {
  try {
    const msg = await renderMessage(kind, t, opts);
    const base = { bookingId: t.bookingId ?? null, customerId: t.customerId, template: kind };

    if (t.channel === "whatsapp" && t.whatsappConsent && t.phone) {
      if (integrations.whatsapp) {
        try {
          const id = await sendWhatsApp(t.phone, msg.def.whatsappTemplate, msg.def.whatsappParams.map((p) => msg.vars[p]));
          await logMessage({ ...base, channel: "whatsapp", status: "sent", providerMessageId: id });
          // Kalenderdatei gibt es nur per E-Mail → bei Bestätigung zusätzlich senden
          if (!opts.ics) return;
        } catch (err) {
          log.warn("whatsapp fehlgeschlagen, fallback e-mail", { kind, bookingId: t.bookingId ?? null });
          await logMessage({ ...base, channel: "whatsapp", status: "fallback", error: err instanceof Error ? err.message : "unknown" });
        }
      } else {
        pushOutbox({ at: new Date(), to: t.phone, channel: "whatsapp", kind, subject: `[WhatsApp-Template ${msg.def.whatsappTemplate}] ${msg.subject}`, html: msg.html });
        await logMessage({ ...base, channel: "whatsapp", status: "sent", providerMessageId: "dry-run" });
        if (!opts.ics) return;
      }
    }

    const id = await sendEmail(t.email, msg.subject, msg.html, msg.text, opts.ics);
    if (id === "dry-run") pushOutbox({ at: new Date(), to: t.email, channel: "email", kind, subject: msg.subject, html: msg.html });
    await logMessage({ ...base, channel: "email", status: "sent", providerMessageId: id });
  } catch (err) {
    log.error("nachricht fehlgeschlagen", err, { kind, bookingId: t.bookingId ?? null });
    await logMessage({ bookingId: t.bookingId ?? null, customerId: t.customerId, channel: "email", template: kind, status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "unknown" }).catch(() => {});
  }
}

/** Benachrichtigung an den Trainer (E-Mail). Enthält bewusst nur das Nötigste. */
export async function notifyTrainer(subject: string, lines: string[], link: string): Promise<void> {
  try {
    const settings = await getSettings();
    const to = settings.trainerNotifyEmail || env.trainerEmail;
    const element = createElement(BookingEmail, {
      brand: "Admin",
      accent: ACCENT,
      preview: subject,
      heading: subject,
      paragraphs: lines,
      cta: { label: "Im Dashboard öffnen", href: link },
      footer: "Automatische Benachrichtigung des Buchungssystems.",
    });
    const html = await render(element);
    if (!to || !integrations.email) {
      pushOutbox({ at: new Date(), to: to ?? "trainer (nicht konfiguriert)", channel: "email", kind: "trainer", subject, html });
      return;
    }
    await sendEmail(to, subject, html, await render(element, { plainText: true }));
  } catch (err) {
    log.error("trainer-benachrichtigung fehlgeschlagen", err);
  }
}
