import { expect, test } from "@playwright/test";

const createdAgent = {
  id: "agent-e2e-1",
  name: "Termin Assistent",
  type: "booking",
  status: "draft",
  phoneNumber: null,
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  voiceName: "Lena",
  language: "de",
  systemPrompt: "Du bist eine freundliche KI-Telefonassistentin.",
  businessName: "Praxis Muster",
  businessHoursOpen: "09:00",
  businessHoursClose: "18:00",
  timezone: "Europe/Berlin",
  totalCalls: 0,
  totalMinutes: 0,
  resolutionRate: 0,
  vapiAssistantId: "asst-e2e-1",
  createdAt: "2026-06-12T10:00:00.000Z",
  updatedAt: "2026-06-12T10:00:00.000Z",
};

test.describe("Agent creation E2E", () => {
  test("creates a booking agent through the wizard", async ({ page }) => {
    await page.route("**/api/agent-config/voices", async (route) => {
      await route.fulfill({
        json: [
          {
            id: "21m00Tcm4TlvDq8ikWAM",
            name: "Lena",
            description: "Freundlich, warm",
          },
          {
            id: "AZnzlk1XvdvUeBnXmlld",
            name: "Domi",
            description: "Professionell, klar",
          },
        ],
      });
    });
    await page.route("**/api/agent-config/prompts", async (route) => {
      await route.fulfill({
        json: {
          booking:
            "Du bist eine freundliche KI-Telefonassistentin. Dein Name ist Lena.",
        },
      });
    });
    await page.route("**/api/agents", async (route) => {
      await route.fulfill({ status: 201, json: createdAgent });
    });

    await page.goto("/agents/new");
    await expect(page.getByTestId("card-agent-type-booking")).toBeVisible();

    await page.getByTestId("card-agent-type-booking").click();
    await page.getByTestId("button-next-step").click();
    await page.getByTestId("input-agent-name").fill("Termin Assistent");
    await page.getByTestId("input-business-name").fill("Praxis Muster");
    await page.getByTestId("button-next-step").click();
    await page.getByTestId("card-voice-21m00Tcm4TlvDq8ikWAM").click();
    await page.getByTestId("button-next-step").click();
    await expect(page.getByTestId("textarea-system-prompt")).toHaveValue(
      /KI-Telefonassistentin/,
    );
    await page.getByTestId("button-activate-agent").click();

    await expect(page).toHaveURL(/\/agents\/agent-e2e-1/);
  });
});
