import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organizationsTable = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id").notNull(),
  plan: text("plan").notNull().default("starter"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("trialing"),
  minutesIncluded: integer("minutes_included").notNull().default(300),
  minutesUsed: integer("minutes_used").notNull().default(0),
  billingCycleStart: timestamp("billing_cycle_start", { withTimezone: true }),
  dataRetentionDays: integer("data_retention_days").notNull().default(365),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(
  organizationsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectOrganizationSchema = createSelectSchema(organizationsTable);

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
