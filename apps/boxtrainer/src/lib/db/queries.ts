import "server-only";
import type { AvailabilityException, AvailabilityRule, ExistingBooking } from "../availability/types";
import { sql, sqlOne } from "./client";
import type {
  BookingDetail,
  CustomerSummary,
  Occurrence,
  Offering,
  Settings,
  SpecialEvent,
} from "./types";

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------
const SETTINGS_COLS = `
  timezone, hold_hours as "holdHours", cancellation_hours as "cancellationHours",
  response_sla_hours as "responseSlaHours", waitlist_offer_hours as "waitlistOfferHours",
  reminder_offsets_min as "reminderOffsetsMin", business_name as "businessName", address,
  google_maps_url as "googleMapsUrl", google_review_url as "googleReviewUrl", features,
  message_templates as "messageTemplates", trainer_notify_email as "trainerNotifyEmail",
  payment_mode as "paymentMode", deposit_percent as "depositPercent",
  followup_delay_min as "followupDelayMin"`;

export async function getSettings(): Promise<Settings> {
  const row = await sqlOne<Settings>(`select ${SETTINGS_COLS} from settings where id`);
  if (row) return row;
  await sql("insert into settings default values on conflict do nothing");
  return (await sqlOne<Settings>(`select ${SETTINGS_COLS} from settings where id`))!;
}

export async function updateSettings(s: Partial<Settings>): Promise<void> {
  const map: Record<string, string> = {
    holdHours: "hold_hours",
    cancellationHours: "cancellation_hours",
    responseSlaHours: "response_sla_hours",
    waitlistOfferHours: "waitlist_offer_hours",
    reminderOffsetsMin: "reminder_offsets_min",
    businessName: "business_name",
    address: "address",
    googleMapsUrl: "google_maps_url",
    googleReviewUrl: "google_review_url",
    features: "features",
    messageTemplates: "message_templates",
    trainerNotifyEmail: "trainer_notify_email",
    paymentMode: "payment_mode",
    depositPercent: "deposit_percent",
    followupDelayMin: "followup_delay_min",
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(s)) {
    const col = map[k];
    if (!col || v === undefined) continue;
    params.push(typeof v === "object" && v !== null && !Array.isArray(v) ? JSON.stringify(v) : v);
    sets.push(`${col} = $${params.length}`);
  }
  if (sets.length) await sql(`update settings set ${sets.join(", ")} where id`, params);
}

// ---------------------------------------------------------------------------
// Angebote
// ---------------------------------------------------------------------------
const OFFERING_COLS = `
  id, slug, kind, name, description, duration_min as "durationMin",
  buffer_before_min as "bufferBeforeMin", buffer_after_min as "bufferAfterMin",
  min_notice_min as "minNoticeMin", max_horizon_days as "maxHorizonDays",
  slot_step_min as "slotStepMin", price_cents as "priceCents", currency, capacity, color,
  location, visibility, is_active as "isActive", auto_confirm as "autoConfirm",
  sort_order as "sortOrder"`;

export function listOfferings(opts: { publicOnly?: boolean } = {}): Promise<Offering[]> {
  const where = opts.publicOnly ? "where is_active and visibility = 'public'" : "";
  return sql<Offering>(`select ${OFFERING_COLS} from offerings ${where} order by sort_order, name`);
}

export function getOfferingBySlug(slug: string): Promise<Offering | undefined> {
  return sqlOne<Offering>(`select ${OFFERING_COLS} from offerings where slug = $1 and is_active`, [slug]);
}

export function getOffering(id: string): Promise<Offering | undefined> {
  return sqlOne<Offering>(`select ${OFFERING_COLS} from offerings where id = $1`, [id]);
}

