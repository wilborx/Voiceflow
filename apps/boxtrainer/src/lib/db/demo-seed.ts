import { expandOccurrences } from "../availability/recurrence";
import { DAY_MS, addDays, isoWeekdayOf, localDateOf, zonedToUtc } from "../time/zoned";
import type { Db } from "./client";

/**
 * Fiktive Demo-Daten für die Präsentation (nur Demo-Modus). Alle Personen sind erfunden.
 */
const CUSTOMERS = [
  ["Lena Wagner", "lena.wagner@example.com", "+49 151 11111111", "whatsapp", "beginner", "instagram"],
  ["Murat Kaya", "murat.kaya@example.com", "+49 152 22222222", "email", "intermediate", "google"],
  ["Sophie Becker", "sophie.becker@example.com", null, "email", "beginner", "empfehlung"],
  ["Jonas Hoffmann", "jonas.hoffmann@example.com", "+49 160 33333333", "whatsapp", "advanced", "instagram"],
  ["Aylin Demir", "aylin.demir@example.com", "+49 170 44444444", "email", "competitive", "google"],
  ["Felix Schulz", "felix.schulz@example.com", null, "email", "beginner", "google"],
  ["Mia Richter", "mia.richter@example.com", "+49 171 55555555", "whatsapp", "intermediate", "instagram"],
  ["Noah Klein", "noah.klein@example.com", null, "email", "beginner", "empfehlung"],
  ["Emma Wolf", "emma.wolf@example.com", "+49 172 66666666", "email", "intermediate", "google"],
  ["Ben Neumann", "ben.neumann@example.com", null, "email", "advanced", "instagram"],
  ["Clara Fischer", "clara.fischer@example.com", "+49 173 77777777", "email", "beginner", "google"],
  ["David Lange", "david.lange@example.com", null, "email", "intermediate", "empfehlung"],
] as const;

const GOALS = [
  "Fitter werden und Stress abbauen",
  "Technik verbessern, Ziel erster Wettkampf",
  "Selbstbewusstsein und Selbstverteidigung",
  "Abnehmen und Kondition aufbauen",
];

