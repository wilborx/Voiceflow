import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | undefined;

export function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  return drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), {
    schema,
  });
}

export function getDb() {
  if (!_db) {
    _db = createDb();
  }

  return _db;
}

let dbPromise: Promise<ReturnType<typeof drizzle>> | undefined;
export const dbProxy = {
  get select() {
    return getDb().select.bind(getDb());
  },
  get insert() {
    return getDb().insert.bind(getDb());
  },
  get update() {
    return getDb().update.bind(getDb());
  },
  get delete() {
    return getDb().delete.bind(getDb());
  },
  get query() {
    return getDb().query;
  },
};

export const db = new Proxy({} as any, {
  get(_, prop) {
    return (getDb() as any)[prop];
  },
});

export * from "./schema";
