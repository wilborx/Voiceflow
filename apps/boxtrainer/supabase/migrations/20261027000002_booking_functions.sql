-- =============================================================================
-- Buchungslogik in der Datenbank: Holds, Kapazität, Überschneidungen.
-- Die App prüft Verfügbarkeit vorab (src/lib/availability); die DB garantiert
-- unabhängig davon, dass nie doppelt gebucht wird.
-- =============================================================================

-- Serialisiert alle Schreibvorgänge, die den Terminplan des Trainers verändern
-- (ein Trainer → geringe Last, dafür einfache und sichere Semantik).
create or replace function lock_schedule() returns void
language sql as $$
  select pg_advisory_xact_lock(hashtext('boxtrainer.schedule'));
$$;

-- Aufrufer ist Admin (Supabase Auth) oder der Server mit service_role-Key.
-- current_user ist in security-definer-Funktionen der Owner, daher JWT-Claim lesen.
create or replace function is_admin_or_service() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
         or is_admin();
$$;

-- ---------------------------------------------------------------------------
-- Abgelaufene Holds → 'expired'. Liefert die betroffenen Buchungen, damit die
-- App "Anfrage abgelaufen" versenden kann.
-- ---------------------------------------------------------------------------
create or replace function expire_stale_holds()
returns table (booking_id uuid)
language sql security definer set search_path = public as $$
  update bookings
     set status = 'expired', decided_at = now()
   where status = 'pending' and hold_expires_at <= now()
  returning id;
$$;

-- ---------------------------------------------------------------------------
-- Kapazität von Gruppenterminen (Trigger → gilt für jeden Schreibpfad).
-- Sperrt die Termin-Zeile, damit parallele Buchungen serialisiert werden.
-- ---------------------------------------------------------------------------
create or replace function bookings_check_capacity() returns trigger
language plpgsql as $$
declare
  occ event_occurrences%rowtype;
  taken integer;
begin
  if new.occurrence_id is null or new.status not in ('pending', 'confirmed') then
    return new;
  end if;
  -- Nur prüfen, wenn sich die Belegung erhöht
  if tg_op = 'UPDATE'
     and old.occurrence_id is not distinct from new.occurrence_id
     and old.status in ('pending', 'confirmed')
     and new.seats <= old.seats then
    return new;
  end if;

  select * into occ from event_occurrences where id = new.occurrence_id for update;
  if occ.status <> 'scheduled' then
    raise exception 'occurrence_not_bookable' using errcode = 'P0001';
  end if;

  select coalesce(sum(seats), 0) into taken
    from bookings
   where occurrence_id = new.occurrence_id
     and id <> new.id
     and (status = 'confirmed' or (status = 'pending' and hold_expires_at > now()));

  if taken + new.seats > occ.capacity then
    raise exception 'occurrence_full' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger bookings_capacity
  before insert or update of status, seats, occurrence_id on bookings
  for each row execute function bookings_check_capacity();

-- ---------------------------------------------------------------------------
-- Einzelbuchung darf keinen Gruppentermin überschneiden (inkl. Puffer)
-- ---------------------------------------------------------------------------
create or replace function bookings_check_occurrence_overlap() returns trigger
language plpgsql as $$
begin
  if new.occurrence_id is not null or new.status not in ('pending', 'confirmed') then
    return new;
  end if;
  perform lock_schedule();
  if exists (
    select 1 from event_occurrences o
     where o.status = 'scheduled'
       and tstzrange(o.starts_at - make_interval(mins => o.buffer_before_min),
                     o.ends_at + make_interval(mins => o.buffer_after_min), '[)')
           && tstzrange(new.blocked_from, new.blocked_until, '[)')
  ) then
    raise exception 'slot_taken' using errcode = 'P0001', detail = 'overlaps_event';
  end if;
  return new;
end $$;

create trigger bookings_occurrence_overlap
  before insert or update of status, starts_at, ends_at, blocked_from, blocked_until on bookings
  for each row execute function bookings_check_occurrence_overlap();

