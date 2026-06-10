import { Router, type Request, type Response, type NextFunction } from "express";
import { db, callsTable, agentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GetCallParams, ListCallsQueryParams } from "@workspace/api-zod";

const router = Router();

function mapCall(call: typeof callsTable.$inferSelect, agentName?: string | null) {
  return {
    id: call.id,
    agentId: call.agentId,
    agentName: agentName ?? null,
    callerNumber: call.callerNumber,
    direction: call.direction,
    status: call.status,
    durationSeconds: call.durationSeconds,
    resolved: call.resolved,
    resolutionType: call.resolutionType,
    escalatedToHuman: call.escalatedToHuman,
    transcript: call.transcript,
    summary: call.summary,
    sentiment: call.sentiment,
    startedAt: call.startedAt?.toISOString() ?? null,
    endedAt: call.endedAt?.toISOString() ?? null,
    createdAt: call.createdAt.toISOString(),
  };
}

// GET /api/calls
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ListCallsQueryParams.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const { agentId, status, limit } = parsed.data;

    const results = await db
      .select({
        call: callsTable,
        agentName: agentsTable.name,
      })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .orderBy(desc(callsTable.createdAt));

    const filtered = results.filter((r) => {
      if (agentId && r.call.agentId !== agentId) return false;
      if (status && r.call.status !== status) return false;
      return true;
    });

    res.json(filtered.slice(0, limit ?? 50).map((r) => mapCall(r.call, r.agentName)));
  } catch (err) {
    console.error("GET /api/calls error:", err);
    next(err);
  }
});

// GET /api/calls/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = GetCallParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

    const results = await db
      .select({ call: callsTable, agentName: agentsTable.name })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(eq(callsTable.id, parsed.data.id))
      .limit(1);

    if (!results.length) return res.status(404).json({ error: "Not found" });
    const { call, agentName } = results[0];
    res.json(mapCall(call, agentName));
  } catch (err) {
    console.error("GET /api/calls/:id error:", err);
    next(err);
  }
});

export default router;