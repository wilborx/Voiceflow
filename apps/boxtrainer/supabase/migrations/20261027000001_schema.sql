-- =============================================================================
-- Boxtrainer Booking – Datenmodell
-- Alle Zeitpunkte als timestamptz (UTC). Wandzeit nur in Regeln (Minuten seit
-- Mitternacht, Europe/Berlin) und Kalenderdaten (date).
-- =============================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type booking_status as enum (
  'pending', 'confirmed', 'declined', 'expired', 'cancelled', 'completed', 'no_show'
);
create type offering_kind as enum ('one_on_one', 'partner', 'trial', 'group', 'special');
create type offering_visibility as enum ('public', 'unlisted');
create type contact_channel as enum ('email', 'whatsapp');
create type experience_level as enum ('beginner', 'intermediate', 'advanced', 'competitive');
create type exception_kind as enum ('blocked', 'extra');
create type recurrence_kind as enum ('none', 'weekly');
create type occurrence_status as enum ('scheduled', 'cancelled');
create type waitlist_status as enum ('waiting', 'offered', 'accepted', 'expired', 'removed');
create type consent_type as enum ('privacy', 'whatsapp', 'health_data', 'marketing');
create type message_status as enum ('queued', 'sent', 'delivered', 'failed', 'fallback');

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Admins (Supabase Auth). Nur Nutzer in dieser Tabelle haben Admin-Zugriff.
-- ---------------------------------------------------------------------------
create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Einstellungen (genau eine Zeile)
-- ---------------------------------------------------------------------------
create table settings (
  id boolean primary key default true check (id),
  timezone text not null default 'Europe/Berlin',
  -- Wie lange eine Anfrage den Slot hält, bevor sie "expired" wird
  hold_hours integer not null default 24 check (hold_hours between 1 and 168),
  -- Kostenlose Stornierung bis X Std. vorher
  cancellation_hours integer not null default 24 check (cancellation_hours >= 0),
  -- Antwortversprechen auf der Bestätigungsseite
  response_sla_hours integer not null default 24 check (response_sla_hours > 0),
  -- Wartelisten-Angebot gilt X Std.
  waitlist_offer_hours integer not null default 12 check (waitlist_offer_hours > 0),
  reminder_offsets_min integer[] not null default '{1440,120}',
  business_name text not null default '',
  address text not null default '',
  google_maps_url text,
  google_review_url text,
  -- Feature-Flags (z. B. {"payments": false, "packages": false})
  features jsonb not null default '{}'::jsonb,
  -- Bearbeitbare Nachrichtentexte, Schlüssel = Template-Name
  message_templates jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Angebote / Session-Typen
-- ---------------------------------------------------------------------------
create table offerings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  kind offering_kind not null,
  name text not null,
  description text not null default '',
  duration_min integer not null check (duration_min between 5 and 720),
  buffer_before_min integer not null default 0 check (buffer_before_min between 0 and 240),
  buffer_after_min integer not null default 0 check (buffer_after_min between 0 and 240),
  min_notice_min integer not null default 720 check (min_notice_min >= 0),
  max_horizon_days integer not null default 60 check (max_horizon_days between 1 and 365),
  slot_step_min integer not null default 30 check (slot_step_min between 5 and 240),
  price_cents integer check (price_cents >= 0),
  currency char(3) not null default 'EUR',
  -- 1 = Einzel (Termine aus Verfügbarkeit), >1 = Gruppe (Termine aus special_events)
  capacity integer not null default 1 check (capacity between 1 and 500),
  color text not null default '#e11d48' check (color ~ '^#[0-9a-fA-F]{6}$'),
  location text not null default '',
  visibility offering_visibility not null default 'public',
  is_active boolean not null default true,
  auto_confirm boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger offerings_updated_at before update on offerings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Verfügbarkeit
-- ---------------------------------------------------------------------------
create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  iso_weekday smallint not null check (iso_weekday between 1 and 7),
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  created_at timestamptz not null default now(),
  check (end_minute > start_minute)
);

create table availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  kind exception_kind not null,
  start_date date not null,
  end_date date not null,
  start_minute smallint check (start_minute between 0 and 1439),
  end_minute smallint check (end_minute between 1 and 1440),
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check ((start_minute is null) = (end_minute is null)),
  check (start_minute is null or end_minute > start_minute),
  -- Zusatzfenster brauchen Uhrzeiten
  check (kind = 'blocked' or start_minute is not null)
);
create index on availability_exceptions (start_date, end_date);

-- ---------------------------------------------------------------------------
-- Gruppen- und Sondertermine
-- ---------------------------------------------------------------------------
create table special_events (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references offerings (id) on delete restrict,
  title text not null,
  description text not null default '',
  first_date date not null,
  start_minute smallint not null check (start_minute between 0 and 1439),
  duration_min integer not null check (duration_min between 5 and 720),
  capacity integer not null check (capacity between 1 and 500),
  recurrence recurrence_kind not null default 'none',
  recurrence_until date,
  skip_dates date[] not null default '{}',
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recurrence_until is null or recurrence_until >= first_date)
);
create trigger special_events_updated_at before update on special_events
  for each row execute function set_updated_at();

