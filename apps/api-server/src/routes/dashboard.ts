import { Router } from "express";
import { db, callsTable, agentsTable } from "@workspace/db";
import type { Agent, Call } from "@workspace/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { decrypt } from "@workspace/crypto";
import { GetRecentCallsQueryParams } from "@workspace/api-zod";
import { recordAudit } from "../middlewares/audit";

const router = Router();

type AgentPerformanceStats = {
  agentId: string | null;
  totalCalls: number;
  resolvedCalls: number;
  avgDuration: number;
};

function getOrgOwnerId(req: { org?: { ownerId: string } }) {
  return req.org?.ownerId ?? "";
}

function decryptStored(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return decrypt(value) ?? value;
}

// GET /api/dashboard/stats
router.get("/stats", async (req, res) => {
  try {
    const orgOwnerId = getOrgOwnerId(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const orgFilter = eq(agentsTable.ownerId, orgOwnerId);

    const [todayCalls] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(and(gte(callsTable.createdAt, today), orgFilter));

    const [monthCalls] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(and(gte(callsTable.createdAt, monthStart), orgFilter));

    const [avgDuration] = await db
      .select({ avg: sql<number>`coalesce(avg(duration_seconds), 0)` })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(and(gte(callsTable.createdAt, monthStart), orgFilter));

    const [resolvedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(
        and(
          gte(callsTable.createdAt, monthStart),
          eq(callsTable.resolved, true),
          orgFilter,
        ),
      );

    const [bookingsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(
        and(
          gte(callsTable.createdAt, monthStart),
          eq(callsTable.resolutionType, "booked"),
          orgFilter,
        ),
      );

    const [activeAgents] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentsTable)
      .where(and(eq(agentsTable.status, "active"), orgFilter));

    const monthCallsCount = Number(monthCalls.count);
    const resolutionRate =
      monthCallsCount > 0
        ? Math.round((Number(resolvedCount.count) / monthCallsCount) * 100)
        : 0;

    return res.json({
      totalCallsToday: Number(todayCalls.count),
      totalCallsThisMonth: monthCallsCount,
      avgDurationSeconds: Math.round(Number(avgDuration.avg)),
      resolutionRate,
      bookingsThisMonth: Number(bookingsCount.count),
      activeAgents: Number(activeAgents.count),
      minutesUsed: Math.round(monthCallsCount * 3.5),
      minutesIncluded: req.org?.minutesIncluded ?? 300,
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/recent-calls
router.get("/recent-calls", async (req, res) => {
  const parsed = GetRecentCallsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;

  try {
    const results = await db
      .select({ call: callsTable, agentName: agentsTable.name })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(and(eq(agentsTable.ownerId, getOrgOwnerId(req))))
      .orderBy(desc(callsTable.createdAt))
      .limit(limit);

    await recordAudit(req, "call.accessed", "calls", "recent", { limit });

    return res.json(
      results.map(
        ({ call, agentName }: { call: Call; agentName: string | null }) => ({
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
          startedAt: call.startedAt?.toISOString() ?? null,
          endedAt: call.endedAt?.toISOString() ?? null,
          createdAt: call.createdAt.toISOString(),
        }),
      ),
    );
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/call-volume
router.get("/call-volume", async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rows = await db
      .select({
        date: sql<string>`to_char(created_at::date, 'YYYY-MM-DD')`,
        calls: sql<number>`count(*)`,
        resolved: sql<number>`sum(case when resolved = true then 1 else 0 end)`,
      })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(
        and(
          gte(callsTable.createdAt, thirtyDaysAgo),
          eq(agentsTable.ownerId, getOrgOwnerId(req)),
        ),
      )
      .groupBy(sql`created_at::date`)
      .orderBy(sql`created_at::date`);

    return res.json(
      rows.map((r: { date: string; calls: number; resolved: number }) => ({
        date: r.date,
        calls: Number(r.calls),
        resolved: Number(r.resolved),
      })),
    );
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/agent-performance
router.get("/agent-performance", async (req, res) => {
  try {
    const orgOwnerId = getOrgOwnerId(req);
    const agents = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.ownerId, orgOwnerId))
      .orderBy(desc(agentsTable.totalCalls));

    const callStats = (await db
      .select({
        agentId: callsTable.agentId,
        totalCalls: sql<number>`count(*)`,
        resolvedCalls: sql<number>`sum(case when resolved = true then 1 else 0 end)`,
        avgDuration: sql<number>`coalesce(avg(duration_seconds), 0)`,
      })
      .from(callsTable)
      .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
      .where(eq(agentsTable.ownerId, orgOwnerId))
      .groupBy(callsTable.agentId)) as AgentPerformanceStats[];

    const statsMap = new Map(
      callStats.map((s: AgentPerformanceStats) => [s.agentId, s]),
    );

    return res.json(
      agents.map((a: Agent) => {
        const stats = statsMap.get(a.id);
        const total = stats ? Number(stats.totalCalls) : Number(a.totalCalls);
        const resolved = stats ? Number(stats.resolvedCalls) : 0;
        return {
          agentId: a.id,
          agentName: a.name,
          totalCalls: total,
          resolutionRate:
            total > 0
              ? Math.round((resolved / total) * 100)
              : Number(a.resolutionRate),
          avgDurationSeconds: stats ? Math.round(Number(stats.avgDuration)) : 0,
          status: a.status,
        };
      }),
    );
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