-- Umgekehrt: neuer/verschobener Gruppentermin darf keine aktive Einzelbuchung überdecken
create or replace function occurrences_check_overlap() returns trigger
language plpgsql as $$
begin
  if new.status <> 'scheduled' then
    return new;
  end if;
  perform lock_schedule();
  if exists (
    select 1 from bookings b
     where b.occurrence_id is null
       and (b.status = 'confirmed' or (b.status = 'pending' and b.hold_expires_at > now()))
       and tstzrange(b.blocked_from, b.blocked_until, '[)')
           && tstzrange(new.starts_at - make_interval(mins => new.buffer_before_min),
                        new.ends_at + make_interval(mins => new.buffer_after_min), '[)')
  ) then
    raise exception 'occurrence_conflicts_with_booking' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger occurrences_overlap
  before insert or update of status, starts_at, ends_at, buffer_before_min, buffer_after_min
  on event_occurrences
  for each row execute function occurrences_check_overlap();

-- ---------------------------------------------------------------------------
-- Öffentliche Anfrage anlegen (nur über den Server mit service_role aufrufbar).
--
-- Fehlercodes (SQLSTATE P0001, message):
--   offering_unavailable, occurrence_not_bookable, occurrence_full,
--   slot_taken, health_consent_missing, privacy_consent_missing
-- ---------------------------------------------------------------------------
create or replace function create_booking_request(
  p_offering_id uuid,
  p_starts_at timestamptz,          -- bei Gruppen ignoriert (kommt vom Termin)
  p_occurrence_id uuid,
  p_customer jsonb,                 -- {email, name, phone, preferred_channel, experience_level}
  p_intake jsonb,                   -- {goal, health_notes, message}
  p_consents jsonb,                 -- [{type, text_version}]
  p_utm jsonb default '{}'::jsonb,
  p_manage_token_hash text default null,
  p_seats integer default 1
)
returns table (booking_id uuid, status booking_status, hold_expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  o offerings%rowtype;
  occ event_occurrences%rowtype;
  s settings%rowtype;
  v_customer_id uuid;
  v_starts timestamptz;
  v_ends timestamptz;
  v_before integer;
  v_after integer;
  v_status booking_status;
  v_hold timestamptz;
  v_health text := nullif(trim(p_intake ->> 'health_notes'), '');
  v_booking_id uuid;
begin
  if not exists (select 1 from jsonb_array_elements(p_consents) c where c ->> 'type' = 'privacy') then
    raise exception 'privacy_consent_missing' using errcode = 'P0001';
  end if;
  if v_health is not null
     and not exists (select 1 from jsonb_array_elements(p_consents) c where c ->> 'type' = 'health_data') then
    raise exception 'health_consent_missing' using errcode = 'P0001';
  end if;

  select * into s from settings where id;
  if not found then
    insert into settings default values returning * into s;
  end if;

  select * into o from offerings where id = p_offering_id and is_active;
  if not found then
    raise exception 'offering_unavailable' using errcode = 'P0001';
  end if;

  -- Abgelaufene Holds freigeben, damit der Exclusion-Constraint sie nicht mehr zählt
  perform expire_stale_holds();

  if p_occurrence_id is not null then
    select * into occ from event_occurrences e
     where e.id = p_occurrence_id
       and e.special_event_id in (select id from special_events where offering_id = o.id);
    if not found or occ.status <> 'scheduled' or occ.starts_at <= now() then
      raise exception 'occurrence_not_bookable' using errcode = 'P0001';
    end if;
    v_starts := occ.starts_at;
    v_ends := occ.ends_at;
    v_before := occ.buffer_before_min;
    v_after := occ.buffer_after_min;
  else
    if o.capacity > 1 then
      raise exception 'occurrence_not_bookable' using errcode = 'P0001';
    end if;
    if p_starts_at < now() + make_interval(mins => o.min_notice_min)
       or p_starts_at > now() + make_interval(days => o.max_horizon_days) then
      raise exception 'slot_taken' using errcode = 'P0001', detail = 'outside_booking_window';
    end if;
    v_starts := p_starts_at;
    v_ends := p_starts_at + make_interval(mins => o.duration_min);
    v_before := o.buffer_before_min;
    v_after := o.buffer_after_min;
  end if;

  -- Kunde anlegen. Bestehende Kontaktdaten werden aus einem anonymen Formular
  -- NICHT überschrieben (sonst könnte jemand fremde Telefonnummern umleiten).
  insert into customers (email, name, phone, preferred_channel, experience_level)
  values (
    lower(trim(p_customer ->> 'email')),
    trim(p_customer ->> 'name'),
    nullif(trim(p_customer ->> 'phone'), ''),
    coalesce((p_customer ->> 'preferred_channel')::contact_channel, 'email'),
    (p_customer ->> 'experience_level')::experience_level
  )
  on conflict (email) do update
    set phone = coalesce(customers.phone, excluded.phone),
        experience_level = coalesce(excluded.experience_level, customers.experience_level)
  returning id into v_customer_id;

  insert into consents (customer_id, type, text_version)
  select v_customer_id, (c ->> 'type')::consent_type, coalesce(c ->> 'text_version', 'unknown')
    from jsonb_array_elements(p_consents) c;

  if o.auto_confirm then
    v_status := 'confirmed';
    v_hold := null;
  else
    v_status := 'pending';
    v_hold := now() + make_interval(hours => s.hold_hours);
  end if;

  begin
    insert into bookings (
      offering_id, customer_id, occurrence_id, status, starts_at, ends_at,
      buffer_before_min, buffer_after_min, blocked_from, blocked_until, seats,
      hold_expires_at, experience_level, goal, health_notes, message,
      preferred_channel, utm, manage_token_hash, decided_at
    ) values (
      o.id, v_customer_id, p_occurrence_id, v_status, v_starts, v_ends,
      v_before, v_after,
      v_starts - make_interval(mins => v_before), v_ends + make_interval(mins => v_after),
      greatest(1, coalesce(p_seats, 1)),
      v_hold,
      (p_customer ->> 'experience_level')::experience_level,
      nullif(trim(p_intake ->> 'goal'), ''),
      v_health,
      nullif(trim(p_intake ->> 'message'), ''),
      coalesce((p_customer ->> 'preferred_channel')::contact_channel, 'email'),
      coalesce(p_utm, '{}'::jsonb),
      p_manage_token_hash,
      case when v_status = 'confirmed' then now() end
    )
    returning id into v_booking_id;
  exception
    when exclusion_violation then
      raise exception 'slot_taken' using errcode = 'P0001';
    when unique_violation then
      raise exception 'already_booked' using errcode = 'P0001';
  end;

  return query select v_booking_id, v_status, v_hold;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: Anfrage bestätigen / ablehnen
-- ---------------------------------------------------------------------------
create or replace function confirm_booking(p_booking_id uuid)
returns bookings
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
begin
  if not is_admin_or_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update bookings
     set status = 'confirmed', hold_expires_at = null, decided_at = now()
   where id = p_booking_id
     and status = 'pending'
     and hold_expires_at > now()
  returning * into b;
  if not found then
    raise exception 'booking_not_pending' using errcode = 'P0001';
  end if;
  return b;
end $$;

create or replace function decline_booking(p_booking_id uuid, p_reason text default null)
returns bookings
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
begin
  if not is_admin_or_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update bookings
     set status = 'declined', hold_expires_at = null, decided_at = now(),
         decline_reason = nullif(trim(p_reason), '')
   where id = p_booking_id and status = 'pending'
  returning * into b;
  if not found then
    raise exception 'booking_not_pending' using errcode = 'P0001';
  end if;
  return b;
end $$;

-- ---------------------------------------------------------------------------
-- DSGVO: Kundendaten vollständig löschen (Buchungen, Einwilligungen, Logs kaskadieren)
-- ---------------------------------------------------------------------------
create or replace function delete_customer_data(p_customer_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin_or_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into audit_log (actor, action, entity, entity_id)
  values (auth.uid(), 'delete_customer_data', 'customers', p_customer_id);
  delete from customers where id = p_customer_id;
end $$;

-- Supabase vergibt per Default EXECUTE an anon/authenticated → explizit entziehen.
revoke all on function create_booking_request(uuid, timestamptz, uuid, jsonb, jsonb, jsonb, jsonb, text, integer) from public, anon, authenticated;
revoke all on function expire_stale_holds() from public, anon, authenticated;
revoke all on function lock_schedule() from public, anon, authenticated;
revoke all on function confirm_booking(uuid) from public, anon;
revoke all on function decline_booking(uuid, text) from public, anon;
revoke all on function delete_customer_data(uuid) from public, anon;

grant execute on function create_booking_request(uuid, timestamptz, uuid, jsonb, jsonb, jsonb, jsonb, text, integer) to service_role;
grant execute on function expire_stale_holds() to service_role;
grant execute on function confirm_booking(uuid) to authenticated, service_role;
grant execute on function decline_booking(uuid, text) to authenticated, service_role;
grant execute on function delete_customer_data(uuid) to authenticated, service_role;
