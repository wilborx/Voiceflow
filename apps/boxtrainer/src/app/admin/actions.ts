"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { login, logout, requireAdmin } from "@/lib/auth";
import {
  BookingError,
  cancelByAdmin,
  confirmBooking,
  declineBooking,
  offerWaitlist,
  proposeAlternative,
  setAttendance,
} from "@/lib/booking/service";
import { regenerateOccurrences } from "@/lib/booking/slots";
import { sql, sqlOne } from "@/lib/db/client";
import {
  addException,
  addRule,
  audit,
  deleteException,
  deleteRule,
  getBooking,
  getSettings,
  saveOffering,
  saveSpecialEvent,
  updateSettings,
} from "@/lib/db/queries";
import type { OfferingKind } from "@/lib/db/types";
import { googleDisconnect } from "@/lib/google";
import { notifyCustomer } from "@/lib/notify/send";
import { MESSAGE_KINDS } from "@/lib/notify/templates";
import { log } from "@/lib/server/log";
import { rateLimit } from "@/lib/server/ratelimit";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string, d = 0) => {
  const v = Number(str(f, k).replace(",", "."));
  return Number.isFinite(v) ? v : d;
};
const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";
const hhmmToMin = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function back(path: string, msg?: string, error?: boolean): never {
  revalidatePath("/admin", "layout");
  const url = msg ? `${path}${path.includes("?") ? "&" : "?"}${error ? "fehler" : "ok"}=${encodeURIComponent(msg)}` : path;
  redirect(url);
}

