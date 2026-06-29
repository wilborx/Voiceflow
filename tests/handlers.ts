import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("https://api.vapi.ai/assistant", () => {
    return HttpResponse.json({
      id: "assistant-test-123",
      name: "Test Assistant",
      createdAt: new Date().toISOString(),
    });
  }),

  http.get("https://api.vapi.ai/assistant/:id", () => {
    return HttpResponse.json({
      id: "assistant-test-123",
      name: "Test Assistant",
      createdAt: new Date().toISOString(),
    });
  }),

  http.patch("https://api.vapi.ai/assistant/:id", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: "assistant-test-123",
      name: "Test Assistant",
      updatedAt: new Date().toISOString(),
      body,
    });
  }),

  http.delete("https://api.vapi.ai/assistant/:id", () => {
    return HttpResponse.json({ deleted: true });
  }),

  http.get("https://api.telnyx.com/v2/available_phone_numbers", () => {
    return HttpResponse.json({
      data: [{ phone_number: "+493012345678", features: ["voice"] }],
    });
  }),

  http.post("https://api.telnyx.com/v2/number_orders", () => {
    return HttpResponse.json({
      data: {
        phone_numbers: [{ phone_number: "+493012345678" }],
      },
    });
  }),

  http.post("https://api.telnyx.com/v2/messaging", () => {
    return HttpResponse.json({
      data: {
        id: "msg-test-123",
        to: "+49123456789",
        from: "+49987654321",
        body: "Test message",
      },
    });
  }),

  http.delete("https://api.telnyx.com/v2/phone_numbers/:phoneNumber", () => {
    return HttpResponse.json({ deleted: true });
  }),

  http.post("https://api.stripe.com/v1/checkout/sessions", () => {
    return HttpResponse.json({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/test",
      status: "open",
    });
  }),

  http.get("https://api.stripe.com/v1/customers/:id", () => {
    return HttpResponse.json({
      id: "cus_test_123",
      email: "test@example.com",
      metadata: {},
    });
  }),

  http.post("https://api.stripe.com/v1/billing_portal/sessions", () => {
    return HttpResponse.json({
      url: "https://billing.stripe.com/session/test",
    });
  }),
];
