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

export * from "./schema";
