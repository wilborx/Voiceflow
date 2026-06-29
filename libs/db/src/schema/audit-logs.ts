import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizationsTable.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id"),
  action: text("action")
    .notNull()
    .$type<
      | "agent.created"
      | "agent.accessed"
      | "agent.updated"
      | "agent.deleted"
      | "call.accessed"
      | "call.deleted"
      | "consent.revoked"
      | "data.export_requested"
      | "data.deletion_requested"
    >(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
