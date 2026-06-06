import { Router } from "express";
import { db, callsTable, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// POST /api/webhooks/vapi
router.post("/vapi", async (req, res) => {
  const secret = req.headers["x-vapi-secret"];
  if (process.env.VAPI_WEBHOOK_SECRET && secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const event = req.body;
  const messageType = event?.message?.type;

  try {
    switch (messageType) {
      case "call-started": {
        const { call } = event.message;
        const agentResult = await db
          .select({ id: agentsTable.id })
          .from(agentsTable)
          .where(eq(agentsTable.vapiAssistantId, call.assistantId))
          .limit(1);

        await db.insert(callsTable).values({
          vapiCallId: call.id,
          agentId: agentResult[0]?.id ?? null,
          callerNumber: call.customer?.number ?? null,
          direction: "inbound",
          status: "in_progress",
          startedAt: new Date(),
        }).onConflictDoNothing();
        break;
      }

      case "call-ended": {
        const { call } = event.message;
        const duration = call.endedAt && call.startedAt
          ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
          : 0;

        await db
          .update(callsTable)
          .set({
            status: "completed",
            durationSeconds: duration,
            endedAt: call.endedAt ? new Date(call.endedAt) : null,
            transcript: call.transcript ?? null,
            summary: call.summary ?? null,
          })
          .where(eq(callsTable.vapiCallId, call.id));
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
