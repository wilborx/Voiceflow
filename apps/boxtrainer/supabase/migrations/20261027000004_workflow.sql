-- =============================================================================
-- Workflow-Erweiterungen: Gegenvorschlag, Zahlungen, Warteliste-Token,
-- Integrationen (Google), Rate-Limit-Funktion, Trainer-Benachrichtigung.
-- =============================================================================

-- Direkte Server-Verbindungen (DATABASE_URL, ohne PostgREST/JWT) gelten als vertrauenswürdig.
-- Über PostgREST ist request.jwt.claims immer gesetzt (auch für anon).
create or replace function is_admin_or_service() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_setting('request.jwt.claims', true), '') = ''
         or coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role'
         or is_admin();
$$;

alter table settings
  add column trainer_notify_email text,
  add column payment_mode text not null default 'off' check (payment_mode in ('off', 'deposit', 'full')),
  add column deposit_percent integer not null default 30 check (deposit_percent between 1 and 100),
  add column followup_delay_min integer not null default 120 check (followup_delay_min >= 0);

alter table bookings
  -- Trainer hat einen anderen Termin vorgeschlagen; Kunde muss per Link zustimmen
  add column awaiting_customer boolean not null default false,
  add column original_starts_at timestamptz,
  add column payment_status text not null default 'none'
    check (payment_status in ('none', 'open', 'paid', 'refunded')),
  add column amount_due_cents integer,
  add column stripe_checkout_id text,
  add column admin_notes text not null default '';

alter table waitlist_entries
  add column token_hash text unique,
  add column seats integer not null default 1 check (seats between 1 and 10);

-- Verschlüsselt gespeicherte Integrationsdaten (z. B. Google Refresh Token)
create table integrations (
  key text primary key,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);
alter table integrations enable row level security;
alter table integrations force row level security;
create policy admin_all on integrations for all to authenticated using (is_admin()) with check (is_admin());

-- Atomarer Zähler für Rate-Limiting: true = erlaubt
create or replace function hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;
  delete from rate_limits where window_start < now() - interval '1 day';
  return v_count <= p_max;
end $$;

revoke all on function hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, integer, integer) to service_role;

-- Termin verschieben (Gegenvorschlag / Umbuchung). Constraints & Trigger prüfen Konflikte.
create or replace function move_booking(
  p_booking_id uuid,
  p_new_start timestamptz,
  p_status booking_status,
  p_hold_hours integer,
  p_awaiting_customer boolean
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  dur interval;
begin
  if not is_admin_or_service() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform expire_stale_holds();
  select * into b from bookings where id = p_booking_id for update;
  if not found or b.occurrence_id is not null or b.status not in ('pending', 'confirmed') then
    raise exception 'booking_not_movable' using errcode = 'P0001';
  end if;
  dur := b.ends_at - b.starts_at;
  begin
    update bookings
       set original_starts_at = coalesce(original_starts_at, starts_at),
           starts_at = p_new_start,
           ends_at = p_new_start + dur,
           blocked_from = p_new_start - make_interval(mins => buffer_before_min),
           blocked_until = p_new_start + dur + make_interval(mins => buffer_after_min),
           status = p_status,
           hold_expires_at = case when p_status = 'pending' then now() + make_interval(hours => p_hold_hours) end,
           awaiting_customer = p_awaiting_customer,
           decided_at = case when p_status = 'confirmed' then now() else decided_at end,
           reminder_sent = '{}'::jsonb
     where id = p_booking_id
    returning * into b;
  exception when exclusion_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;
  return b;
end $$;

revoke all on function move_booking(uuid, timestamptz, booking_status, integer, boolean) from public, anon;
grant execute on function move_booking(uuid, timestamptz, booking_status, integer, boolean) to authenticated, service_role;
