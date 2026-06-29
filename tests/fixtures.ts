import { faker } from "@faker-js/faker";
import { randomUUID } from "crypto";

export const createMockOrganization = () => ({
  id: `org_${randomUUID()}`,
  name: faker.company.name(),
  email: faker.internet.email(),
  timezone: "Europe/Berlin",
  language: "de",
  dataRetentionDays: 365,
  minutesUsed: 0,
  plan: "starter",
  stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
  ownerId: `user_${randomUUID()}`,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const createMockAgent = (
  overrides: Partial<ReturnType<typeof createMockAgent>> = {},
) => ({
  id: `agent_${randomUUID()}`,
  name: faker.company.name(),
  type: "booking" as const,
  status: "active" as const,
  phoneNumber: null,
  voiceId: null,
  voiceName: null,
  language: "de",
  systemPrompt: faker.lorem.sentence(),
  businessName: faker.company.name(),
  businessHoursOpen: "09:00",
  businessHoursClose: "17:00",
  timezone: "Europe/Berlin",
  totalCalls: 0,
  totalMinutes: 0,
  resolutionRate: 0,
  vapiAssistantId: `asst_${faker.string.alphanumeric(16)}`,
  ownerId: `user_${randomUUID()}`,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

export const createMockCall = (
  overrides: Partial<ReturnType<typeof createMockCall>> = {},
) => ({
  id: `call_${randomUUID()}`,
  agentId: `agent_${randomUUID()}`,
  callerNumber: null,
  direction: "inbound" as const,
  status: "completed" as const,
  durationSeconds: faker.number.int({ min: 10, max: 600 }),
  resolved: false,
  resolutionType: null,
  escalatedToHuman: false,
  transcript: null,
  summary: null,
  sentiment: null,
  startedAt: faker.date.past(),
  endedAt: faker.date.past(),
  createdAt: new Date(),
  deletedAt: null,
  ...overrides,
});

export const createMockCallConsent = (
  overrides: Partial<ReturnType<typeof createMockCallConsent>> = {},
) => ({
  callId: `call_${randomUUID()}`,
  consentGiven: true,
  consentTimestamp: new Date(),
  consentMethod: "dtmf" as const,
  ...overrides,
});

export const createMockBillingPlan = (
  overrides: Partial<ReturnType<typeof createMockBillingPlan>> = {},
) => ({
  key: "starter",
  name: "Starter",
  priceEuros: 99,
  minutes: 300,
  maxAgents: 1,
  features: ["1 KI-Agent"],
  ...overrides,
});

export const createMockBillingUsage = (
  overrides: Partial<ReturnType<typeof createMockBillingUsage>> = {},
) => ({
  plan: "starter",
  minutesUsed: 0,
  minutesIncluded: 300,
  subscriptionStatus: "trialing",
  billingCycleStart: new Date().toISOString(),
  currentPeriodEnd: new Date().toISOString(),
  ...overrides,
});

export const createMockIntegration = (
  overrides: Partial<ReturnType<typeof createMockIntegration>> = {},
) => ({
  id: `integration_${randomUUID()}`,
  name: "Google Kalender",
  description: "Kalenderverfügbarkeit prüfen",
  status: "available" as const,
  connectedAt: null,
  ...overrides,
});

export const createMockOrganizationSettings = (
  overrides: Partial<ReturnType<typeof createMockOrganizationSettings>> = {},
) => ({
  id: `org_${randomUUID()}`,
  name: faker.company.name(),
  email: faker.internet.email(),
  timezone: "Europe/Berlin",
  language: "de",
  dataRetentionDays: 365,
  minutesUsed: 0,
  plan: "starter",
  ...overrides,
});
