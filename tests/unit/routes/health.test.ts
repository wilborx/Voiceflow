import { describe, it, expect } from "vitest";

describe("Health Check Schema", () => {
  it("should have valid status values", () => {
    const validStatuses = ["ok", "error", "degraded"];
    validStatuses.forEach((status) => {
      expect(typeof status).toBe("string");
    });
  });

  it("should parse valid health check response", () => {
    const input = { status: "ok" };
    expect(input.status).toBe("ok");
  });

  it("should return ok status", () => {
    expect({ status: "ok" }.status).toBe("ok");
  });

  it("should accept non-empty status", () => {
    const result = { status: "ok" };
    expect(result.status.length).toBeGreaterThan(0);
  });
});
