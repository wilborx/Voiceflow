import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentsTable = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type")
    .notNull()
    .$type<"booking" | "advisory" | "hr_screening" | "hr_onboarding">(),
  status: text("status")
    .notNull()
    .default("draft")
    .$type<"active" | "inactive" | "draft">(),
  phoneNumber: text("phone_number"),
  vapiAssistantId: text("vapi_assistant_id"),
  voiceId: text("voice_id"),
  voiceName: text("voice_name"),
  language: text("language").notNull().default("de"),
  systemPrompt: text("system_prompt").notNull(),
  businessName: text("business_name"),
  businessHoursOpen: text("business_hours_open"),
  businessHoursClose: text("business_hours_close"),
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  totalCalls: integer("total_calls").notNull().default(0),
  totalMinutes: numeric("total_minutes").notNull().default("0"),
  resolutionRate: numeric("resolution_rate").notNull().default("0"),
  ownerId: text("owner_id").notNull(),
  googleCalendarAccessToken: text("google_calendar_access_token"),
  googleCalendarRefreshToken: text("google_calendar_refresh_token"),
  googleCalendarConnected: boolean("google_calendar_connected").default(false),
  consentRequired: boolean("consent_required").notNull().default(false),
  consentMethod: text("consent_method").default("dtmf"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  id: true,
  totalCalls: true,
  totalMinutes: true,
  resolutionRate: true,
  createdAt: true,
  updatedAt: true,
});

export const selectAgentSchema = createSelectSchema(agentsTable);

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
