-- DB-Tests für Constraints, Holds und Kapazität. Bricht beim ersten Fehler ab.
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Testhelfer --------------------------------------------------------------
create or replace function t_book(
  p_slug text, p_start timestamptz, p_email text,
  p_occurrence uuid default null, p_health text default null, p_consents jsonb default null
) returns uuid language sql as $$
  select booking_id from create_booking_request(
    (select id from offerings where slug = p_slug),
    p_start, p_occurrence,
    jsonb_build_object('email', p_email, 'name', 'Test', 'preferred_channel', 'email'),
    jsonb_build_object('health_notes', p_health),
    coalesce(p_consents, '[{"type":"privacy","text_version":"v1"}]'::jsonb)
  );
$$;

create or replace function t_expect_error(p_sql text, p_message text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ERWARTETER FEHLER "%" blieb aus: %', p_message, p_sql;
exception when others then
  if sqlerrm <> p_message then
    raise exception 'Falscher Fehler: "%" statt "%" bei %', sqlerrm, p_message, p_sql;
  end if;
end $$;

-- Fester Referenztag: übermorgen 10:00 UTC
create temp table t_ref as select date_trunc('day', now()) + interval '2 days 10 hours' as t0;

-- 1) Einzelbuchung → pending mit Hold ------------------------------------
do $$
declare t0 timestamptz := (select t0 from t_ref); b bookings; bid uuid;
begin
  -- erst ID holen: t_book ist volatile und würde in einem WHERE pro Zeile laufen
  bid := t_book('einzeltraining', t0, 'a@example.com');
  select * into b from bookings where id = bid;
  assert b.status = 'pending', 'Status pending erwartet';
  assert b.hold_expires_at between now() + interval '23 hours' and now() + interval '25 hours', 'Hold 24h';
  assert b.blocked_from = t0 - interval '15 min' and b.blocked_until = t0 + interval '75 min', 'Pufferbereich';
  raise notice 'ok 1 Einzelbuchung';
end $$;

-- 2) Überschneidung inkl. Puffer → slot_taken; außerhalb Puffer ok --------
do $$
declare t0 timestamptz := (select t0 from t_ref);
begin
  perform t_expect_error(format($q$select t_book('einzeltraining', %L, 'b@example.com')$q$, t0), 'slot_taken');
  -- belegt bis 11:15; neuer Termin 11:15 hätte Puffer ab 11:00 → Konflikt
  perform t_expect_error(format($q$select t_book('einzeltraining', %L, 'b@example.com')$q$, t0 + interval '75 min'), 'slot_taken');
  -- 11:30 → Puffer ab 11:15 → grenzt exakt an → ok
  perform t_book('einzeltraining', t0 + interval '90 min', 'b@example.com');
  raise notice 'ok 2 Puffer-Überschneidung';
end $$;

-- 3) Abgelaufener Hold gibt Slot frei -------------------------------------
do $$
declare t0 timestamptz := (select t0 from t_ref); old_id uuid; new_id uuid;
begin
  select id into old_id from bookings where starts_at = t0;
  update bookings set hold_expires_at = now() - interval '1 second' where id = old_id;
  new_id := t_book('einzeltraining', t0, 'c@example.com');
  assert (select status from bookings where id = old_id) = 'expired', 'alter Hold expired';
  assert (select status from bookings where id = new_id) = 'pending', 'neue Anfrage pending';
  raise notice 'ok 3 Hold-Ablauf';
end $$;

-- 4) Abgelehnt/storniert blockiert nicht ----------------------------------
do $$
declare t0 timestamptz := (select t0 from t_ref) + interval '1 day'; id1 uuid;
begin
  id1 := t_book('einzeltraining', t0, 'd@example.com');
  update bookings set status = 'declined', hold_expires_at = null where id = id1;
  perform t_book('einzeltraining', t0, 'e@example.com');
  raise notice 'ok 4 abgelehnt gibt frei';
end $$;

-- 5) Mindestvorlauf / Horizont -------------------------------------------
do $$
begin
  perform t_expect_error($q$select t_book('einzeltraining', now() + interval '1 hour', 'f@example.com')$q$, 'slot_taken');
  perform t_expect_error($q$select t_book('einzeltraining', now() + interval '90 days', 'f@example.com')$q$, 'slot_taken');
  raise notice 'ok 5 Vorlauf/Horizont';
end $$;

-- 6) Gruppen: Kapazität, Doppelbuchung, Nachrücken nach Storno -------------
do $$
declare
  t0 timestamptz := (select t0 from t_ref) + interval '3 days';
  ev uuid; occ uuid; b1 uuid;
begin
  select id into ev from special_events limit 1;
  insert into event_occurrences (special_event_id, starts_at, ends_at, capacity, buffer_after_min)
  values (ev, t0, t0 + interval '90 min', 2, 15) returning id into occ;

  -- Gruppentraining hat auto_confirm
  b1 := t_book('gruppentraining', null, 'g1@example.com', occ);
  assert (select status from bookings where id = b1) = 'confirmed', 'auto_confirm';
  perform t_expect_error(format($q$select t_book('gruppentraining', null, 'g1@example.com', %L)$q$, occ), 'already_booked');
  perform t_book('gruppentraining', null, 'g2@example.com', occ);
  perform t_expect_error(format($q$select t_book('gruppentraining', null, 'g3@example.com', %L)$q$, occ), 'occurrence_full');

  update bookings set status = 'cancelled', cancelled_at = now() where id = b1;
  perform t_book('gruppentraining', null, 'g3@example.com', occ);
  -- Reaktivieren der Stornierung würde überbuchen
  perform t_expect_error(format($q$update bookings set status = 'confirmed' where id = %L$q$, b1), 'occurrence_full');
  -- Gruppenangebot ohne Termin ist nicht buchbar
  perform t_expect_error(format($q$select t_book('gruppentraining', %L, 'g4@example.com')$q$, t0), 'occurrence_not_bookable');
  raise notice 'ok 6 Gruppenkapazität';
