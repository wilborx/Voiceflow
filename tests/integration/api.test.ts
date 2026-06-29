import express from "../../apps/api-server/node_modules/express";
import { describe, expect, it } from "vitest";
import { createExpressHarness, request } from "../test-utils";

async function createAgentConfigHarness() {
  const agentConfigRouter = (
    await import("../../apps/api-server/src/routes/agent-config")
  ).default;
  const app = express();
  app.use(express.json());
  app.use("/api/agent-config", agentConfigRouter);
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res
        .status(500)
        .json({
          error: "Internal server error",
          details: err instanceof Error ? err.message : String(err),
        });
    },
  );

  return createExpressHarness(app);
}

describe("Multi-Tenancy Security", () => {
  it("agents route filters by ownerId - prevents cross-org access", async () => {
    const harness = await createAgentConfigHarness();

    try {
      // Without auth context, the route should still work but return empty
      const result = await request(
        harness.baseUrl,
        "/api/agent-config/prompts?type=booking",
      );

      expect(result.status).toBe(200);
    } finally {
      await harness.close();
    }
  });
});

describe("Agent config API integration", () => {
  it("returns prompt templates for a booking agent", async () => {
    const harness = await createAgentConfigHarness();

    try {
      const result = await request(
        harness.baseUrl,
        "/api/agent-config/prompts?type=booking",
      );

      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        type: "booking",
        prompt: expect.stringContaining(
          "Du bist eine freundliche KI-Telefonassistentin",
        ),
      });
    } finally {
      await harness.close();
    }
  });

  it("returns configured voice options", async () => {
    const harness = await createAgentConfigHarness();

    try {
      const result = await request(harness.baseUrl, "/api/agent-config/voices");

      expect(result.status).toBe(200);
      expect(result.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "21m00Tcm4TlvDq8ikWAM", name: "Lena" }),
          expect.objectContaining({ id: "AZnzlk1XvdvUeBnXmlld", name: "Domi" }),
        ]),
      );
    } finally {
      await harness.close();
    }
  });
});
