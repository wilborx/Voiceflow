/**
 * Spielt alle Migrationen (und optional seed.sql) in die Datenbank aus DATABASE_URL ein.
 * Bereits angewendete Migrationen werden in `_migrations` vermerkt und übersprungen.
 *   pnpm db:setup            # nur Migrationen
 *   pnpm db:setup --seed     # + Grunddaten (Angebote/Verfügbarkeit als Platzhalter)
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt");
  process.exit(1);
}
const dir = path.join(import.meta.dirname, "..", "supabase");
const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
await client.connect();
await client.query("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
const done = new Set((await client.query<{ name: string }>("select name from _migrations")).rows.map((r) => r.name));
for (const f of fs.readdirSync(path.join(dir, "migrations")).sort()) {
  if (done.has(f)) continue;
  console.log(`→ ${f}`);
  await client.query("begin");
  try {
    await client.query(fs.readFileSync(path.join(dir, "migrations", f), "utf8"));
    await client.query("insert into _migrations (name) values ($1)", [f]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}
if (process.argv.includes("--seed")) {
  console.log("→ seed.sql");
  await client.query(fs.readFileSync(path.join(dir, "seed.sql"), "utf8"));
}
await client.end();
console.log("Fertig.");