export async function seedDemoData(db: Db): Promise<void> {
  const tz = "Europe/Berlin";
  const today = localDateOf(Date.now(), tz);
  const at = (date: string, h: number, m = 0) => new Date(zonedToUtc(date, h * 60 + m, tz));

  await db.query(
    `update settings set business_name = '[NAME] Boxing', address = '[GYM], [Straße Nr.], [PLZ ORT]',
       google_review_url = 'https://g.page/r/PLATZHALTER/review', trainer_notify_email = 'trainer@example.com',
       message_templates = '{}'::jsonb where id`,
  );
  await db.query(
    `update offerings set price_cents = case slug
        when 'probetraining' then 0 when 'einzeltraining' then 7900 when 'partnertraining' then 9900
        when 'gruppentraining' then 2500 when 'sondertermine' then 4900 end,
      description = case slug
        when 'probetraining' then '[Platzhalter] Lerne mich und das Training kennen: Technik-Check, Grundschläge, Zielgespräch.'
        when 'einzeltraining' then '[Platzhalter] Volle Aufmerksamkeit: Technik, Pratzen, Kondition – exakt auf dein Ziel abgestimmt.'
        when 'partnertraining' then '[Platzhalter] Zu zweit trainieren, Kosten teilen, gegenseitig pushen.'
        when 'gruppentraining' then '[Platzhalter] Kleine Gruppe, maximale Intensität: Technik, Partnerdrills, Zirkel.'
        when 'sondertermine' then '[Platzhalter] Workshops und Sparring-Tage mit eigenem Fokus.' end,
      location = '[GYM], [Straße Nr.], [PLZ ORT]'`,
  );
  await db.query(`update offerings set auto_confirm = false where slug = 'sondertermine'`);

  // Sondertermin: Sparring-Samstag (einmalig in ~2 Wochen) + Workshop
  const sat = nextWeekday(addDays(today, 10), 6);
  await db.query(
    `insert into special_events (offering_id, title, description, first_date, start_minute, duration_min, capacity, recurrence)
     select id, 'Sparring-Samstag', '[Platzhalter] Kontrolliertes Sparring mit Schutzausrüstung', $1::date, 15 * 60, 180, 10, 'none'::recurrence_kind
       from offerings where slug = 'sondertermine'
     union all
     select id, 'Workshop Defensive', '[Platzhalter] Meidbewegungen, Blocks und Konter', $2::date, 15 * 60, 150, 12, 'none'::recurrence_kind
       from offerings where slug = 'sondertermine'`,
    [sat, addDays(sat, 21)],
  );

  // Termine für die nächsten 8 Wochen materialisieren
  const events = await db.query<{ id: string; firstDate: string; startMinute: number; durationMin: number; capacity: number; recurrence: "none" | "weekly"; bufferAfter: number }>(
    `select e.id, e.first_date::text as "firstDate", e.start_minute as "startMinute", e.duration_min as "durationMin",
            e.capacity, e.recurrence, o.buffer_after_min as "bufferAfter"
       from special_events e join offerings o on o.id = e.offering_id`,
  );
  for (const e of events) {
    for (const p of expandOccurrences(e, today, addDays(today, 56), tz)) {
      await db.query(
        `insert into event_occurrences (special_event_id, starts_at, ends_at, capacity, buffer_after_min)
         values ($1, $2, $3, $4, $5) on conflict do nothing`,
        [e.id, new Date(p.startsAt), new Date(p.endsAt), e.capacity, e.bufferAfter],
      );
    }
  }

  // Kunden + Einwilligungen
  const ids: string[] = [];
  for (const [i, [name, email, phone, channel, level]] of CUSTOMERS.entries()) {
    const rows = await db.query<{ id: string }>(
      `insert into customers (email, name, phone, preferred_channel, experience_level, created_at)
       values ($1, $2, $3, $4, $5, now() - make_interval(days => $6)) returning id`,
      [email, name, phone, channel, level, 70 - i * 4],
    );
    ids.push(rows[0]!.id);
    await db.query(`insert into consents (customer_id, type, text_version, granted_at) values ($1, 'privacy', 'demo', now() - make_interval(days => $2))`, [rows[0]!.id, 70 - i * 4]);
    if (channel === "whatsapp") {
      await db.query(`insert into consents (customer_id, type, text_version) values ($1, 'whatsapp', 'demo')`, [rows[0]!.id]);
    }
  }

  const offering = async (slug: string) =>
    (await db.query<{ id: string; dur: number; bb: number; ba: number }>(
      `select id, duration_min as dur, buffer_before_min as bb, buffer_after_min as ba from offerings where slug = $1`,
      [slug],
    ))[0]!;
  const one = await offering("einzeltraining");
  const trial = await offering("probetraining");
  const partner = await offering("partnertraining");

  async function single(o: typeof one, ci: number, start: Date, status: string, extra: Record<string, unknown> = {}) {
    const end = new Date(start.getTime() + o.dur * 60_000);
    const created = (extra.created as Date | undefined) ?? new Date(Math.min(Date.now(), start.getTime() - 3 * DAY_MS));
    const c = CUSTOMERS[ci]!;
    await db.query(
      `insert into bookings (offering_id, customer_id, status, starts_at, ends_at, buffer_before_min, buffer_after_min,
         blocked_from, blocked_until, hold_expires_at, experience_level, goal, health_notes, message, preferred_channel,
         utm, created_at, decided_at, cancelled_at, cancelled_by, decline_reason, reminder_sent)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [
        o.id, ids[ci], status, start, end, o.bb, o.ba,
        new Date(start.getTime() - o.bb * 60_000), new Date(end.getTime() + o.ba * 60_000),
        status === "pending" ? (extra.hold ?? new Date(Date.now() + 20 * 3_600_000)) : null,
        c[4], GOALS[ci % GOALS.length], extra.health ?? null, extra.message ?? null, c[3],
        JSON.stringify({ utm_source: c[5] }), created,
        ["confirmed", "completed", "no_show", "declined"].includes(status) ? created : null,
        status === "cancelled" ? created : null, status === "cancelled" ? "customer" : null,
        status === "declined" ? "Urlaub" : null,
        ["completed", "no_show"].includes(status) ? '{"followup": true}' : "{}",
      ],
    );
  }

  // Historie: letzte 8 Wochen
  const pastStatuses = ["completed", "completed", "completed", "no_show", "completed", "cancelled", "completed", "declined", "completed", "completed", "expired", "completed"];
  for (let w = 8, n = 0; w >= 1; w--) {
    for (const wd of [1, 3, 5]) {
      const date = nextWeekday(addDays(today, -7 * w), wd);
      if (date >= today) continue;
      const status = pastStatuses[n % pastStatuses.length]!;
      await single(n % 4 === 0 ? trial : one, n % CUSTOMERS.length, at(date, 17), status, { created: new Date(at(date, 17).getTime() - 4 * DAY_MS) });
      if (n % 2 === 0) await single(one, (n + 5) % CUSTOMERS.length, at(date, 19), "completed", { created: new Date(at(date, 19).getTime() - 6 * DAY_MS) });
      n++;
    }
  }

  // Kommende Woche(n): offene Anfragen und bestätigte Termine (Mo/Mi/Fr, ohne Gruppenzeiten)
  const d1 = nextWeekday(addDays(today, 2), 1);
  const d3 = nextWeekday(addDays(today, 2), 3);
  const d5 = nextWeekday(addDays(today, 2), 5);
  await single(trial, 2, at(d1, 17), "pending", { hold: new Date(Date.now() + 19 * 3_600_000), message: "Ich habe noch nie geboxt – ist das ok?", created: new Date(Date.now() - 5 * 3_600_000) });
  await single(one, 6, at(d3, 18, 30), "pending", { hold: new Date(Date.now() + 6 * 3_600_000), health: "Leichte Probleme mit der linken Schulter", created: new Date(Date.now() - 18 * 3_600_000) });
  await single(partner, 9, at(d5, 17), "pending", { hold: new Date(Date.now() + 22 * 3_600_000), message: "Wir kommen zu zweit (mit meinem Bruder).", created: new Date(Date.now() - 2 * 3_600_000) });
  await db.query(`insert into consents (customer_id, type, text_version) values ($1, 'health_data', 'demo')`, [ids[6]]);
  await single(one, 1, at(d1, 18, 30), "confirmed", { created: new Date(Date.now() - 2 * DAY_MS) });
  await single(one, 4, at(d3, 17), "confirmed", { created: new Date(Date.now() - 3 * DAY_MS) });
  await single(one, 3, at(addDays(d5, 7), 18, 30), "confirmed", { created: new Date(Date.now() - DAY_MS) });

  // Gruppen: nächster Dienstag voll + Warteliste, nächster Donnerstag teilweise
  const occ = await db.query<{ id: string; capacity: number; title: string }>(
    `select x.id, x.capacity, e.title from event_occurrences x join special_events e on e.id = x.special_event_id
      where x.starts_at > now() + interval '1 day' order by x.starts_at`,
  );
  const groups = occ.filter((o) => o.title === "Boxen Gruppe");
  const fill = async (occId: string, customerIdx: number[]) => {
    for (const ci of customerIdx) {
      await db.query(
        `insert into bookings (offering_id, customer_id, occurrence_id, status, starts_at, ends_at, buffer_before_min,
           buffer_after_min, blocked_from, blocked_until, preferred_channel, experience_level, utm, decided_at)
         select e.offering_id, $2, x.id, 'confirmed', x.starts_at, x.ends_at, x.buffer_before_min, x.buffer_after_min,
                x.starts_at - make_interval(mins => x.buffer_before_min), x.ends_at + make_interval(mins => x.buffer_after_min),
                c.preferred_channel, c.experience_level, jsonb_build_object('utm_source', 'instagram'), now()
           from event_occurrences x join special_events e on e.id = x.special_event_id, customers c
          where x.id = $1 and c.id = $2`,
        [occId, ids[ci]],
      );
    }
  };
  if (groups[0]) {
    await fill(groups[0].id, [0, 1, 3, 4, 6, 7, 8, 9]);
    await db.query(`insert into waitlist_entries (occurrence_id, customer_id) values ($1, $2), ($1, $3)`, [groups[0].id, ids[10], ids[11]]);
  }
  if (groups[1]) await fill(groups[1].id, [2, 5, 10]);
  const sparring = occ.find((o) => o.title === "Sparring-Samstag");
  if (sparring) await fill(sparring.id, [3, 4, 9, 1]);

  // Urlaub in ~5 Wochen
  const vac = addDays(today, 35);
  await db.query(`insert into availability_exceptions (kind, start_date, end_date, note) values ('blocked', $1, $2, 'Urlaub (Demo)')`, [vac, addDays(vac, 4)]);

  // Paket-Beispiele
  await db.query(
    `insert into packages (name, credits, price_cents, valid_days) values
       ('5er-Karte 1:1 [Platzhalter]', 5, 36900, 120), ('10er-Karte 1:1 [Platzhalter]', 10, 69900, 240)`,
  );
}

/** Nächstes Datum ab `from` (inklusive) mit dem ISO-Wochentag `wd`. */
function nextWeekday(from: string, wd: number): string {
  let d = from;
  while (isoWeekdayOf(d) !== wd) d = addDays(d, 1);
  return d;
}
