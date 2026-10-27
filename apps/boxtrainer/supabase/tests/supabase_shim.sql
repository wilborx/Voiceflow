-- Minimaler Ersatz für Supabase-Bestandteile, damit die Migrationen in einem
-- nackten Postgres (CI/lokal) laufen. NICHT in Supabase ausführen.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;
do $$ begin
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end $$;
grant usage on schema public, auth to anon, authenticated, service_role;
-- Supabase-Standardrechte nachbilden (alles für die API-Rollen, RLS schützt Tabellen)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
