import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  db,
  organizationsTable,
  agentsTable,
  callsTable,
  auditLogsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";
import { decrypt } from "@workspace/crypto";
import { logger } from "../lib/logger";
import { recordAudit } from "../middlewares/audit";
import { requireOrganization } from "../middlewares/errorHandler";

type DeleteDataBody = {
  confirmation?: string;
};

const router = Router();

function decryptStored(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return decrypt(value) ?? value;
}

function getOrg(req: Request) {
  if (!req.org) {
    throw new Error("Organization context required");
  }
  return req.org;
}

router.get(
  "/",
  requireOrganization,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const org = getOrg(_req);
      res.json({
        ...org,
        vapiConfigured: !!process.env.VAPI_API_KEY,
        elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/",
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = getOrg(req);

      const parsed = UpdateSettingsBody.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: parsed.error.message });

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.timezone !== undefined)
        updates.timezone = parsed.data.timezone;
      if (parsed.data.language !== undefined)
        updates.language = parsed.data.language;

      const dataRetentionDays = (
        req.body as { dataRetentionDays?: unknown } | undefined
      )?.dataRetentionDays;
      if (
        typeof dataRetentionDays === "number" &&
        Number.isInteger(dataRetentionDays) &&
        dataRetentionDays > 0
      ) {
        updates.dataRetentionDays = dataRetentionDays;
      }

      const [updated] = await db
        .update(organizationsTable)
        .set(updates)
        .where(eq(organizationsTable.id, org.id))
        .returning();

      return res.json({
        ...updated,
        vapiConfigured: !!process.env.VAPI_API_KEY,
        elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
        googleCalendarConnected: false,
      });
    } catch (err) {
      return next(err);
    }
  },
);

router.post(
  "/data-request",
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = getOrg(req);
      const body = req.body as DeleteDataBody | undefined;

      if (body?.confirmation !== "DELETE_MY_DATA") {
        return res
          .status(400)
          .json({ error: "Deletion confirmation required" });
      }

      await recordAudit(
        req,
        "data.deletion_requested",
        "organization",
        org.id,
        { confirmation: "DELETE_MY_DATA" },
      );

      const agents = await db
        .select({ id: agentsTable.id })
        .from(agentsTable)
        .where(eq(agentsTable.ownerId, org.ownerId));
      const agentIds = agents.map((a: { id: string }) => a.id);

      if (agentIds.length > 0) {
        await db
          .delete(callsTable)
          .where(inArray(callsTable.agentId, agentIds));
      }
      await db.delete(agentsTable).where(eq(agentsTable.ownerId, org.ownerId));
      await db
        .delete(organizationsTable)
        .where(eq(organizationsTable.id, org.id));

      return res.json({
        success: true,
        status: "deleted",
        message: "All data deleted",
      });
    } catch (err) {
      logger.error({ err }, "Data deletion request failed");
      return next(err);
    }
  },
);

router.get(
  "/export",
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const org = getOrg(req);

      await recordAudit(req, "data.export_requested", "organization", org.id);

      const agents = await db
        .select()
        .from(agentsTable)
        .where(eq(agentsTable.ownerId, org.ownerId));
      const agentIds = agents.map((agent: { id: string }) => agent.id);
      const calls =
        agentIds.length > 0
          ? await db
              .select()
              .from(callsTable)
              .where(inArray(callsTable.agentId, agentIds))
          : [];
      const auditLogs = await db
        .select()
        .from(auditLogsTable)
        .where(eq(auditLogsTable.orgId, org.id));

      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="voiceflow-export-${org.id}.ndjson"`,
      );

      const OrgTransform = {
        ...org,
        stripeCustomerId: undefined,
        stripeSubscriptionId: undefined,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      };
      res.write(
        JSON.stringify({ type: "organization", data: OrgTransform }) + "\n",
      );

      for (const agent of agents) {
        const AgentTransform = {
          ...agent,
          googleCalendarAccessToken: undefined,
          googleCalendarRefreshToken: undefined,
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        };
        res.write(
          JSON.stringify({ type: "agent", data: AgentTransform }) + "\n",
        );
      }

      for (const call of calls) {
        const CallTransform = {
          ...call,
          callerNumber: decryptStored(call.callerNumber),
          transcript: decryptStored(call.transcript),
          summary: decryptStored(call.summary),
          extractedData: decryptStored(call.extractedData),
          recordingUrl: call.recordingUrl,
          createdAt: call.createdAt.toISOString(),
          startedAt: call.startedAt?.toISOString() ?? null,
          endedAt: call.endedAt?.toISOString() ?? null,
        };
        res.write(JSON.stringify({ type: "call", data: CallTransform }) + "\n");
      }

      for (const auditLog of auditLogs) {
        res.write(
          JSON.stringify({
            type: "audit_log",
            data: {
              ...auditLog,
              createdAt: auditLog.createdAt.toISOString(),
            },
          }) + "\n",
        );
      }

      return res.end();
    } catch (err) {
      logger.error({ err }, "Data export failed");
      return next(err);
    }
  },
);

router.get("/documents/avv.txt", (_req: Request, res: Response) => {
  res.sendFile("attached_assets/avv.txt", { root: "..", dotfiles: "allow" });
});

router.get("/documents/privacy-policy.txt", (_req: Request, res: Response) => {
  res.sendFile("attached_assets/privacy-policy.txt", {
    root: "..",
    dotfiles: "allow",
  });
});

export default router;
