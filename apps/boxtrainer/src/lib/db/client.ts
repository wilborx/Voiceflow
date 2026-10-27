import "server-only";
import fs from "node:fs";
import path from "node:path";
import { env, isDemo } from "../config";
import { log } from "../server/log";

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<T[]>;
}

/** Fehler aus Postgres/PGlite (beide liefern code + message). */
export interface DbError {
  code?: string;
  message: string;
}

export function dbErrorMessage(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "message" in e ? String((e as DbError).message) : undefined;
}

const g = globalThis as unknown as { __btDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__btDb ??= isDemo ? createDemoDb() : createPgDb();
  return g.__btDb;
}

export async function sql<T = Record<string, unknown>>(text: string, params: readonly unknown[] = []): Promise<T[]> {
  return (await getDb()).query<T>(text, params);
}

export async function sqlOne<T = Record<string, unknown>>(text: string, params: readonly unknown[] = []): Promise<T | undefined> {
  return (await sql<T>(text, params))[0];
}

async function createPgDb(): Promise<Db> {
  const { Pool, types } = await import("pg");
  // bigint/numeric als Zahl (Zählwerte bleiben weit unter 2^53)
  types.setTypeParser(20, (v) => Number(v));
  types.setTypeParser(1700, (v) => Number(v));
  const url = env.databaseUrl!;
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  return {
    async query<T>(text: string, params: readonly unknown[] = []) {
      const res = await pool.query(text, params as unknown[]);
      return res.rows as T[];
    },
  };
}

const SUPABASE_DIR = path.join(process.cwd(), "supabase");

function readSql(rel: string): string {
  return fs.readFileSync(path.join(SUPABASE_DIR, rel), "utf8");
}

async function createDemoDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { citext } = await import("@electric-sql/pglite/contrib/citext");
  // Lokal persistent (überlebt Neustarts), auf Serverless nur im Speicher
  const dataDir = process.env.VERCEL ? undefined : path.join(process.cwd(), ".demo-db");
  const pg = new PGlite({ dataDir, extensions: { citext } });
  await pg.waitReady;

  const exists = await pg.query<{ ok: boolean }>(
    "select exists (select 1 from information_schema.tables where table_name = 'bookings') as ok",
  );
  const db: Db = {
    async query<T>(text: string, params: readonly unknown[] = []) {
      const res = await pg.query<T>(text, params as unknown[]);
      return res.rows;
    },
  };

  if (!exists.rows[0]?.ok) {
    log.info("demo-db: initialisiere Schema und Demo-Daten");
    try {
      await pg.exec(readSql("tests/supabase_shim.sql"));
      for (const f of fs.readdirSync(path.join(SUPABASE_DIR, "migrations")).sort()) {
        await pg.exec(readSql(`migrations/${f}`));
      }
      await pg.exec(readSql("seed.sql"));
      const { seedDemoData } = await import("./demo-seed");
      await seedDemoData(db);
    } catch (err) {
      // Halb initialisierte Demo-DB verwerfen, damit der nächste Start sauber neu aufsetzt
      await pg.close().catch(() => {});
      if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
      g.__btDb = undefined;
      throw err;
    }
  }
  return db;
}
