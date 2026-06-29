import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;

function createVapiClientMock() {
  return {
    assistants: {
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe("Vapi integration library", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("VAPI_API_KEY", "test-vapi-key");
    vi.stubEnv("VAPI_WEBHOOK_SECRET", "test-secret");
    vi.stubEnv("API_BASE_URL", "http://localhost:8080");
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("creates a booking assistant with consent-safe webhook configuration", async () => {
    const { createVapiAssistantWithClient } =
      await import("../../../apps/api-server/src/lib/vapi");
    const client = createVapiClientMock();
    client.assistants.create.mockResolvedValue({ id: "asst-created" });

    const assistant = await createVapiAssistantWithClient(client, {
      name: "Termin Assistent",
      type: "booking",
      systemPrompt: "Buche Termine nach Bestätigung.",
      voiceId: "voice-1",
      language: "de",
      businessName: "Praxis Muster",
    });

    expect(assistant).toEqual({ id: "asst-created" });
    expect(client.assistants.create).toHaveBeenCalledTimes(1);

    const payload = client.assistants.create.mock.calls[0]?.[0] as {
      name: string;
      model: { tools: Array<{ function: { name: string } }> };
      voice: { voiceId: string };
      transcriber: { language: string };
      firstMessage: string;
      serverUrl: string;
      serverUrlSecret: string;
    };

    expect(payload.name).toBe("Termin Assistent");
    expect(payload.voice.voiceId).toBe("voice-1");
    expect(payload.transcriber.language).toBe("de");
    expect(payload.firstMessage).toContain("Herzlich willkommen");
    expect(payload.serverUrl).toBe("http://localhost:8080/api/webhooks/vapi");
    expect(payload.serverUrlSecret).toBe("test-secret");
    expect(payload.model.tools.map((tool) => tool.function.name)).toEqual([
      "checkAvailability",
      "bookAppointment",
      "transferToHuman",
    ]);
  }, 15000);

  it("creates a non-booking assistant with transfer fallback tool", async () => {
    const { createVapiAssistantWithClient } =
      await import("../../../apps/api-server/src/lib/vapi");
    const client = createVapiClientMock();
    client.assistants.create.mockResolvedValue({ id: "asst-advisory" });

    await createVapiAssistantWithClient(client, {
      name: "Beratungs Assistent",
      type: "advisory",
      systemPrompt: "Qualifiziere Leads.",
    });

    const payload = client.assistants.create.mock.calls[0]?.[0] as {
      model: { tools: Array<{ function: { name: string } }> };
    };

    expect(payload.model.tools.map((tool) => tool.function.name)).toEqual([
      "transferToHuman",
    ]);
  }, 15000);

  it("updates a Vapi assistant with authorization and JSON body", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("{}"),
    } as unknown as Response);

    const { updateVapiAssistant } =
      await import("../../../apps/api-server/src/lib/vapi");
    await updateVapiAssistant("asst-1", {
      name: "Renamed",
      voiceId: null,
      language: "de",
      systemPrompt: "Neuer Prompt",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vapi.ai/assistant/asst-1",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-vapi-key",
          "Content-Type": "application/json",
        },
      }),
    );

    const requestOptions = fetchMock.mock.calls[0]?.[1] as { body: string };
    const body = JSON.parse(requestOptions.body) as Record<string, unknown>;
    expect(body).toEqual({
      name: "Renamed",
      voice: { provider: "11labs", voiceId: "21m00Tcm4TlvDq8ikWAM" },
      transcriber: { provider: "deepgram", model: "nova-3", language: "de" },
      model: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        systemPrompt: "Neuer Prompt",
        temperature: 0.7,
      },
    });
  });

  it("throws when Vapi update returns an error response", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: vi.fn().mockResolvedValue("invalid voice"),
    } as unknown as Response);

    const { updateVapiAssistant } =
      await import("../../../apps/api-server/src/lib/vapi");

    await expect(
      updateVapiAssistant("asst-1", { name: "Bad" }),
    ).rejects.toThrow("Vapi PATCH failed (422): invalid voice");
  });

  it("deletes a Vapi assistant through the injected client", async () => {
    const { deleteVapiAssistantWithClient } =
      await import("../../../apps/api-server/src/lib/vapi");
    const client = createVapiClientMock();
    const deleteError = new Error("assistant gone");
    client.assistants.delete.mockRejectedValue(deleteError);

    await expect(deleteVapiAssistantWithClient(client, "asst-1")).rejects.toBe(
      deleteError,
    );
  });
});
