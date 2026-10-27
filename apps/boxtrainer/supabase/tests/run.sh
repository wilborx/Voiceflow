#!/usr/bin/env bash
# Startet ein Wegwerf-Postgres, spielt Migrationen + Seed ein und führt die DB-Tests aus.
# Voraussetzung: PostgreSQL ≥ 15 Binaries (initdb, pg_ctl, psql) im PATH oder unter /usr/lib/postgresql/*/bin
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$DATA"
  RUN_AS=(runuser -u postgres --)
fi
cleanup() { "${RUN_AS[@]}" pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"${RUN_AS[@]}" initdb -D "$DATA" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -w start >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$DATA" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f tests/supabase_shim.sql
for f in migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f seed.sql
"${PSQL[@]}" -f tests/booking.test.sql

# Nebenläufigkeit: 20 parallele Anfragen auf denselben Slot → genau eine gewinnt
"${PSQL[@]}" -c "create table t_slot as select date_trunc('day', now()) + interval '20 days 9 hours' as t;"
for i in $(seq 1 20); do
  "${PSQL[@]}" -c "select t_book('einzeltraining', (select t from t_slot), 'race$i@example.com');" >/dev/null 2>&1 &
done
wait
WON=$("${PSQL[@]}" -tA -c "select count(*) from bookings where starts_at = (select t from t_slot) and status = 'pending';")
[ "$WON" = "1" ] || { echo "FEHLER: $WON parallele Einzelbuchungen erfolgreich (erwartet 1)"; exit 1; }
echo "ok 15 Parallelität Einzelslot (1 von 20)"

# 20 parallele Anfragen auf einen Gruppentermin mit 5 Plätzen → genau 5
OCC=$("${PSQL[@]}" -tA -c "insert into event_occurrences (special_event_id, starts_at, ends_at, capacity)
  select id, now() + interval '25 days', now() + interval '25 days 90 min', 5 from special_events limit 1 returning id;")
for i in $(seq 1 20); do
  "${PSQL[@]}" -c "select t_book('gruppentraining', null, 'grp$i@example.com', '$OCC');" >/dev/null 2>&1 &
done
wait
SEATS=$("${PSQL[@]}" -tA -c "select count(*) from bookings where occurrence_id = '$OCC' and status in ('pending','confirmed');")
[ "$SEATS" = "5" ] || { echo "FEHLER: $SEATS Plätze vergeben (erwartet 5)"; exit 1; }
echo "ok 16 Parallelität Gruppe (5 von 20)"
echo "Alle DB-Tests bestanden."