end $$;

-- 7) Einzeltermin vs. Gruppentermin --------------------------------------
do $$
declare t0 timestamptz := (select t0 from t_ref) + interval '3 days'; ev uuid;
begin
  -- Gruppe belegt t0 .. t0+105min (inkl. 15 Puffer danach)
  perform t_expect_error(format($q$select t_book('einzeltraining', %L, 'h@example.com')$q$, t0 + interval '60 min'), 'slot_taken');
  perform t_book('einzeltraining', t0 + interval '2 hours', 'h@example.com'); -- Puffer davor 15 → ab 1:45 ok
  -- Neuer Gruppentermin über bestehender Einzelbuchung → Fehler
  select id into ev from special_events limit 1;
  perform t_expect_error(
    format($q$insert into event_occurrences (special_event_id, starts_at, ends_at, capacity) values (%L, %L, %L, 4)$q$,
           ev, t0 + interval '2 hours', t0 + interval '3 hours'),
    'occurrence_conflicts_with_booking');
  raise notice 'ok 7 Einzel vs. Gruppe';
end $$;

-- 8) Einwilligungen ------------------------------------------------------
do $$
declare t0 timestamptz := (select t0 from t_ref) + interval '5 days';
begin
  perform t_expect_error(format($q$select t_book('einzeltraining', %L, 'i@example.com', null, null, '[]')$q$, t0), 'privacy_consent_missing');
  perform t_expect_error(format($q$select t_book('einzeltraining', %L, 'i@example.com', null, 'Knie')$q$, t0), 'health_consent_missing');
  perform t_book('einzeltraining', t0, 'i@example.com', null, 'Knie',
                 '[{"type":"privacy","text_version":"v1"},{"type":"health_data","text_version":"v1"}]');
  assert (select count(*) from consents c join customers cu on cu.id = c.customer_id
           where cu.email = 'i@example.com') = 2, 'Einwilligungen gespeichert';
  raise notice 'ok 8 Einwilligungen';
end $$;

-- 9) Bestehende Kontaktdaten werden nicht überschrieben -------------------
do $$
declare t0 timestamptz := (select t0 from t_ref) + interval '6 days';
begin
  update customers set phone = '+49111' where email = 'a@example.com';
  perform create_booking_request(
    (select id from offerings where slug = 'einzeltraining'), t0, null,
    '{"email":"A@Example.com","name":"Angreifer","phone":"+49999"}', '{}', '[{"type":"privacy"}]');
  assert (select phone from customers where email = 'a@example.com') = '+49111', 'Telefon unverändert';
  raise notice 'ok 9 Kontaktdaten geschützt';
end $$;

-- 10) Bestätigen/Ablehnen nur für Admins ---------------------------------
do $$
declare t0 timestamptz := (select t0 from t_ref) + interval '7 days'; bid uuid; uid uuid := gen_random_uuid();
begin
  bid := t_book('einzeltraining', t0, 'j@example.com');
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform t_expect_error(format('select confirm_booking(%L)', bid), 'forbidden');
  insert into auth.users (id) values (uid);
  insert into admins (user_id) values (uid);
  assert (confirm_booking(bid)).status = 'confirmed', 'Admin bestätigt';
  perform t_expect_error(format('select confirm_booking(%L)', bid), 'booking_not_pending');
  perform set_config('request.jwt.claims', '', true);
  raise notice 'ok 10 Admin-Bestätigung';
end $$;

-- 11) Abgelaufene Anfrage kann nicht mehr bestätigt werden -----------------
do $$
declare t0 timestamptz := (select t0 from t_ref) + interval '8 days'; bid uuid;
begin
  bid := t_book('einzeltraining', t0, 'k@example.com');
  update bookings set hold_expires_at = now() - interval '1 minute' where id = bid;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform t_expect_error(format('select confirm_booking(%L)', bid), 'booking_not_pending');
  assert (select count(*) from expire_stale_holds()) >= 1, 'expire liefert IDs';
  perform set_config('request.jwt.claims', '', true);
  raise notice 'ok 11 abgelaufene Anfrage';
end $$;

-- 12) DSGVO-Löschung kaskadiert -----------------------------------------
do $$
declare cid uuid := (select id from customers where email = 'i@example.com');
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform delete_customer_data(cid);
  assert not exists (select 1 from bookings where customer_id = cid), 'Buchungen gelöscht';
  assert not exists (select 1 from consents where customer_id = cid), 'Einwilligungen gelöscht';
  assert exists (select 1 from audit_log where entity_id = cid), 'Audit-Eintrag';
  perform set_config('request.jwt.claims', '', true);
  raise notice 'ok 12 Löschung';
end $$;

-- 13) RLS: anon sieht nur öffentliche Angebote ---------------------------
update offerings set visibility = 'unlisted' where slug = 'sondertermine';
set role anon;
do $$
begin
  assert (select count(*) from offerings) = 4, 'anon sieht 4 öffentliche Angebote';
  begin
    perform 1 from bookings;
    raise exception 'anon darf bookings nicht lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform t_book('einzeltraining', now() + interval '3 days', 'x@example.com');
    raise exception 'anon darf create_booking_request nicht aufrufen';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok 13 RLS anon';
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, false) \g /dev/null
do $$
begin
  assert (select count(*) from bookings) = 0, 'Nicht-Admin sieht keine Buchungen';
  raise notice 'ok 14 RLS Nicht-Admin';
end $$;
reset role;
