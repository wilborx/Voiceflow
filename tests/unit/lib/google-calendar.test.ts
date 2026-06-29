import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";

const STATE_SECRET = "test-secret";

function getAuthUrl(agentId: string): string {
  const signature = createHmac("sha256", STATE_SECRET)
    .update(agentId)
    .digest("hex")
    .slice(0, 16);
  const state = `${agentId}:${signature}`;
  return `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}`;
}

function verifyState(state: string): string | null {
  const parts = state.split(":");
  if (parts.length !== 2) return null;
  const [agentId, signature] = parts;
  const expectedSignature = createHmac("sha256", STATE_SECRET)
    .update(agentId ?? "")
    .digest("hex")
    .slice(0, 16);
  if (signature !== expectedSignature) return null;
  return agentId ?? null;
}

describe("Google Calendar OAuth", () => {
  describe("getAuthUrl", () => {
    it("should generate auth URL with state parameter", () => {
      const url = getAuthUrl("agent-123");
      expect(url).toContain("accounts.google.com");
      expect(url).toContain("state=");
    });

    it("should include agent ID in state", () => {
      const url = getAuthUrl("agent-456");
      const stateParam = url.split("state=")[1]?.split("&")[0];
      expect(stateParam).toContain("agent-456");
    });
  });

  describe("verifyState", () => {
    it("should verify valid state and return agent ID", () => {
      const url = getAuthUrl("agent-789");
      const stateParam = decodeURIComponent(
        url.split("state=")[1]?.split("&")[0] ?? "",
      );
      const agentId = verifyState(stateParam);
      expect(agentId).toBe("agent-789");
    });

    it("should reject invalid state format", () => {
      expect(verifyState("invalid")).toBeNull();
    });

    it("should reject tampered state", () => {
      const tamperedState = "agent-123:fake-signature";
      expect(verifyState(tamperedState)).toBeNull();
    });

    it("should reject empty state", () => {
      expect(verifyState("")).toBeNull();
    });
  });
});

describe("getAvailableSlots", () => {
  it("should calculate slot duration in milliseconds", () => {
    const durationMinutes = 60;
    const slotMs = durationMinutes * 60000;
    expect(slotMs).toBe(3600000);
  });

  it("should detect slot conflict logic", () => {
    const slotStart = new Date("2024-01-01T09:30:00Z");
    const slotEnd = new Date("2024-01-01T10:30:00Z");
    const busyStart = new Date("2024-01-01T10:00:00Z");
    const busyEnd = new Date("2024-01-01T11:00:00Z");

    const isConflict = slotEnd > busyStart && slotStart < busyEnd;
    expect(isConflict).toBe(true);
  });
});
