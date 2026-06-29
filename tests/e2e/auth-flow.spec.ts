import { test, expect } from "@playwright/test";

test.describe("Auth Flow", () => {
  test("should load dashboard (mocked auth)", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/VoiceFlow|Voiceflow/i);
  });

  test("should navigate to agents page", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /agents|agent/i })
      .first()
      .click();
    await expect(page).toHaveURL(/.*\/agents/);
  });
});
