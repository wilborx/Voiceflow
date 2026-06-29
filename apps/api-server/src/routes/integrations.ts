import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt, encrypt } from "@workspace/crypto";
import {
  getAuthUrl,
  exchangeCodeForTokens,
  verifyState,
} from "../lib/google-calendar.js";
import { getFrontendUrl } from "../lib/base-url.js";

function getAgentIntegrations(agent: {
  googleCalendarConnected: boolean | null;
  updatedAt: Date | null;
}) {
  return [
    {
      id: "google-calendar",
      name: "Google Kalender",
      status:
        (agent.googleCalendarConnected ?? false) ? "connected" : "available",
      description:
        "Automatische Terminbuchungen via Google Kalender integration",
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
}

function decryptToken(
  value: string | null | undefined,
): string | null | undefined {
  if (!value) return value;
  return decrypt(value) ?? value;
}

async function getOrgAgent(agentId: string, orgOwnerId: string) {
  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, agentId))
    .limit(1);

  if (!agent || agent.ownerId !== orgOwnerId) return null;
  return agent;
}

const router = Router();

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.query;
    if (!agentId || typeof agentId !== "string") {
      return res.json(
        getAgentIntegrations({
          googleCalendarConnected: null,
          updatedAt: null,
        }),
      );
    }
    const agent = await getOrgAgent(agentId, req.org?.ownerId ?? "");
    return res.json(
      getAgentIntegrations(
        agent ?? { googleCalendarConnected: null, updatedAt: null },
      ),
    );
  } catch (err) {
    return next(err);
  }
});

router.get(
  "/google/auth",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.query;
      if (!agentId || typeof agentId !== "string") {
        return res.status(400).json({ error: "agentId required" });
      }
      if (!(await getOrgAgent(agentId, req.org?.ownerId ?? ""))) {
        return res.status(404).json({ error: "Agent not found" });
      }
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(503).json({ error: "Google OAuth not configured" });
      }
      return res.json({ authUrl: getAuthUrl(agentId) });
    } catch (err) {
      return next(err);
    }
  },
);

router.get(
  "/google/callback",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state } = req.query;
      if (
        !code ||
        typeof code !== "string" ||
        !state ||
        typeof state !== "string"
      ) {
        return res.status(400).send("Invalid OAuth callback");
      }
      const agentId = verifyState(state);
      if (!agentId) {
        return res
          .status(400)
          .send("Invalid state parameter - possible CSRF attack");
      }
      if (!(await getOrgAgent(agentId, req.org?.ownerId ?? ""))) {
        return res.status(404).send("Agent not found");
      }
      const tokens = await exchangeCodeForTokens(code);

      await db
        .update(agentsTable)
        .set({
          googleCalendarAccessToken: encrypt(tokens.access_token ?? null),
          googleCalendarRefreshToken: encrypt(tokens.refresh_token ?? null),
          googleCalendarConnected: true,
          updatedAt: new Date(),
        })
        .where(eq(agentsTable.id, agentId));
      return res.redirect(
        `${getFrontendUrl()}/agents/${agentId}?calendar=connected`,
      );
    } catch (err) {
      return next(err);
    }
  },
);

router.get(
  "/google/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.query;
      if (!agentId || typeof agentId !== "string") {
        return res.status(400).json({ error: "agentId required" });
      }
      const agent = await getOrgAgent(agentId, req.org?.ownerId ?? "");
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      return res.json({
        connected: agent.googleCalendarConnected ?? false,
        agentId: agent.id,
      });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;

export function decryptGoogleTokens(agent: {
  googleCalendarAccessToken: string | null;
  googleCalendarRefreshToken: string | null;
}) {
  return {
    accessToken: decryptToken(agent.googleCalendarAccessToken) ?? null,
    refreshToken: decryptToken(agent.googleCalendarRefreshToken) ?? null,
  };
}
