import { pgTable, text, uuid, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";

export const callsTable = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agentsTable.id, { onDelete: "set null" }),
  vapiCallId: text("vapi_call_id").unique(),
  callerNumber: text("caller_number"),
  direction: text("direction").notNull().default("inbound").$type<"inbound" | "outbound">(),
  status: text("status").notNull().default("completed").$type<"queued" | "in_progress" | "completed" | "failed" | "no_answer">(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  resolved: boolean("resolved").notNull().default(false),
  resolutionType: text("resolution_type"),
  escalatedToHuman: boolean("escalated_to_human").notNull().default(false),
  transcript: text("transcript"),
  summary: text("summary"),
  sentiment: text("sentiment").$type<"positive" | "neutral" | "negative">(),
  recordingUrl: text("recording_url"),
  extractedData: text("extracted_data"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCallSchema = createInsertSchema(callsTable).omit({
  id: true,
  createdAt: true,
});

export const selectCallSchema = createSelectSchema(callsTable);

export type InsertCall = z.infer<typeof insertCallSchema>;
export type Call = typeof callsTable.$inferSelect;
