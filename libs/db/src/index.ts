import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | undefined;

export function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  return drizzle(new Pool({ connectionString }), { schema });
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDb();
  }
  return dbInstance;
}

/**
 * DB Proxy allows lazy initialization without explicit getDb() calls.
 * This pattern enables `import { db } from "@workspace/db"` with runtime DB startup.
 * Note: The `any` cast is required for Drizzle ORM's Proxy-based API compatibility.
 * Use getDb() directly for explicit typing.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  },
}) as ReturnType<typeof drizzle>;

export * from "./schema";
