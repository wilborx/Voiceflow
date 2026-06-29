import { beforeEach, describe, expect, it, vi } from "vitest";

function createTelnyxClientMock() {
  return {
    availablePhoneNumbers: {
      list: vi.fn(),
    },
    numberOrders: {
      create: vi.fn(),
    },
    messages: {
      send: vi.fn(),
    },
    phoneNumbers: {
      delete: vi.fn(),
    },
  };
}

describe("Telnyx integration library", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("skips phone number purchase when Telnyx is not configured", async () => {
    vi.stubEnv("TELNYX_API_KEY", "");
    vi.stubEnv("TELNYX_CONNECTION_ID", "");
    const { purchaseGermanPhoneNumber } =
      await import("../../../apps/api-server/src/lib/telnyx");

    await expect(purchaseGermanPhoneNumber()).resolves.toBeNull();
  }, 15000);

  it("purchases the first available German voice number", async () => {
    vi.stubEnv("TELNYX_API_KEY", "telnyx-key");
    vi.stubEnv("TELNYX_CONNECTION_ID", "conn-1");
    const { purchaseGermanPhoneNumberWithClient } =
      await import("../../../apps/api-server/src/lib/telnyx");
    const client = createTelnyxClientMock();
    client.availablePhoneNumbers.list.mockResolvedValue({
      data: [{ phone_number: "+493012345678" }],
    });
    client.numberOrders.create.mockResolvedValue({
      data: { phone_numbers: [{ phone_number: "+493012345678" }] },
    });

    const phoneNumber = await purchaseGermanPhoneNumberWithClient(
      client,
      "conn-1",
    );

    expect(phoneNumber).toBe("+493012345678");
    expect(client.availablePhoneNumbers.list).toHaveBeenCalledWith({
      filter: {
        country_code: "DE",
        features: ["voice"],
        limit: 3,
      },
    });
    expect(client.numberOrders.create).toHaveBeenCalledWith({
      phone_numbers: [{ phone_number: "+493012345678" }],
      connection_id: "conn-1",
    });
  });

  it("returns null when no German number is available", async () => {
    const { purchaseGermanPhoneNumberWithClient } =
      await import("../../../apps/api-server/src/lib/telnyx");
    const client = createTelnyxClientMock();
    client.availablePhoneNumbers.list.mockResolvedValue({ data: [] });

    const phoneNumber = await purchaseGermanPhoneNumberWithClient(
      client,
      "conn-1",
    );

    expect(phoneNumber).toBeNull();
  });

  it("skips SMS sending when Telnyx sender number is missing", async () => {
    const { sendSMSWithClient } =
      await import("../../../apps/api-server/src/lib/telnyx");

    await expect(
      sendSMSWithClient(
        createTelnyxClientMock(),
        "+49123456789",
        "Termin bestätigt",
        undefined,
      ),
    ).resolves.toBe(false);
  });

  it("sends an SMS through Telnyx", async () => {
    const { sendSMSWithClient } =
      await import("../../../apps/api-server/src/lib/telnyx");
    const client = createTelnyxClientMock();

    await expect(
      sendSMSWithClient(
        client,
        "+49123456789",
        "Termin bestätigt",
        "+49987654321",
      ),
    ).resolves.toBe(true);
    expect(client.messages.send).toHaveBeenCalledWith({
      from: "+49987654321",
      to: "+49123456789",
      text: "Termin bestätigt",
    });
  });

  it("releases a phone number through Telnyx", async () => {
    const { releasePhoneNumberWithClient } =
      await import("../../../apps/api-server/src/lib/telnyx");
    const client = createTelnyxClientMock();

    await expect(
      releasePhoneNumberWithClient(client, "+493012345678"),
    ).resolves.toBeUndefined();
    expect(client.phoneNumbers.delete).toHaveBeenCalledWith("+493012345678");
  });
});
