import { Router } from "express";
import { db, callsTable, agentsTable } from "@workspace/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { GetRecentCallsQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayCalls] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callsTable)
      .where(gte(callsTable.createdAt, today));

    const [monthCalls] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callsTable)
      .where(gte(callsTable.createdAt, monthStart));

    const [avgDuration] = await db
      .select({ avg: sql<number>`coalesce(avg(duration_seconds), 0)` })
      .from(callsTable)
      .where(gte(callsTable.createdAt, monthStart));

    const [resolvedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callsTable)
      .where(and(gte(callsTable.createdAt, monthStart), eq(callsTable.resolved, true)));

    const [bookingsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callsTable)
      .where(and(
        gte(callsTable.createdAt, monthStart),
        eq(callsTable.resolutionType, "booked"),
      ));

    const [activeAgents] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentsTable)
      .where(eq(agentsTable.status, "active"));

    const monthCallsCount = Number(monthCalls.count);
    const resolutionRate = monthCallsCount > 0
      ? Math.round((Number(resolvedCount.count) / monthCallsCount) * 100)
      : 0;

    res.json({
      totalCallsToday: Number(todayCalls.count),
      totalCallsThisMonth: monthCallsCount,
      avgDurationSeconds: Math.round(Number(avgDuration.avg)),
      resolutionRate,
      bookingsThisMonth: Number(bookingsCount.count),
      activeAgents: Number(activeAgents.count),
      minutesUsed: Math.round(monthCallsCount * 3.5),
      minutesIncluded: 300,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
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
      .orderBy(desc(callsTable.createdAt))
      .limit(limit);

    res.json(results.map(({ call, agentName }) => ({
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
    })));
  } catch {
    res.status(500).json({ error: "Internal server error" });
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
      .where(gte(callsTable.createdAt, thirtyDaysAgo))
      .groupBy(sql`created_at::date`)
      .orderBy(sql`created_at::date`);

    res.json(rows.map((r) => ({
      date: r.date,
      calls: Number(r.calls),
      resolved: Number(r.resolved),
    })));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/agent-performance
router.get("/agent-performance", async (req, res) => {
  try {
    const agents = await db.select().from(agentsTable).orderBy(desc(agentsTable.totalCalls));

    const callStats = await db
      .select({
        agentId: callsTable.agentId,
        totalCalls: sql<number>`count(*)`,
        resolvedCalls: sql<number>`sum(case when resolved = true then 1 else 0 end)`,
        avgDuration: sql<number>`coalesce(avg(duration_seconds), 0)`,
      })
      .from(callsTable)
      .groupBy(callsTable.agentId);

    const statsMap = new Map(callStats.map((s) => [s.agentId, s]));

    res.json(agents.map((a) => {
      const stats = statsMap.get(a.id);
      const total = stats ? Number(stats.totalCalls) : Number(a.totalCalls);
      const resolved = stats ? Number(stats.resolvedCalls) : 0;
      return {
        agentId: a.id,
        agentName: a.name,
        totalCalls: total,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : Number(a.resolutionRate),
        avgDurationSeconds: stats ? Math.round(Number(stats.avgDuration)) : 0,
        status: a.status,
      };
    }));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
