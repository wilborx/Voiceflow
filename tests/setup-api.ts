import { beforeAll, afterAll, afterEach } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:6543/voiceflow";
process.env.VAPI_API_KEY = "test-vapi-key";
process.env.VAPI_WEBHOOK_SECRET = "test-webhook-secret";
process.env.STRIPE_SECRET_KEY = "test-stripe-secret";
process.env.STRIPE_WEBHOOK_SECRET = "test-stripe-webhook-secret";
process.env.CLERK_SECRET_KEY = "test-clerk-secret";
process.env.ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
process.env.OAUTH_STATE_SECRET = "test-oauth-state-secret";

beforeAll(() => {
  // Setup test environment
});

afterEach(() => {
  // Cleanup between tests
});

afterAll(() => {
  // Global teardown
});
