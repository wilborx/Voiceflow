import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: [
    "./src/schema/agents.ts",
    "./src/schema/audit-logs.ts",
    "./src/schema/calls.ts",
    "./src/schema/organizations.ts",
    "./src/schema/webhook-events.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  out: path.join(__dirname, "./src/migrations"),
  migrationLimit: 100,
});
