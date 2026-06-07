import { Router } from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAuthUrl, exchangeCodeForTokens } from "../lib/google-calendar.js";
import { getFrontendUrl } from "../lib/base-url.js";

const router = Router();

router.get("/google/auth", (req, res) => {
  const { agentId } = req.query;
  if (!agentId || typeof agentId !== "string") {
    return res.status(400).json({ error: "agentId required" });
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: "Google OAuth not configured" });
  }

  const authUrl = getAuthUrl(agentId);
  res.json({ authUrl });
});

router.get("/google/callback", async (req, res) => {
  const { code, state: agentId } = req.query;

  if (!code || typeof code !== "string" || !agentId || typeof agentId !== "string") {
    return res.status(400).send("Invalid OAuth callback");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    await db
      .update(agentsTable)
      .set({
        googleCalendarAccessToken: tokens.access_token ?? null,
        googleCalendarRefreshToken: tokens.refresh_token ?? null,
        googleCalendarConnected: true,
        updatedAt: new Date(),
      })
      .where(eq(agentsTable.id, agentId));

    res.redirect(`${getFrontendUrl()}/agents/${agentId}?calendar=connected`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.status(500).send("OAuth callback failed");
  }
});

export default router;
