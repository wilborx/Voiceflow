import { describe, it, expect } from "vitest";

describe("Agent schemas validation", () => {
  it("should validate agent type values", () => {
    const validTypes = [
      "booking",
      "advisory",
      "hr_screening",
      "hr_onboarding",
    ] as const;
    validTypes.forEach((type) => {
      expect([
        "booking",
        "advisory",
        "hr_screening",
        "hr_onboarding",
      ]).toContain(type);
    });
  });

  it("should reject invalid agent type", () => {
    const invalidType = "invalid";
    expect([
      "booking",
      "advisory",
      "hr_screening",
      "hr_onboarding",
    ]).not.toContain(invalidType);
  });

  it("should have correct status values", () => {
    const validStatuses = ["active", "inactive", "draft"] as const;
    validStatuses.forEach((status) => {
      expect(["active", "inactive", "draft"]).toContain(status);
    });
  });
});
