import { Router, type Request, type Response } from "express";
import { db, callsTable, agentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { sendSMS } from "../lib/telnyx.js";

const router = Router();

router.post("/vapi", async (req: Request, res: Response) => {
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

        if (agentResult[0]?.id) {
          await db
            .update(agentsTable)
            .set({ totalCalls: sql`${agentsTable.totalCalls} + 1` })
            .where(eq(agentsTable.id, agentResult[0].id));
        }
        break;
      }

      case "call-ended": {
        const { call } = event.message;
        const duration = call.endedAt && call.startedAt
          ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
          : 0;

        const minutesUsed = Math.max(1, Math.ceil(duration / 60));

        await db
          .update(callsTable)
          .set({
            status: "completed",
            durationSeconds: duration,
            endedAt: call.endedAt ? new Date(call.endedAt) : null,
            transcript: call.transcript ?? null,
            summary: call.summary ?? null,
            resolved: true,
            resolutionType: "completed",
          })
          .where(eq(callsTable.vapiCallId, call.id));

        const callRecord = await db
          .select({ agentId: callsTable.agentId })
          .from(callsTable)
          .where(eq(callsTable.vapiCallId, call.id))
          .limit(1);

        if (callRecord[0]?.agentId) {
          await db
            .update(agentsTable)
            .set({
              totalMinutes: sql`${agentsTable.totalMinutes} + ${minutesUsed}`,
            })
            .where(eq(agentsTable.id, callRecord[0].agentId));
        }
        break;
      }

      case "function-call": {
        const { functionCall } = event.message;
        console.log("Tool call received:", functionCall?.name, functionCall?.parameters);
        return res.json({ result: "Tool endpoint handles this separately" });
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
