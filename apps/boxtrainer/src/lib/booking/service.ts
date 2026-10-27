import "server-only";
import { site } from "@/content/site";
import { isSingleSlotAvailable } from "../availability";
import { env } from "../config";
import { dbErrorMessage, sql, sqlOne } from "../db/client";
import { audit, getBooking, getOccurrence, getOfferingBySlug, getSettings, listBookings } from "../db/queries";
import type { BookingDetail } from "../db/types";
import { googleCreateEvent, googleDeleteEvent } from "../google";
import { buildIcs } from "../ics";
import { notifyCustomer, notifyTrainer, type NotifyTarget } from "../notify/send";
import { createBookingCheckout } from "../payments";
import { signId, verifySignedId } from "../server/crypto";
import { log } from "../server/log";
import { formatForDisplay, localDateOf } from "../time/zoned";
import { BOOKING_ERRORS, type BookingRequest } from "../validation";
import { ensureOccurrences, loadSingleInput } from "./slots";

export class BookingError extends Error {
  constructor(public code: string) {
    super(BOOKING_ERRORS[code] ?? "Das hat leider nicht geklappt. Bitte versuche es erneut.");
  }
}

/** DB-Fehlermeldung (raise exception '<code>') → BookingError */
function mapDbError(err: unknown): never {
  const msg = dbErrorMessage(err) ?? "";
  if (msg in BOOKING_ERRORS) throw new BookingError(msg);
  throw err;
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------
export const manageUrl = (bookingId: string) => `${env.appUrl}/buchung/${signId("booking", bookingId)}`;
export const bookAgainUrl = (slug?: string) => `${env.appUrl}/buchen${slug ? `?angebot=${slug}` : ""}`;

export function bookingIdFromToken(token: string): string | null {
  return verifySignedId("booking", token);
}

function target(b: BookingDetail): NotifyTarget {
  return {
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
  };
}

function when(d: Date): string {
  return formatForDisplay(d.getTime());
}

export function icsFor(b: BookingDetail, method: "PUBLISH" | "CANCEL" = "PUBLISH"): string {
  return buildIcs({
    uid: `${b.id}@boxtrainer`,
    start: b.startsAt,
    end: b.endsAt,
    title: `${b.offering.name} – ${site.brand}`,
    description: `Termin verwalten: ${manageUrl(b.id)}`,
    location: b.offering.location || site.gym,
    url: manageUrl(b.id),
    method,
    sequence: Math.floor(Date.now() / 1000),
  });
}

// ---------------------------------------------------------------------------
// Öffentliche Anfrage
// ---------------------------------------------------------------------------
export async function requestBooking(req: BookingRequest): Promise<{ status: "pending" | "confirmed"; bookingId: string }> {
  const offering = await getOfferingBySlug(req.offeringSlug);
  if (!offering) throw new BookingError("offering_unavailable");

  let startsAt: Date | null = null;
  if (offering.capacity === 1) {
    if (!req.startsAt) throw new BookingError("slot_taken");
    startsAt = new Date(req.startsAt);
    const day = localDateOf(startsAt.getTime());
    // Server prüft den Slot gegen Regeln, Ausnahmen und Google – die DB verhindert Überschneidungen
    if (!isSingleSlotAvailable(await loadSingleInput(offering, day, day), startsAt.getTime())) {
      throw new BookingError("slot_taken");
    }
  } else if (!req.occurrenceId) {
    throw new BookingError("occurrence_not_bookable");
  }

  const consents = [
    { type: "privacy", text_version: site.legal.consentVersion },
    ...(req.consents.whatsapp ? [{ type: "whatsapp", text_version: site.legal.consentVersion }] : []),
    ...(req.consents.health && req.contact.healthNotes ? [{ type: "health_data", text_version: site.legal.consentVersion }] : []),
  ];

  let row: { booking_id: string; status: "pending" | "confirmed" } | undefined;
  try {
    row = await sqlOne(
      `select * from create_booking_request($1, $2, $3, $4, $5, $6, $7)`,
      [
        offering.id,
        startsAt,
        req.occurrenceId ?? null,
        JSON.stringify({
          email: req.contact.email,
          name: req.contact.name,
          phone: req.contact.phone || null,
          preferred_channel: req.contact.preferredChannel,
          experience_level: req.contact.experienceLevel,
        }),
        JSON.stringify({ goal: req.contact.goal, health_notes: req.contact.healthNotes, message: req.contact.message }),
        JSON.stringify(consents),
        JSON.stringify(req.utm ?? {}),
      ],
    );
  } catch (err) {
    mapDbError(err);
  }
  const b = (await getBooking(row!.booking_id))!;
  log.info("neue buchung", { bookingId: b.id, status: b.status, offering: offering.slug });

  if (b.status === "confirmed") {
    await afterConfirm(b);
    await notifyTrainer(`Neue Buchung (auto-bestätigt): ${b.offering.name}`, [`${b.customer.name} – ${when(b.startsAt)}`], `${env.appUrl}/admin/kalender`);
  } else {
    await notifyCustomer("request_received", target(b), { link: manageUrl(b.id) });
    await notifyTrainer(
      `Neue Anfrage: ${b.offering.name}`,
      [`${b.customer.name} – ${when(b.startsAt)}`, `Läuft ab: ${b.holdExpiresAt ? when(b.holdExpiresAt) : "-"}`],
      `${env.appUrl}/admin`,
    );
  }
  return { status: b.status as "pending" | "confirmed", bookingId: b.id };
}

/** Bestätigung: Google-Event, Zahlungslink, Nachricht mit .ics */
async function afterConfirm(b: BookingDetail): Promise<void> {
  const settings = await getSettings();
  if (!b.occurrenceId && !b.googleEventId) {
    const notes = [
      `Kunde: ${b.customer.name}`,
      b.customer.phone ? `Telefon: ${b.customer.phone}` : "",
      b.experienceLevel ? `Level: ${b.experienceLevel}` : "",
      b.goal ? `Ziel: ${b.goal}` : "",
      `Details: ${env.appUrl}/admin`,
    ].filter(Boolean).join("\n");
    const eventId = await googleCreateEvent(b, notes);
    if (eventId) await sql("update bookings set google_event_id = $2 where id = $1", [b.id, eventId]);
  }
  const extraLinks: { label: string; href: string }[] = [];
  const payUrl = await createBookingCheckout(b, settings, manageUrl(b.id));
  if (payUrl) extraLinks.push({ label: "Jetzt bezahlen", href: payUrl });
  extraLinks.push({ label: "Kalendereintrag herunterladen", href: `${env.appUrl}/api/ics/${signId("booking", b.id)}` });
  await notifyCustomer("booking_confirmed", target(b), { link: manageUrl(b.id), ics: icsFor(b), extraLinks });
}

// ---------------------------------------------------------------------------
// Admin-Aktionen
// ---------------------------------------------------------------------------
export async function confirmBooking(id: string): Promise<void> {
  try {
    await sql("select confirm_booking($1)", [id]);
  } catch (err) {
    mapDbError(err);
  }
  await sql("update bookings set awaiting_customer = false where id = $1", [id]);
  await audit("confirm", "bookings", id);
  await afterConfirm((await getBooking(id))!);
}

export async function declineBooking(id: string, reason: string | null): Promise<void> {
  try {
    await sql("select decline_booking($1, $2)", [id, reason]);
  } catch (err) {
    mapDbError(err);
  }
  await audit("decline", "bookings", id);
  const b = (await getBooking(id))!;
  await notifyCustomer("booking_declined", target(b), { link: bookAgainUrl(b.offering.slug), reason });
  if (b.occurrenceId) await offerWaitlist(b.occurrenceId);
}

/** Gegenvorschlag: Termin wird sofort auf den neuen Slot verschoben und dort gehalten. */
export async function proposeAlternative(id: string, newStart: Date): Promise<void> {
  const b = await getBooking(id);
  if (!b || b.occurrenceId) throw new BookingError("booking_not_movable");
  await assertSlotFree(b, newStart);
  const settings = await getSettings();
  try {
    await sql("select move_booking($1, $2, 'pending', $3, true)", [id, newStart, settings.holdHours]);
  } catch (err) {
    mapDbError(err);
  }
  await audit("propose", "bookings", id);
  const moved = (await getBooking(id))!;
  await notifyCustomer("alternative_proposed", target(moved), { link: manageUrl(id) });
}

export async function cancelByAdmin(id: string, reason: string | null): Promise<void> {
  const b = await getBooking(id);
  if (!b || !["pending", "confirmed"].includes(b.status)) throw new BookingError("booking_not_movable");
  await sql(
    "update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'admin', decline_reason = $2, hold_expires_at = null where id = $1",
    [id, reason],
  );
  await audit("cancel_admin", "bookings", id);
  await googleDeleteEvent(b.googleEventId);
  await notifyCustomer("booking_cancelled", target(b), { link: bookAgainUrl(b.offering.slug), reason });
  if (b.occurrenceId) await offerWaitlist(b.occurrenceId);
}

export async function setAttendance(id: string, status: "completed" | "no_show" | "confirmed"): Promise<void> {
  await sql("update bookings set status = $2 where id = $1 and status in ('confirmed', 'completed', 'no_show')", [id, status]);
  await audit(`attendance_${status}`, "bookings", id);
}

// ---------------------------------------------------------------------------
// Self-Service (Kunde, per signiertem Link)
// ---------------------------------------------------------------------------
export async function getManageView(token: string) {
  const id = bookingIdFromToken(token);
  if (!id) return null;
  const b = await getBooking(id);
  if (!b) return null;
  const settings = await getSettings();
  const hoursLeft = (b.startsAt.getTime() - Date.now()) / 3_600_000;
  const active = ["pending", "confirmed"].includes(b.status) && hoursLeft > 0;
  return {
    booking: b,
    settings,
    canCancel: active,
    freeCancellation: hoursLeft >= settings.cancellationHours,
    canReschedule: active && !b.occurrenceId && hoursLeft >= settings.cancellationHours && !b.awaitingCustomer,
    awaitingCustomer: active && b.awaitingCustomer && b.status === "pending",
  };
}

export async function cancelByCustomer(token: string): Promise<{ late: boolean }> {
  const view = await getManageView(token);
  if (!view?.canCancel) throw new BookingError("booking_not_movable");
  const b = view.booking;
  const late = !view.freeCancellation && b.status === "confirmed";
  await sql(
    "update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer', late_cancellation = $2, hold_expires_at = null where id = $1",
    [b.id, late],
  );
  await googleDeleteEvent(b.googleEventId);
  await notifyCustomer("booking_cancelled", target(b), {
    link: bookAgainUrl(b.offering.slug),
    reason: late ? "Die Stornierung erfolgte kurzfristig – es gelten die Stornoregeln." : null,
  });
  await notifyTrainer(`Storniert${late ? " (kurzfristig)" : ""}: ${b.offering.name}`, [`${b.customer.name} – ${when(b.startsAt)}`], `${env.appUrl}/admin/kalender`);
  await sql("update waitlist_entries set status = 'removed' where booking_id = $1", [b.id]);
  if (b.occurrenceId) await offerWaitlist(b.occurrenceId);
  return { late };
}

export async function acceptProposal(token: string): Promise<void> {
  const view = await getManageView(token);
  if (!view?.awaitingCustomer) throw new BookingError("booking_not_pending");
  const b = view.booking;
  try {
    await sql("select confirm_booking($1)", [b.id]);
  } catch (err) {
    mapDbError(err);
  }
  await sql("update bookings set awaiting_customer = false where id = $1", [b.id]);
  await sql("update waitlist_entries set status = 'accepted' where booking_id = $1", [b.id]);
  await afterConfirm((await getBooking(b.id))!);
  await notifyTrainer(`Termin angenommen: ${b.offering.name}`, [`${b.customer.name} – ${when(b.startsAt)}`], `${env.appUrl}/admin/kalender`);
}

export async function rejectProposal(token: string): Promise<void> {
  const view = await getManageView(token);
  if (!view?.awaitingCustomer) throw new BookingError("booking_not_pending");
  const b = view.booking;
  await sql("update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer', hold_expires_at = null, awaiting_customer = false where id = $1", [b.id]);
  await sql("update waitlist_entries set status = 'removed' where booking_id = $1", [b.id]);
  await notifyTrainer(`Vorschlag abgelehnt: ${b.offering.name}`, [`${b.customer.name} – ${when(b.startsAt)}`], `${env.appUrl}/admin`);
  if (b.occurrenceId) await offerWaitlist(b.occurrenceId);
}

export async function rescheduleByCustomer(token: string, newStart: Date): Promise<"pending" | "confirmed"> {
  const view = await getManageView(token);
  if (!view?.canReschedule) throw new BookingError("booking_not_movable");
  const b = view.booking;
  await assertSlotFree(b, newStart);
  const status = b.offering.autoConfirm ? "confirmed" : "pending";
  try {
    await sql("select move_booking($1, $2, $3, $4, false)", [b.id, newStart, status, view.settings.holdHours]);
  } catch (err) {
    mapDbError(err);
  }
  await googleDeleteEvent(b.googleEventId);
  await sql("update bookings set google_event_id = null where id = $1", [b.id]);
  const moved = (await getBooking(b.id))!;
  if (status === "confirmed") await afterConfirm(moved);
  else await notifyCustomer("request_received", target(moved), { link: manageUrl(b.id) });
  await notifyTrainer(`Umbuchung: ${b.offering.name}`, [`${b.customer.name}`, `alt: ${when(b.startsAt)}`, `neu: ${when(moved.startsAt)}`], `${env.appUrl}/admin`);
  return status;
}

async function assertSlotFree(b: BookingDetail, newStart: Date): Promise<void> {
  const offering = await getOfferingBySlug(b.offering.slug);
  if (!offering) throw new BookingError("offering_unavailable");
  const day = localDateOf(newStart.getTime());
  const input = await loadSingleInput(offering, day, day, b.id);
  if (!isSingleSlotAvailable(input, newStart.getTime())) throw new BookingError("slot_taken");
}

// ---------------------------------------------------------------------------
// Warteliste
// ---------------------------------------------------------------------------
export async function joinWaitlist(req: BookingRequest): Promise<void> {
  if (!req.occurrenceId) throw new BookingError("occurrence_not_bookable");
  const occ = await getOccurrence(req.occurrenceId);
  const offering = await getOfferingBySlug(req.offeringSlug);
  if (!occ || !offering || occ.offeringId !== offering.id || occ.status !== "scheduled" || occ.startsAt <= new Date()) {
    throw new BookingError("occurrence_not_bookable");
  }
  const c = await sqlOne<{ id: string }>(
    `insert into customers (email, name, phone, preferred_channel, experience_level)
     values ($1, $2, $3, $4, $5)
     on conflict (email) do update set phone = coalesce(customers.phone, excluded.phone)
     returning id`,
    [req.contact.email, req.contact.name, req.contact.phone || null, req.contact.preferredChannel, req.contact.experienceLevel],
  );
  const consents = ["privacy", ...(req.consents.whatsapp ? ["whatsapp"] : [])];
  for (const type of consents) {
    await sql("insert into consents (customer_id, type, text_version, source) values ($1, $2, $3, 'waitlist')", [c!.id, type, site.legal.consentVersion]);
  }
  try {
    await sql("insert into waitlist_entries (occurrence_id, customer_id) values ($1, $2)", [occ.id, c!.id]);
  } catch {
    throw new BookingError("already_waiting");
  }
  await notifyCustomer("waitlist_joined", {
    customerId: c!.id,
    name: req.contact.name,
    email: req.contact.email,
    phone: req.contact.phone || null,
    channel: req.contact.preferredChannel,
    whatsappConsent: req.consents.whatsapp,
    offeringName: occ.title,
    startsAt: occ.startsAt,
    location: offering.location,
  });
  // Falls zwischenzeitlich ein Platz frei ist
  await offerWaitlist(occ.id);
}

/**
 * Automatisches Nachrücken: Für jeden freien Platz wird der nächste Wartende mit einem
 * reservierten Platz (pending + Hold) eingeladen und muss per Link zusagen.
 */
export async function offerWaitlist(occurrenceId: string): Promise<void> {
  const occ = await getOccurrence(occurrenceId);
  if (!occ || occ.status !== "scheduled" || occ.startsAt.getTime() < Date.now() + 2 * 3_600_000) return;
  const settings = await getSettings();
  let free = occ.capacity - occ.booked;
  while (free > 0) {
    const next = await sqlOne<{ id: string; customerId: string }>(
      `select id, customer_id as "customerId" from waitlist_entries
        where occurrence_id = $1 and status = 'waiting' order by created_at limit 1`,
      [occurrenceId],
    );
    if (!next) return;
    const holdUntil = new Date(Math.min(Date.now() + settings.waitlistOfferHours * 3_600_000, occ.startsAt.getTime() - 3_600_000));
    let bookingId: string | undefined;
    try {
      const row = await sqlOne<{ id: string }>(
        `insert into bookings (offering_id, customer_id, occurrence_id, status, starts_at, ends_at,
           buffer_before_min, buffer_after_min, blocked_from, blocked_until, hold_expires_at,
           awaiting_customer, preferred_channel, experience_level)
         select $2, c.id, x.id, 'pending', x.starts_at, x.ends_at, x.buffer_before_min, x.buffer_after_min,
                x.starts_at - make_interval(mins => x.buffer_before_min), x.ends_at + make_interval(mins => x.buffer_after_min),
                $4, true, c.preferred_channel, c.experience_level
           from event_occurrences x, customers c where x.id = $1 and c.id = $3
         returning id`,
        [occurrenceId, occ.offeringId, next.customerId, holdUntil],
      );
      bookingId = row?.id;
    } catch (err) {
      log.warn("nachrücken fehlgeschlagen", { occurrenceId, error: dbErrorMessage(err) ?? "unknown" });
      await sql("update waitlist_entries set status = 'removed' where id = $1", [next.id]);
      continue;
    }
    await sql("update waitlist_entries set status = 'offered', offered_at = now(), offer_expires_at = $2, booking_id = $3 where id = $1", [next.id, holdUntil, bookingId]);
    const b = (await getBooking(bookingId!))!;
    await notifyCustomer("waitlist_offer", target(b), {
      link: manageUrl(b.id),
      hours: Math.max(1, Math.round((holdUntil.getTime() - Date.now()) / 3_600_000)),
    });
    free -= 1;
  }
}

// ---------------------------------------------------------------------------
// Wartung (Cron): Holds, Erinnerungen, Follow-ups, Warteliste, Termine
// ---------------------------------------------------------------------------
const gm = globalThis as unknown as { __btMaintAt?: number };

export async function runMaintenance(opts: { force?: boolean } = {}): Promise<Record<string, number>> {
  if (!opts.force && gm.__btMaintAt && Date.now() - gm.__btMaintAt < 60_000) return {};
  gm.__btMaintAt = Date.now();
  const stats = { expired: 0, reminders: 0, followups: 0 };
  const settings = await getSettings();

  // 1) Abgelaufene Holds
  const expired = await sql<{ booking_id: string }>("select booking_id from expire_stale_holds()");
  for (const { booking_id } of expired) {
    stats.expired++;
    const b = await getBooking(booking_id);
    if (!b) continue;
    const wl = await sqlOne<{ id: string }>("update waitlist_entries set status = 'expired' where booking_id = $1 returning id", [b.id]);
    if (b.occurrenceId) await offerWaitlist(b.occurrenceId);
    // Abgelaufenes Wartelisten-Angebot: keine "Anfrage abgelaufen"-Nachricht
    if (wl) continue;
    await notifyCustomer("request_expired", target(b), { link: bookAgainUrl(b.offering.slug) });
  }

  // 2) Erinnerungen (z. B. 24 h und 2 h vorher), atomar "geclaimt" gegen Doppelversand
  const maxOffset = Math.max(0, ...settings.reminderOffsetsMin);
  const upcoming = await listBookings({ status: ["confirmed"], from: new Date(), to: new Date(Date.now() + maxOffset * 60_000) });
  for (const b of upcoming) {
    const minutesLeft = (b.startsAt.getTime() - Date.now()) / 60_000;
    // Nur den kleinsten fälligen Offset senden (wer 3 h vorher bucht, bekommt keine 24-h-Erinnerung)
    const due = settings.reminderOffsetsMin
      .filter((o) => minutesLeft <= o && (!b.decidedAt || (b.startsAt.getTime() - b.decidedAt.getTime()) / 60_000 > o))
      .sort((a, z) => a - z)[0];
    if (due === undefined || b.reminderSent[String(due)]) continue;
    const claimed = await sqlOne(
      `update bookings set reminder_sent = reminder_sent || jsonb_build_object($2::text, now())
        where id = $1 and not (reminder_sent ? $2::text) returning id`,
      [b.id, String(due)],
    );
    if (!claimed) continue;
    stats.reminders++;
    await notifyCustomer("reminder", target(b), { link: manageUrl(b.id), hours: Math.max(1, Math.round(minutesLeft / 60)) });
  }

  // 3) Nach dem Training: als absolviert markieren + Danke/Bewertung/Rebooking
  const done = await sql<{ id: string }>(
    `update bookings set status = 'completed', reminder_sent = reminder_sent || '{"followup": true}'::jsonb
      where status = 'confirmed' and ends_at + make_interval(mins => $1) < now()
        and not (reminder_sent ? 'followup')
      returning id`,
    [settings.followupDelayMin],
  );
  for (const { id } of done) {
    const b = await getBooking(id);
    if (!b) continue;
    stats.followups++;
    const review = settings.googleReviewUrl ? [{ label: "Google-Bewertung schreiben", href: settings.googleReviewUrl }] : [];
    await notifyCustomer("followup", target(b), { link: bookAgainUrl(b.offering.slug), extraLinks: review });
  }

  // 4) Termine verlängern + freie Plätze an die Warteliste
  await ensureOccurrences();
  const openWaitlists = await sql<{ id: string }>(
    `select distinct w.occurrence_id as id from waitlist_entries w
       join event_occurrences x on x.id = w.occurrence_id
      where w.status = 'waiting' and x.starts_at > now()`,
  );
  for (const { id } of openWaitlists) await offerWaitlist(id);

  if (stats.expired || stats.reminders || stats.followups) log.info("wartung", stats);
  return stats;
}

export { getBooking };