export async function saveOffering(o: Omit<Offering, "id" | "currency"> & { id?: string }): Promise<void> {
  const params = [
    o.slug, o.kind, o.name, o.description, o.durationMin, o.bufferBeforeMin, o.bufferAfterMin,
    o.minNoticeMin, o.maxHorizonDays, o.slotStepMin, o.priceCents, o.capacity, o.color,
    o.location, o.visibility, o.isActive, o.autoConfirm, o.sortOrder,
  ];
  if (o.id) {
    await sql(
      `update offerings set slug=$1, kind=$2, name=$3, description=$4, duration_min=$5,
         buffer_before_min=$6, buffer_after_min=$7, min_notice_min=$8, max_horizon_days=$9,
         slot_step_min=$10, price_cents=$11, capacity=$12, color=$13, location=$14,
         visibility=$15, is_active=$16, auto_confirm=$17, sort_order=$18
       where id = $19`,
      [...params, o.id],
    );
  } else {
    await sql(
      `insert into offerings (slug, kind, name, description, duration_min, buffer_before_min,
         buffer_after_min, min_notice_min, max_horizon_days, slot_step_min, price_cents, capacity,
         color, location, visibility, is_active, auto_confirm, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      params,
    );
  }
}

// ---------------------------------------------------------------------------
// Verfügbarkeit
// ---------------------------------------------------------------------------
export function listRules(): Promise<(AvailabilityRule & { id: string })[]> {
  return sql(
    `select id, iso_weekday as "isoWeekday", start_minute as "startMinute", end_minute as "endMinute"
       from availability_rules order by iso_weekday, start_minute`,
  );
}

export async function addRule(r: AvailabilityRule): Promise<void> {
  await sql("insert into availability_rules (iso_weekday, start_minute, end_minute) values ($1,$2,$3)", [
    r.isoWeekday, r.startMinute, r.endMinute,
  ]);
}

export async function deleteRule(id: string): Promise<void> {
  await sql("delete from availability_rules where id = $1", [id]);
}

export function listExceptions(fromDate?: string): Promise<(AvailabilityException & { id: string; note: string | null })[]> {
  return sql(
    `select id, kind, start_date::text as "startDate", end_date::text as "endDate",
            start_minute as "startMinute", end_minute as "endMinute", note
       from availability_exceptions
      where $1::date is null or end_date >= $1::date
      order by start_date`,
    [fromDate ?? null],
  );
}

export async function addException(e: AvailabilityException & { note?: string | null }): Promise<void> {
  await sql(
    `insert into availability_exceptions (kind, start_date, end_date, start_minute, end_minute, note)
     values ($1,$2,$3,$4,$5,$6)`,
    [e.kind, e.startDate, e.endDate, e.startMinute ?? null, e.endMinute ?? null, e.note ?? null],
  );
}

export async function deleteException(id: string): Promise<void> {
  await sql("delete from availability_exceptions where id = $1", [id]);
}

/** Buchungen, die für die Verfügbarkeit relevant sind (Status-Filter macht die Engine). */
export function listBookingsForAvailability(from: Date, to: Date): Promise<(ExistingBooking & { id: string })[]> {
  return sql<ExistingBooking & { id: string }>(
    `select id, extract(epoch from starts_at) * 1000 as "startsAt", extract(epoch from ends_at) * 1000 as "endsAt",
            buffer_before_min as "bufferBeforeMin", buffer_after_min as "bufferAfterMin", status,
            extract(epoch from hold_expires_at) * 1000 as "holdExpiresAt",
            occurrence_id as "occurrenceId", seats
       from bookings
      where blocked_until > $1 and blocked_from < $2
        and status in ('pending', 'confirmed', 'completed', 'no_show')`,
    [from, to],
  ).then((rows) => rows.map((r) => ({ ...r, startsAt: Number(r.startsAt), endsAt: Number(r.endsAt), holdExpiresAt: r.holdExpiresAt == null ? null : Number(r.holdExpiresAt) })));
}

// ---------------------------------------------------------------------------
// Gruppen-/Sondertermine
// ---------------------------------------------------------------------------
export function listSpecialEvents(): Promise<SpecialEvent[]> {
  return sql<SpecialEvent>(
    `select e.id, e.offering_id as "offeringId", o.name as "offeringName", e.title, e.description,
            e.first_date::text as "firstDate", e.start_minute as "startMinute",
            e.duration_min as "durationMin", e.capacity, e.recurrence,
            e.recurrence_until::text as "recurrenceUntil",
            array(select d::text from unnest(e.skip_dates) d) as "skipDates",
            e.location, e.is_active as "isActive"
       from special_events e join offerings o on o.id = e.offering_id
      order by e.is_active desc, e.first_date`,
  );
}

export async function saveSpecialEvent(e: Omit<SpecialEvent, "id" | "offeringName"> & { id?: string }): Promise<string> {
  const params = [
    e.offeringId, e.title, e.description, e.firstDate, e.startMinute, e.durationMin, e.capacity,
    e.recurrence, e.recurrenceUntil, e.skipDates, e.location, e.isActive,
  ];
  if (e.id) {
    await sql(
      `update special_events set offering_id=$1, title=$2, description=$3, first_date=$4,
         start_minute=$5, duration_min=$6, capacity=$7, recurrence=$8, recurrence_until=$9,
         skip_dates=$10::date[], location=$11, is_active=$12 where id=$13`,
      [...params, e.id],
    );
    return e.id;
  }
  const row = await sqlOne<{ id: string }>(
    `insert into special_events (offering_id, title, description, first_date, start_minute,
       duration_min, capacity, recurrence, recurrence_until, skip_dates, location, is_active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date[],$11,$12) returning id`,
    params,
  );
  return row!.id;
}

const OCC_SELECT = `
  select x.id, x.special_event_id as "specialEventId", e.title, e.offering_id as "offeringId",
         x.starts_at as "startsAt", x.ends_at as "endsAt", x.capacity,
         x.buffer_before_min as "bufferBeforeMin", x.buffer_after_min as "bufferAfterMin", x.status,
         coalesce((select sum(b.seats) from bookings b where b.occurrence_id = x.id
                    and (b.status = 'confirmed' or (b.status = 'pending' and b.hold_expires_at > now()))), 0)::int as booked,
         (select count(*) from waitlist_entries w where w.occurrence_id = x.id and w.status in ('waiting', 'offered'))::int as waitlist
    from event_occurrences x join special_events e on e.id = x.special_event_id`;

export function listOccurrences(from: Date, to: Date, offeringId?: string): Promise<Occurrence[]> {
  return sql<Occurrence>(
    `${OCC_SELECT} where x.starts_at < $2 and x.ends_at > $1 and ($3::uuid is null or e.offering_id = $3)
      order by x.starts_at`,
    [from, to, offeringId ?? null],
  );
}

export function getOccurrence(id: string): Promise<Occurrence | undefined> {
  return sqlOne<Occurrence>(`${OCC_SELECT} where x.id = $1`, [id]);
}

// ---------------------------------------------------------------------------
// Buchungen
// ---------------------------------------------------------------------------
const BOOKING_SELECT = `
  select b.id, b.status, b.starts_at as "startsAt", b.ends_at as "endsAt",
         b.hold_expires_at as "holdExpiresAt", b.seats, b.occurrence_id as "occurrenceId",
         json_build_object('id', o.id, 'slug', o.slug, 'name', o.name, 'kind', o.kind,
           'location', o.location, 'priceCents', o.price_cents, 'capacity', o.capacity,
           'autoConfirm', o.auto_confirm, 'durationMin', o.duration_min, 'color', o.color) as offering,
         json_build_object('id', c.id, 'name', c.name, 'email', c.email::text, 'phone', c.phone) as customer,
         b.preferred_channel as "preferredChannel",
         exists (select 1 from consents k where k.customer_id = c.id and k.type = 'whatsapp' and k.revoked_at is null) as "whatsappConsent",
         b.experience_level as "experienceLevel", b.goal, b.health_notes as "healthNotes", b.message,
         b.utm, b.decline_reason as "declineReason", b.awaiting_customer as "awaitingCustomer",
         b.original_starts_at as "originalStartsAt", b.google_event_id as "googleEventId",
         b.payment_status as "paymentStatus", b.amount_due_cents as "amountDueCents",
         b.reminder_sent as "reminderSent", b.late_cancellation as "lateCancellation",
         b.admin_notes as "adminNotes", b.created_at as "createdAt", b.decided_at as "decidedAt",
         b.cancelled_at as "cancelledAt"
    from bookings b
    join offerings o on o.id = b.offering_id
    join customers c on c.id = b.customer_id`;

export function getBooking(id: string): Promise<BookingDetail | undefined> {
  return sqlOne<BookingDetail>(`${BOOKING_SELECT} where b.id = $1`, [id]);
}

export function getBookingByTokenHash(hash: string): Promise<BookingDetail | undefined> {
  return sqlOne<BookingDetail>(`${BOOKING_SELECT} where b.manage_token_hash = $1`, [hash]);
}

export function listBookings(filter: {
  status?: string[];
  from?: Date;
  to?: Date;
  customerId?: string;
  occurrenceId?: string;
  limit?: number;
}): Promise<BookingDetail[]> {
  return sql<BookingDetail>(
    `${BOOKING_SELECT}
      where ($1::text[] is null or b.status::text = any($1))
        and ($2::timestamptz is null or b.ends_at > $2)
        and ($3::timestamptz is null or b.starts_at < $3)
        and ($4::uuid is null or b.customer_id = $4)
        and ($5::uuid is null or b.occurrence_id = $5)
      order by b.starts_at
      limit $6`,
    [filter.status ?? null, filter.from ?? null, filter.to ?? null, filter.customerId ?? null, filter.occurrenceId ?? null, filter.limit ?? 500],
  );
}

export async function setManageTokenHash(bookingId: string, hash: string): Promise<void> {
  await sql("update bookings set manage_token_hash = $2 where id = $1", [bookingId, hash]);
}

// ---------------------------------------------------------------------------
// Kunden
// ---------------------------------------------------------------------------
export function listCustomers(search?: string): Promise<CustomerSummary[]> {
  return sql<CustomerSummary>(
    `select c.id, c.name, c.email::text as email, c.phone, c.created_at as "createdAt",
            count(b.id) filter (where b.status = 'completed')::int as sessions,
            count(b.id) filter (where b.status = 'no_show')::int as "noShows",
            count(b.id) filter (where b.status in ('pending', 'confirmed') and b.starts_at > now())::int as upcoming,
            max(b.starts_at) filter (where b.status = 'completed') as "lastSession"
       from customers c left join bookings b on b.customer_id = c.id
      where $1::text is null or c.name ilike '%' || $1 || '%' or c.email::text ilike '%' || $1 || '%'
      group by c.id
      order by c.name`,
    [search?.trim() || null],
  );
}

export function getCustomer(id: string) {
  return sqlOne<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    preferredChannel: string;
    experienceLevel: string | null;
    adminNotes: string;
    healthNotes: string | null;
    createdAt: Date;
    consents: { type: string; grantedAt: string; revokedAt: string | null; textVersion: string }[];
  }>(
    `select c.id, c.name, c.email::text as email, c.phone, c.preferred_channel as "preferredChannel",
            c.experience_level as "experienceLevel", c.admin_notes as "adminNotes",
            c.health_notes as "healthNotes", c.created_at as "createdAt",
            coalesce((select json_agg(json_build_object('type', k.type, 'grantedAt', k.granted_at,
                      'revokedAt', k.revoked_at, 'textVersion', k.text_version) order by k.granted_at desc)
                        from consents k where k.customer_id = c.id), '[]') as consents
       from customers c where c.id = $1`,
    [id],
  );
}

// ---------------------------------------------------------------------------
// Nachrichten-Log & Audit
// ---------------------------------------------------------------------------
export async function logMessage(m: {
  bookingId?: string | null;
  customerId?: string | null;
  channel: "email" | "whatsapp";
  template: string;
  status: "queued" | "sent" | "delivered" | "failed" | "fallback";
  providerMessageId?: string | null;
  error?: string | null;
}): Promise<void> {
  await sql(
    `insert into messages_log (booking_id, customer_id, channel, template, status, provider_message_id, error)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [m.bookingId ?? null, m.customerId ?? null, m.channel, m.template, m.status, m.providerMessageId ?? null, m.error ?? null],
  );
}

export function listMessages(limit = 100) {
  return sql<{
    id: string;
    channel: string;
    template: string;
    status: string;
    error: string | null;
    createdAt: Date;
    customerName: string | null;
    bookingId: string | null;
  }>(
    `select m.id, m.channel, m.template, m.status, m.error, m.created_at as "createdAt",
            c.name as "customerName", m.booking_id as "bookingId"
       from messages_log m left join customers c on c.id = m.customer_id
      order by m.created_at desc limit $1`,
    [limit],
  );
}

export async function audit(action: string, entity: string, entityId?: string | null): Promise<void> {
  await sql("insert into audit_log (action, entity, entity_id) values ($1,$2,$3)", [action, entity, entityId ?? null]);
}
