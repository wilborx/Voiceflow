import { expect, test } from "@playwright/test";

test.describe("DSGVO deletion E2E", () => {
  test("requests complete organization data deletion", async ({ page }) => {
    await page.route("**/api/settings", async (route) => {
      await route.fulfill({
        json: {
          id: "org-e2e-1",
          name: "VoiceFlow GmbH",
          email: "admin@voiceflow.test",
          timezone: "Europe/Berlin",
          language: "de",
          dataRetentionDays: 365,
          minutesUsed: 0,
          plan: "starter",
        },
      });
    });
    await page.route("**/api/integrations", async (route) => {
      await route.fulfill({ json: [] });
    });
    await page.route("**/api/settings/data-request", async (route) => {
      await route.fulfill({
        json: { success: true, message: "Deletion request received" },
      });
    });

    await page.goto("/settings");
    await expect(page.getByTestId("button-delete-data")).toBeVisible();

    await page.getByTestId("button-delete-data").click();

    await expect(page.getByText("Deletion complete")).toBeVisible();
  });
});
