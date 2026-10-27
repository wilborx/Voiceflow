-- =============================================================================
-- Row Level Security
-- Öffentliche Zugriffe laufen über Next.js-Server-Routen mit service_role
-- (umgeht RLS, prüft selbst). Der anon-Key darf nur öffentliche Angebote lesen.
-- Admins (Supabase Auth + Eintrag in `admins`) dürfen alles.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'admins', 'settings', 'offerings', 'availability_rules', 'availability_exceptions',
    'special_events', 'event_occurrences', 'customers', 'consents', 'bookings',
    'waitlist_entries', 'messages_log', 'packages', 'customer_packages',
    'package_redemptions', 'rate_limits', 'audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())',
      t
    );
  end loop;
end $$;

-- Audit-Log ist für Admins nur lesbar (kein Manipulieren)
drop policy admin_all on audit_log;
create policy admin_read on audit_log for select to authenticated using (is_admin());

-- Öffentlich: aktive, öffentlich sichtbare Angebote
create policy public_read_offerings on offerings for select to anon, authenticated
  using (is_active and visibility = 'public');

revoke all on all tables in schema public from anon;
grant select on offerings to anon;
