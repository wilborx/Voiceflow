-- Seed-Daten für lokale Entwicklung. Preise und Texte sind PLATZHALTER
-- und müssen vor dem Livegang vom Trainer freigegeben werden.

insert into settings (id, business_name, address)
values (true, '[NAME] Boxing', '[ADRESSE GYM]')
on conflict (id) do nothing;

insert into offerings
  (slug, kind, name, description, duration_min, buffer_before_min, buffer_after_min,
   min_notice_min, max_horizon_days, slot_step_min, price_cents, capacity, auto_confirm, sort_order)
values
  ('probetraining', 'trial', 'Probetraining', '[TEXT FOLGT]', 45, 0, 15, 720, 60, 30, null, 1, false, 1),
  ('einzeltraining', 'one_on_one', '1:1 Personal Training', '[TEXT FOLGT]', 60, 15, 15, 720, 60, 30, null, 1, false, 2),
  ('partnertraining', 'partner', 'Partnertraining', '[TEXT FOLGT]', 60, 15, 15, 720, 60, 30, null, 1, false, 3),
  ('gruppentraining', 'group', 'Gruppentraining', '[TEXT FOLGT]', 90, 0, 15, 120, 60, 30, null, 8, true, 4),
  ('sondertermine', 'special', 'Sondertermine', '[TEXT FOLGT]', 180, 0, 30, 720, 120, 30, null, 12, false, 5)
on conflict (slug) do nothing;

-- Mo–Fr 17:00–21:00, Sa 10:00–14:00 (Wandzeit Europe/Berlin)
insert into availability_rules (iso_weekday, start_minute, end_minute)
select d, 17 * 60, 21 * 60 from generate_series(1, 5) d
union all select 6, 10 * 60, 14 * 60;

-- Wöchentliches Gruppentraining Di + Do 18:30 (Termine erzeugt die App per expandOccurrences)
insert into special_events (offering_id, title, first_date, start_minute, duration_min, capacity, recurrence)
select o.id, 'Boxen Gruppe', current_date + ((d - extract(isodow from current_date)::int + 7) % 7),
       18 * 60 + 30, 90, 8, 'weekly'
  from offerings o, (values (2), (4)) as w(d)
 where o.slug = 'gruppentraining';
