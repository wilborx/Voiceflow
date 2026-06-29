import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db, callsTable, agentsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { GetCallParams, ListCallsQueryParams } from "@workspace/api-zod";
import { decrypt } from "@workspace/crypto";
import { logger } from "../lib/logger";
import { recordAudit } from "../middlewares/audit";
import type { Call } from "@workspace/db";

function decryptStored(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return decrypt(value) ?? value;
}

function getOrgOwnerId(req: Request): string {
  const ownerId = req.org?.ownerId;
  if (!ownerId) {
    throw new Error("Organization context required");
  }
  return ownerId;
}

function mapCall(call: Call, agentName?: string | null) {
  return {
    id: call.id,
    agentId: call.agentId,
    agentName: agentName ?? null,
    callerNumber: decryptStored(call.callerNumber),
    direction: call.direction,
    status: call.status,
    durationSeconds: call.durationSeconds,
    resolved: call.resolved,
    resolutionType: call.resolutionType,
    escalatedToHuman: call.escalatedToHuman,
    transcript: decryptStored(call.transcript),
    summary: decryptStored(call.summary),
    sentiment: call.sentiment,
    consentGiven: call.consentGiven,
    consentVersion: call.consentVersion,
    consentMethod: call.consentMethod,
    consentTimestamp: call.consentTimestamp?.toISOString() ?? null,
    startedAt: call.startedAt?.toISOString() ?? null,
    endedAt: call.endedAt?.toISOString() ?? null,
    createdAt: call.createdAt.toISOString(),
  };
}

const router = Router();

// GET /api/calls
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ListCallsQueryParams.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.message });

    const { agentId, status, limit } = parsed.data;
    const orgOwnerId = getOrgOwnerId(req);

    const agents = await db
      .select({ id: agentsTable.id })
      .from(agentsTable)
      .where(eq(agentsTable.ownerId, orgOwnerId));

    if (agents.length === 0) {
      return res.json([]);
    }

    const agentIds = agents.map((a: { id: string }) => a.id);
    const results = await db
      .select({
        call: callsTable,
        agentName: agentsTable.name,
      })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(inArray(callsTable.agentId, agentIds))
      .orderBy(desc(callsTable.createdAt));

    const filtered = results.filter(
      (r: { call: Call; agentName: string | null }) => {
        if (agentId && r.call.agentId !== agentId) return false;
        if (status && r.call.status !== status) return false;
        return true;
      },
    );

    await recordAudit(req, "call.accessed", "calls", "list", {
      count: filtered.length,
    });

    return res.json(
      filtered
        .slice(0, limit ?? 50)
        .map((r: { call: Call; agentName: string | null }) =>
          mapCall(r.call, r.agentName),
        ),
    );
  } catch (err) {
    if ((err as Error).message === "Organization context required") {
      logger.warn({ path: req.path }, "Missing organization context");
      return res.status(403).json({ error: "Organization context required" });
    }
    logger.error({ err }, "GET /api/calls error");
    return next(err);
  }
});

// DELETE /api/calls/:id/consent
router.delete(
  "/:id/consent",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = GetCallParams.safeParse(req.params);
      if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

      const orgOwnerId = getOrgOwnerId(req);
      const call = await db
        .select({ call: callsTable, ownerAgent: agentsTable })
        .from(callsTable)
        .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
        .where(eq(callsTable.id, parsed.data.id))
        .limit(1);

      if (!call.length) return res.status(404).json({ error: "Not found" });

      const ownerAgent = call[0].ownerAgent;
      if (ownerAgent && ownerAgent.ownerId !== orgOwnerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db
        .update(callsTable)
        .set({
          consentGiven: false,
          consentVersion: null,
          consentMethod: null,
          consentTimestamp: null,
          consentIpHash: null,
          consentVapiEventId: null,
          callerNumber: null,
          transcript: null,
          summary: null,
          extractedData: null,
          recordingUrl: null,
          deletedAt: new Date(),
        })
        .where(eq(callsTable.id, parsed.data.id));

      await recordAudit(req, "consent.revoked", "call", parsed.data.id);

      return res.json({
        success: true,
        message: "Consent revoked, data erased",
      });
    } catch (err) {
      if ((err as Error).message === "Organization context required") {
        return res.status(403).json({ error: "Organization context required" });
      }
      logger.error({ err }, "DELETE /api/calls/:id/consent error");
      return next(err);
    }
  },
);

// GET /api/calls/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = GetCallParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

    const orgOwnerId = getOrgOwnerId(req);

    const results = await db
      .select({
        call: callsTable,
        agentName: agentsTable.name,
        ownerId: agentsTable.ownerId,
      })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(eq(callsTable.id, parsed.data.id))
      .limit(1);

    if (!results.length) return res.status(404).json({ error: "Not found" });

    const { call, agentName, ownerId } = results[0];

    if (ownerId && ownerId !== orgOwnerId) {
      logger.warn(
        { callId: call.id, expectedOwner: ownerId, orgOwnerId },
        "Unauthorized call access",
      );
      return res.status(403).json({ error: "Access denied" });
    }

    await recordAudit(req, "call.accessed", "call", call.id);

    return res.json(mapCall(call, agentName));
  } catch (err) {
    if ((err as Error).message === "Organization context required") {
      return res.status(403).json({ error: "Organization context required" });
    }
    logger.error({ err }, "GET /api/calls/:id error");
    return next(err);
  }
});

export default router;
