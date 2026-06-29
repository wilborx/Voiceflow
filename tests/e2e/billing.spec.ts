import { expect, test } from "@playwright/test";

test.describe("Billing E2E", () => {
  test("opens a mocked checkout session for the professional plan", async ({
    page,
  }) => {
    await page.route("**/api/billing/plans", async (route) => {
      await route.fulfill({
        json: [
          {
            key: "starter",
            name: "Starter",
            priceEuros: 99,
            minutes: 300,
            maxAgents: 1,
            features: ["1 KI-Agent"],
          },
          {
            key: "professional",
            name: "Professional",
            priceEuros: 249,
            minutes: 1000,
            maxAgents: 3,
            features: ["Bis zu 3 KI-Agenten"],
          },
          {
            key: "business",
            name: "Business",
            priceEuros: 549,
            minutes: 3000,
            maxAgents: 10,
            features: ["Bis zu 10 KI-Agenten"],
          },
        ],
      });
    });
    await page.route("**/api/billing/usage", async (route) => {
      await route.fulfill({
        json: {
          plan: "starter",
          minutesUsed: 47,
          minutesIncluded: 300,
          subscriptionStatus: "trialing",
          billingCycleStart: "2026-06-01T00:00:00.000Z",
          currentPeriodEnd: "2026-06-30T23:59:59.999Z",
        },
      });
    });
    await page.route("**/api/billing/checkout", async (route) => {
      await route.fulfill({
        json: {
          checkoutUrl: "https://checkout.example.test/cs_test_professional",
        },
      });
    });

    await page.goto("/billing");
    await expect(page.getByTestId("card-plan-professional")).toBeVisible();

    const popupPromise = page.waitForEvent("popup");
    await page.getByTestId("button-upgrade-professional").click();
    const popup = await popupPromise;

    await expect(popup).toHaveURL(
      "https://checkout.example.test/cs_test_professional",
    );
  });
});