-- Konkrete Termine (von der App aus special_events expandiert, Cron verlängert)
create table event_occurrences (
  id uuid primary key default gen_random_uuid(),
  special_event_id uuid not null references special_events (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 500),
  buffer_before_min integer not null default 0,
  buffer_after_min integer not null default 0,
  status occurrence_status not null default 'scheduled',
  google_event_id text,
  created_at timestamptz not null default now(),
  unique (special_event_id, starts_at),
  check (ends_at > starts_at)
);
create index on event_occurrences (starts_at);

-- ---------------------------------------------------------------------------
-- Kunden (Mini-CRM)
-- ---------------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text not null,
  phone text,
  preferred_channel contact_channel not null default 'email',
  experience_level experience_level,
  admin_notes text not null default '',
  -- Zuletzt angegebene Einschränkungen (Gesundheitsdaten, Art. 9 DSGVO).
  -- Nur gesetzt, wenn health_data-Einwilligung vorliegt.
  health_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();

-- Einwilligungen mit Zeitstempel und Textversion (Nachweispflicht Art. 7 DSGVO)
create table consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  type consent_type not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  text_version text not null,
  source text not null default 'booking_form'
);
create index on consents (customer_id, type);

-- ---------------------------------------------------------------------------
-- Buchungen
-- ---------------------------------------------------------------------------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references offerings (id) on delete restrict,
  customer_id uuid not null references customers (id) on delete cascade,
  occurrence_id uuid references event_occurrences (id) on delete restrict,
  status booking_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- Puffer-Snapshot und daraus belegter Bereich (für den Exclusion-Constraint)
  buffer_before_min integer not null default 0 check (buffer_before_min >= 0),
  buffer_after_min integer not null default 0 check (buffer_after_min >= 0),
  blocked_from timestamptz not null,
  blocked_until timestamptz not null,
  seats integer not null default 1 check (seats between 1 and 10),
  hold_expires_at timestamptz,
  -- Intake
  experience_level experience_level,
  goal text,
  health_notes text,
  message text,
  preferred_channel contact_channel not null default 'email',
  -- Herkunft
  utm jsonb not null default '{}'::jsonb,
  -- Workflow
  decline_reason text,
  proposed_starts_at timestamptz,
  decided_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('customer', 'admin', 'system')),
  late_cancellation boolean not null default false,
  -- Self-Service: nur Hash des signierten Tokens speichern
  manage_token_hash text unique,
  google_event_id text,
  reminder_sent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (blocked_from = starts_at - make_interval(mins => buffer_before_min)),
  check (blocked_until = ends_at + make_interval(mins => buffer_after_min)),
  check (status <> 'pending' or hold_expires_at is not null)
);
create trigger bookings_updated_at before update on bookings
  for each row execute function set_updated_at();
create index on bookings (starts_at);
create index on bookings (customer_id);
create index on bookings (status, hold_expires_at) where status = 'pending';
create index on bookings (occurrence_id) where occurrence_id is not null;

-- Keine zwei aktiven Einzelbuchungen mit überlappendem (gepuffertem) Bereich.
-- Abgelaufene Holds werden in create_booking_request vor dem Insert auf 'expired'
-- gesetzt – der Constraint selbst kann now() nicht verwenden.
alter table bookings add constraint bookings_no_overlap
  exclude using gist (tstzrange(blocked_from, blocked_until, '[)') with &&)
  where (occurrence_id is null and status in ('pending', 'confirmed'));

-- Pro Gruppentermin nur eine aktive Buchung je Kunde
create unique index bookings_one_seat_per_customer
  on bookings (occurrence_id, customer_id)
  where occurrence_id is not null and status in ('pending', 'confirmed');

-- ---------------------------------------------------------------------------
-- Warteliste
-- ---------------------------------------------------------------------------
create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references event_occurrences (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  status waitlist_status not null default 'waiting',
  offered_at timestamptz,
  offer_expires_at timestamptz,
  booking_id uuid references bookings (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index waitlist_one_entry_per_customer
  on waitlist_entries (occurrence_id, customer_id)
  where status in ('waiting', 'offered');
create index on waitlist_entries (occurrence_id, created_at) where status = 'waiting';

-- ---------------------------------------------------------------------------
-- Nachrichten-Log (ohne Nachrichtentext – nur Metadaten, keine PII in Logs)
-- ---------------------------------------------------------------------------
create table messages_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings (id) on delete cascade,
  customer_id uuid references customers (id) on delete cascade,
  channel contact_channel not null,
  template text not null,
  status message_status not null default 'queued',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create index on messages_log (booking_id);

-- ---------------------------------------------------------------------------
-- Pakete (optional, Feature-Flag "packages")
-- ---------------------------------------------------------------------------
create table packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits integer not null check (credits > 0),
  price_cents integer not null check (price_cents >= 0),
  valid_days integer check (valid_days > 0),
  -- null = für alle Einzelangebote gültig
  offering_ids uuid[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customer_packages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  package_id uuid not null references packages (id) on delete restrict,
  credits_total integer not null check (credits_total > 0),
  credits_used integer not null default 0,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  stripe_payment_intent_id text,
  check (credits_used between 0 and credits_total)
);

create table package_redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_package_id uuid not null references customer_packages (id) on delete cascade,
  booking_id uuid not null unique references bookings (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rate-Limiting für öffentliche Endpunkte (Schlüssel = Hash aus IP + Route)
-- ---------------------------------------------------------------------------
create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Audit-Trail (Zugriffe/Änderungen an personenbezogenen Daten)
-- ---------------------------------------------------------------------------
create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);