async function guarded(path: string, fn: () => Promise<string | void>): Promise<never> {
  await requireAdmin();
  let msg: string | void;
  try {
    msg = await fn();
  } catch (err) {
    if (err instanceof BookingError) back(path, err.message, true);
    log.error("admin-aktion fehlgeschlagen", err);
    back(path, "Aktion fehlgeschlagen. Details im Server-Log.", true);
  }
  back(path, msg || undefined);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function loginAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  if (!(await rateLimit("login", 10, 900))) return { error: "Zu viele Versuche. Bitte warte ein paar Minuten." };
  const ok = await login(str(form, "email"), String(form.get("password") ?? ""));
  if (!ok) return { error: "E-Mail oder Passwort falsch." };
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Anfragen
// ---------------------------------------------------------------------------
export async function confirmAction(form: FormData) {
  const id = str(form, "id");
  return guarded(str(form, "back") || "/admin", async () => {
    await confirmBooking(id);
    return "Bestätigt – Kunde wurde benachrichtigt.";
  });
}

export async function declineAction(form: FormData) {
  return guarded(str(form, "back") || "/admin", async () => {
    await declineBooking(str(form, "id"), str(form, "reason") || null);
    return "Abgelehnt – Kunde wurde benachrichtigt.";
  });
}

export async function proposeAction(form: FormData) {
  return guarded(str(form, "back") || "/admin", async () => {
    const start = str(form, "start");
    if (!start) throw new BookingError("slot_taken");
    await proposeAlternative(str(form, "id"), new Date(start));
    return "Vorschlag gesendet – der Kunde bestätigt per Link.";
  });
}

export async function cancelBookingAction(form: FormData) {
  return guarded(str(form, "back") || "/admin", async () => {
    await cancelByAdmin(str(form, "id"), str(form, "reason") || null);
    return "Storniert – Kunde wurde benachrichtigt.";
  });
}

export async function attendanceAction(form: FormData) {
  const status = str(form, "status") as "completed" | "no_show" | "confirmed";
  return guarded(str(form, "back") || "/admin", async () => {
    await setAttendance(str(form, "id"), status);
    return status === "no_show" ? "Als No-Show markiert." : "Gespeichert.";
  });
}

export async function bookingNotesAction(form: FormData) {
  return guarded(str(form, "back") || "/admin", async () => {
    await sql("update bookings set admin_notes = $2 where id = $1", [str(form, "id"), str(form, "notes").slice(0, 5000)]);
    return "Notiz gespeichert.";
  });
}

export async function resendConfirmationAction(form: FormData) {
  return guarded(str(form, "back") || "/admin", async () => {
    const b = await getBooking(str(form, "id"));
    if (!b) return;
    await notifyCustomer("reminder", {
      customerId: b.customer.id,
      bookingId: b.id,
      name: b.customer.name,
      email: b.customer.email,
      phone: b.customer.phone,
      channel: b.preferredChannel,
      whatsappConsent: b.whatsappConsent,
      offeringName: b.offering.name,
      startsAt: b.startsAt,
      location: b.offering.location,
    });
    return "Erinnerung gesendet.";
  });
}

// ---------------------------------------------------------------------------
// Angebote & Pakete
// ---------------------------------------------------------------------------
export async function saveOfferingAction(form: FormData) {
  return guarded("/admin/angebote", async () => {
    const price = str(form, "price");
    await saveOffering({
      id: str(form, "id") || undefined,
      slug: str(form, "slug").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
      kind: str(form, "kind") as OfferingKind,
      name: str(form, "name"),
      description: str(form, "description"),
      durationMin: num(form, "durationMin", 60),
      bufferBeforeMin: num(form, "bufferBeforeMin"),
      bufferAfterMin: num(form, "bufferAfterMin"),
      minNoticeMin: Math.round(num(form, "minNoticeHours", 12) * 60),
      maxHorizonDays: num(form, "maxHorizonDays", 60),
      slotStepMin: num(form, "slotStepMin", 30),
      priceCents: price === "" ? null : Math.round(Number(price.replace(",", ".")) * 100),
      capacity: Math.max(1, num(form, "capacity", 1)),
      color: str(form, "color") || "#e5383b",
      location: str(form, "location"),
      visibility: str(form, "visibility") === "unlisted" ? "unlisted" : "public",
      isActive: bool(form, "isActive"),
      autoConfirm: bool(form, "autoConfirm"),
      sortOrder: num(form, "sortOrder"),
    });
    return "Angebot gespeichert.";
  });
}

export async function savePackageAction(form: FormData) {
  return guarded("/admin/angebote", async () => {
    await sql("insert into packages (name, credits, price_cents, valid_days) values ($1, $2, $3, $4)", [
      str(form, "name"),
      Math.max(1, num(form, "credits", 5)),
      Math.round(num(form, "price") * 100),
      str(form, "validDays") ? num(form, "validDays") : null,
    ]);
    return "Paket angelegt.";
  });
}

export async function togglePackageAction(form: FormData) {
  return guarded("/admin/angebote", async () => {
    await sql("update packages set is_active = not is_active where id = $1", [str(form, "id")]);
  });
}

// ---------------------------------------------------------------------------
// Sondertermine / Gruppen
// ---------------------------------------------------------------------------
export async function saveEventAction(form: FormData) {
  return guarded("/admin/termine", async () => {
    const recurrence = str(form, "recurrence") === "weekly" ? "weekly" : "none";
    const id = await saveSpecialEvent({
      id: str(form, "id") || undefined,
      offeringId: str(form, "offeringId"),
      title: str(form, "title"),
      description: str(form, "description"),
      firstDate: str(form, "firstDate"),
      startMinute: hhmmToMin(str(form, "startTime")),
      durationMin: num(form, "durationMin", 90),
      capacity: Math.max(1, num(form, "capacity", 8)),
      recurrence,
      recurrenceUntil: recurrence === "weekly" && str(form, "recurrenceUntil") ? str(form, "recurrenceUntil") : null,
      skipDates: str(form, "skipDates").split(/[\s,]+/).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
      location: str(form, "location") || null,
      isActive: bool(form, "isActive"),
    });
    await regenerateOccurrences(id);
    return "Termin gespeichert, Termine aktualisiert.";
  });
}

export async function cancelOccurrenceAction(form: FormData) {
  const id = str(form, "id");
  return guarded(`/admin/termine/${id}`, async () => {
    const reason = str(form, "reason") || "Der Termin muss leider ausfallen.";
    const active = await sql<{ id: string }>("select id from bookings where occurrence_id = $1 and status in ('pending', 'confirmed')", [id]);
    await sql("update event_occurrences set status = 'cancelled' where id = $1", [id]);
    await sql("update waitlist_entries set status = 'removed' where occurrence_id = $1 and status in ('waiting', 'offered')", [id]);
    for (const b of active) await cancelByAdmin(b.id, reason);
    await audit("cancel_occurrence", "event_occurrences", id);
    return `Termin abgesagt, ${active.length} Teilnehmer benachrichtigt.`;
  });
}

export async function offerWaitlistAction(form: FormData) {
  const id = str(form, "id");
  return guarded(`/admin/termine/${id}`, async () => {
    await offerWaitlist(id);
    return "Freie Plätze wurden der Warteliste angeboten.";
  });
}

// ---------------------------------------------------------------------------
// Kunden
// ---------------------------------------------------------------------------
export async function customerNotesAction(form: FormData) {
  const id = str(form, "id");
  return guarded(`/admin/kunden/${id}`, async () => {
    await sql("update customers set admin_notes = $2 where id = $1", [id, str(form, "notes").slice(0, 10000)]);
    return "Notiz gespeichert.";
  });
}

export async function deleteCustomerAction(form: FormData) {
  const id = str(form, "id");
  await requireAdmin();
  if (str(form, "confirm") !== "LÖSCHEN") back(`/admin/kunden/${id}`, "Bitte zur Bestätigung LÖSCHEN eintippen.", true);
  await sql("select delete_customer_data($1)", [id]);
  back("/admin/kunden", "Kunde und alle zugehörigen Daten wurden gelöscht.");
}

export async function assignPackageAction(form: FormData) {
  const id = str(form, "customerId");
  return guarded(`/admin/kunden/${id}`, async () => {
    await sql(
      `insert into customer_packages (customer_id, package_id, credits_total, expires_at)
       select $1, p.id, p.credits, case when p.valid_days is null then null else now() + make_interval(days => p.valid_days) end
         from packages p where p.id = $2`,
      [id, str(form, "packageId")],
    );
    return "Paket zugewiesen.";
  });
}

export async function redeemCreditAction(form: FormData) {
  const id = str(form, "customerId");
  return guarded(str(form, "back") || `/admin/kunden/${id}`, async () => {
    const bookingId = str(form, "bookingId");
    const pkg = await sqlOne<{ id: string }>(
      `select id from customer_packages where customer_id = $1 and credits_used < credits_total
          and (expires_at is null or expires_at > now()) order by expires_at nulls last limit 1`,
      [id],
    );
    if (!pkg) return "Kein aktives Guthaben vorhanden.";
    await sql("insert into package_redemptions (customer_package_id, booking_id) values ($1, $2)", [pkg.id, bookingId]);
    await sql("update customer_packages set credits_used = credits_used + 1 where id = $1", [pkg.id]);
    await sql("update bookings set payment_status = 'paid' where id = $1", [bookingId]);
    return "1 Einheit vom Paket abgebucht.";
  });
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------
export async function saveGeneralSettingsAction(form: FormData) {
  return guarded("/admin/einstellungen", async () => {
    const current = await getSettings();
    await updateSettings({
      businessName: str(form, "businessName"),
      address: str(form, "address"),
      googleMapsUrl: str(form, "googleMapsUrl") || null,
      googleReviewUrl: str(form, "googleReviewUrl") || null,
      trainerNotifyEmail: str(form, "trainerNotifyEmail") || null,
      holdHours: Math.min(168, Math.max(1, num(form, "holdHours", 24))),
      responseSlaHours: Math.max(1, num(form, "responseSlaHours", 24)),
      cancellationHours: Math.max(0, num(form, "cancellationHours", 24)),
      waitlistOfferHours: Math.max(1, num(form, "waitlistOfferHours", 12)),
      followupDelayMin: Math.max(0, num(form, "followupDelayMin", 120)),
      reminderOffsetsMin: str(form, "reminderHours")
        .split(/[\s,]+/)
        .map((h) => Math.round(Number(h.replace(",", ".")) * 60))
        .filter((m) => Number.isFinite(m) && m > 0),
      paymentMode: (["off", "deposit", "full"].includes(str(form, "paymentMode")) ? str(form, "paymentMode") : "off") as "off" | "deposit" | "full",
      depositPercent: Math.min(100, Math.max(1, num(form, "depositPercent", 30))),
      features: { ...current.features, payments: str(form, "paymentMode") !== "off", packages: bool(form, "packages") },
    });
    return "Einstellungen gespeichert.";
  });
}

export async function addRuleAction(form: FormData) {
  return guarded("/admin/einstellungen#verfuegbarkeit", async () => {
    const start = hhmmToMin(str(form, "start"));
    const end = str(form, "end") === "24:00" ? 1440 : hhmmToMin(str(form, "end"));
    if (end <= start) return "Ende muss nach dem Beginn liegen.";
    for (const d of form.getAll("weekday")) await addRule({ isoWeekday: Number(d), startMinute: start, endMinute: end });
    return "Zeitfenster hinzugefügt.";
  });
}

export async function deleteRuleAction(form: FormData) {
  return guarded("/admin/einstellungen#verfuegbarkeit", async () => {
    await deleteRule(str(form, "id"));
  });
}

export async function addExceptionAction(form: FormData) {
  return guarded("/admin/einstellungen#ausnahmen", async () => {
    const kind = str(form, "kind") === "extra" ? "extra" : "blocked";
    const allDay = kind === "blocked" && bool(form, "allDay");
    const startDate = str(form, "startDate");
    await addException({
      kind,
      startDate,
      endDate: str(form, "endDate") || startDate,
      startMinute: allDay ? null : hhmmToMin(str(form, "start")),
      endMinute: allDay ? null : str(form, "end") === "24:00" ? 1440 : hhmmToMin(str(form, "end")),
      note: str(form, "note") || null,
    });
    return "Ausnahme gespeichert.";
  });
}

export async function deleteExceptionAction(form: FormData) {
  return guarded("/admin/einstellungen#ausnahmen", async () => {
    await deleteException(str(form, "id"));
  });
}

export async function saveTemplatesAction(form: FormData) {
  return guarded("/admin/einstellungen#nachrichten", async () => {
    const templates: Record<string, { subject?: string; body?: string }> = {};
    for (const kind of MESSAGE_KINDS) {
      const subject = str(form, `${kind}.subject`);
      const body = String(form.get(`${kind}.body`) ?? "").trim();
      if (subject || body) templates[kind] = { ...(subject ? { subject } : {}), ...(body ? { body } : {}) };
    }
    await updateSettings({ messageTemplates: templates });
    return "Nachrichtentexte gespeichert.";
  });
}

export async function disconnectGoogleAction() {
  return guarded("/admin/einstellungen#integrationen", async () => {
    await googleDisconnect();
    return "Google Calendar getrennt.";
  });
}
