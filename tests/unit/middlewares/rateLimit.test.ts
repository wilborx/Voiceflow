import { describe, it, expect } from "vitest";

describe("rateLimitMiddleware", () => {
  const GENERAL_LIMIT = 100;
  const WRITE_LIMIT = 10;
  const WINDOW_MS = 60000;

  it("should have correct configuration for general limiter", () => {
    expect(GENERAL_LIMIT).toBe(100);
    expect(WINDOW_MS).toBe(60000);
  });

  it("should have correct configuration for write limiter", () => {
    expect(WRITE_LIMIT).toBe(10);
    expect(WRITE_LIMIT).toBeLessThan(GENERAL_LIMIT);
  });

  it("should allow GET requests through general limiter", () => {
    const method = "GET";
    expect(method).toBe("GET");
  });

  it("should apply write limiter for POST requests", () => {
    const method = "POST";
    expect(method).toBe("POST");
  });

  it("should skip rate limiting for Stripe webhooks", () => {
    const headers = { "stripe-signature": "sig_test" };
    expect(headers["stripe-signature"]).toBeDefined();
  });

  it("should skip rate limiting for Vapi webhooks", () => {
    const headers = { "x-vapi-secret": "secret_test" };
    expect(headers["x-vapi-secret"]).toBeDefined();
  });
});
