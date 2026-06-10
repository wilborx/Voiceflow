import { Router, type Request, type Response, type NextFunction } from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAuthUrl, exchangeCodeForTokens } from "../lib/google-calendar.js";
import { getFrontendUrl } from "../lib/base-url.js";

const router = Router();

function getAgentIntegrations(agent: { googleCalendarConnected: boolean | null; updatedAt: Date | null }) {
  const integrations = [
    {
      id: "google-calendar",
      name: "Google Kalender",
      status: (agent.googleCalendarConnected ?? false) ? "connected" : "available",
      description: "Automatische Terminbuchungen via Google Kalender integration",
      connectedAt: agent.updatedAt?.toISOString() ?? null,
    },
    {
      id: "stripe",
      name: "Stripe",
      status: "available",
      description: "Zahlungsabwicklung und Abo-Verwaltung",
    },
    {
      id: "vapi",
      name: "Vapi.ai",
      status: process.env.VAPI_API_KEY ? "connected" : "available",
      description: "KI-gestützte Telefonie und Sprachverarbeitung",
    },
    {
      id: "n8n",
      name: "n8n",
      status: "coming-soon",
      description: "Workflow-Automatisierung und Multi-Service-Integrationen",
    },
  ];
  return integrations;
}

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.query;
    if (!agentId || typeof agentId !== "string") {
      const integrations = getAgentIntegrations({ googleCalendarConnected: null, updatedAt: null });
      return res.json(integrations);
    }
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
    const integrations = getAgentIntegrations(agent ?? { googleCalendarConnected: null, updatedAt: null });
    res.json(integrations);
  } catch (err) {
    next(err);
  }
});

router.get("/google/auth", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.query;
    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json({ error: "agentId required" });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ error: "Google OAuth not configured" });
    }

    const authUrl = getAuthUrl(agentId);
    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
});

router.get("/google/callback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state: agentId } = req.query;

    if (!code || typeof code !== "string" || !agentId || typeof agentId !== "string") {
      return res.status(400).send("Invalid OAuth callback");
    }

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
    next(err);
  }
});

router.get("/google/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.query;
    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json({ error: "agentId required" });
    }

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json({
      connected: agent.googleCalendarConnected ?? false,
      agentId: agent.id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;