import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExpressHarness, request } from "../../test-utils";

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(() => query),
    from: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve([])),
    returning: vi.fn(() => Promise.resolve([])),
    set: vi.fn(() => query),
    values: vi.fn(() => query),
    onConflictDoNothing: vi.fn(() => query),
  };
  const insertValues = vi.fn(() => query);
  const db = {
    select: vi.fn(() => query),
    update: vi.fn(() => query),
    insert: vi.fn(() => ({ values: insertValues })),
    delete: vi.fn(() => query),
  };

  return {
    db,
    insertValues,
    query,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    sql: strings.join("?"),
    values,
  })),
}));

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  callsTable: { vapiCallId: "calls.vapiCallId", id: "calls.id" },
  agentsTable: {
    vapiAssistantId: "agents.vapiAssistantId",
    id: "agents.id",
    totalCalls: "agents.totalCalls",
    totalMinutes: "agents.totalMinutes",
  },
  webhookEventsTable: {
    source: "webhookEvents.source",
    eventId: "webhookEvents.eventId",
    eventType: "webhookEvents.eventType",
  },
}));

vi.mock("../../../libs/db/src/index.ts", () => ({
  db: mocks.db,
  callsTable: { vapiCallId: "calls.vapiCallId", id: "calls.id" },
  agentsTable: {
    vapiAssistantId: "agents.vapiAssistantId",
    id: "agents.id",
    totalCalls: "agents.totalCalls",
    totalMinutes: "agents.totalMinutes",
  },
  webhookEventsTable: {
    source: "webhookEvents.source",
    eventId: "webhookEvents.eventId",
    eventType: "webhookEvents.eventType",
  },
}));

vi.mock("../../../apps/api-server/src/lib/logger", () => ({
  logger: mocks.logger,
}));

vi.mock("@workspace/crypto", () => ({
  encrypt: (value: unknown) => value,
  decrypt: (value: unknown) => value,
}));

import webhookRouter from "../../../apps/api-server/src/routes/webhooks";

async function postWebhook(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const harness = await createExpressHarness(webhookRouter);

  try {
    return await request(harness.baseUrl, path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  } finally {
    await harness.close();
  }
}

describe("Vapi webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.query.limit.mockResolvedValue([]);
    mocks.query.returning.mockResolvedValue([]);
  });

  it("rejects Vapi webhook calls with an invalid secret", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "valid-secret");

    const result = await postWebhook(
      "/vapi",
      { message: { type: "call-started" } },
      { "x-vapi-secret": "wrong" },
    );

    expect(result.status).toBe(401);
    expect(result.body).toEqual({ error: "Unauthorized" });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });

  it("stores explicit consent for a Vapi call", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "valid-secret");

    const result = await postWebhook(
      "/vapi/consent",
      { callId: "vapi-call-1", consentGiven: true, consentVersion: "2.0" },
      { "x-vapi-secret": "valid-secret" },
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ received: true });
    expect(mocks.db.update).toHaveBeenCalled();
    expect(mocks.query.set).toHaveBeenCalledWith(
      expect.objectContaining({
        consentGiven: true,
        consentVersion: "2.0",
        consentMethod: "dtmf",
        consentTimestamp: expect.any(Date),
        consentVapiEventId: "vapi-call-1:consent",
      }),
    );
    expect(mocks.query.where).toHaveBeenCalled();
  });

  it("uses default consent version when omitted", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "valid-secret");

    await postWebhook(
      "/vapi/consent",
      { callId: "vapi-call-1", consentGiven: false },
      { "x-vapi-secret": "valid-secret" },
    );

    expect(mocks.query.set).toHaveBeenCalledWith(
      expect.objectContaining({
        consentGiven: false,
        consentVersion: "1.0",
        consentMethod: "dtmf",
        consentTimestamp: expect.any(Date),
        consentVapiEventId: "vapi-call-1:consent",
      }),
    );
  });

  it("creates an in-progress call and increments agent call count", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "valid-secret");
    mocks.query.limit.mockResolvedValue([{ id: "agent-1" }]);

    const result = await postWebhook(
      "/vapi",
      {
        message: {
          type: "call-started",
          call: {
            id: "vapi-call-1",
            assistantId: "asst-1",
            customer: { number: "+49123456789" },
          },
        },
      },
      { "x-vapi-secret": "valid-secret" },
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ received: true });
    expect(mocks.db.insert).toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalledWith({
      vapiCallId: "vapi-call-1",
      agentId: "agent-1",
      callerNumber: expect.any(String),
      direction: "inbound",
      status: "in_progress",
      startedAt: expect.any(Date),
    });
    expect(mocks.db.update).toHaveBeenCalled();
    expect(mocks.query.set).toHaveBeenCalledWith({
      totalCalls: expect.anything(),
    });
  });

  it("finalizes a completed call and increments billed minutes", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "valid-secret");
    mocks.query.limit.mockResolvedValue([{ agentId: "agent-1" }]);

    const result = await postWebhook(
      "/vapi",
      {
        message: {
          type: "call-ended",
          call: {
            id: "vapi-call-1",
            startedAt: "2026-06-12T10:00:00.000Z",
            endedAt: "2026-06-12T10:05:30.000Z",
            transcript: "Ich möchte einen Termin buchen.",
            summary: "Terminwunsch erfasst.",
          },
        },
      },
      { "x-vapi-secret": "valid-secret" },
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ received: true });
    expect(mocks.db.update).toHaveBeenCalledTimes(2);
    expect(mocks.query.set.mock.calls[0]?.[0]).toEqual({
      status: "completed",
      durationSeconds: 330,
      endedAt: new Date("2026-06-12T10:05:30.000Z"),
      transcript: expect.any(String),
      summary: expect.any(String),
      resolved: true,
      resolutionType: "completed",
    });
    expect(mocks.query.set.mock.calls[1]?.[0]).toEqual({
      totalMinutes: expect.anything(),
    });
  });

  it("acknowledges function-call events for separate tool handling", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "valid-secret");

    const result = await postWebhook(
      "/vapi",
      {
        message: {
          type: "function-call",
          functionCall: { name: "bookAppointment" },
        },
      },
      { "x-vapi-secret": "valid-secret" },
    );

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      result: "Tool endpoint handles this separately",
    });
    expect(mocks.logger.info).toHaveBeenCalledWith(
      { functionCallName: "bookAppointment" },
      "Tool call received",
    );
  });

  it("prevents duplicate webhook processing via event dedup table", async () => {
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "valid-secret");

    // First call - should process
    const result1 = await postWebhook(
      "/vapi",
      {
        message: {
          type: "call-started",
          call: {
            id: "vapi-call-dup",
            assistantId: "asst-1",
            customer: { number: "+49123" },
          },
        },
      },
      {
        "x-vapi-secret": "valid-secret",
        "x-vapi-event-id": "unique-event-123",
      },
    );

    expect(result1.status).toBe(200);
    expect(mocks.db.insert).toHaveBeenCalled();

    // Reset mocks but simulate already-recorded event
    vi.clearAllMocks();
    mocks.query.limit.mockResolvedValue([{ id: "agent-1" }]);

    // Second identical call - should dedup silently
    const result2 = await postWebhook(
      "/vapi",
      {
        message: {
          type: "call-started",
          call: {
            id: "vapi-call-dup",
            assistantId: "asst-1",
            customer: { number: "+49123" },
          },
        },
      },
      {
        "x-vapi-secret": "valid-secret",
        "x-vapi-event-id": "unique-event-123",
      },
    );

    // Should still succeed but not process duplicate
    expect(result2.status).toBe(200);
  });
});
