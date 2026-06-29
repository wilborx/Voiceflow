import { createHash } from "node:crypto";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db, callsTable, agentsTable, webhookEventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { encrypt } from "@workspace/crypto";
import { logger } from "../lib/logger";

const router = Router();

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function getDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getIpHash(ipAddress: string | undefined): string | undefined {
  if (!ipAddress) return undefined;
  return createHash("sha256").update(ipAddress).digest("hex");
}

function getCustomerNumber(
  call: Record<string, unknown> | undefined,
): string | undefined {
  const customer = call?.customer;
  if (!customer || typeof customer !== "object" || customer === null)
    return undefined;
  return getString((customer as { number?: unknown }).number);
}

function verifyVapiSecret(req: Request, res: Response): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  const headerSecret = req.headers["x-vapi-secret"];

  if (process.env.NODE_ENV === "test" && !secret) return true;

  if (!secret || typeof headerSecret !== "string" || headerSecret !== secret) {
    res
      .status(secret ? 401 : 503)
      .json({
        error: secret ? "Unauthorized" : "Vapi webhook secret not configured",
      });
    return false;
  }

  return true;
}

async function markWebhookReceived(eventId: string, eventType: string) {
  await db
    .insert(webhookEventsTable)
    .values({
      source: "vapi",
      eventId,
      eventType,
      receivedAt: new Date(),
    })
    .onConflictDoNothing();
}

function getVapiEventId(event: unknown, fallback: string): string {
  const candidate =
    typeof event === "object" && event !== null
      ? getString((event as { eventId?: unknown }).eventId)
      : undefined;
  return candidate ?? fallback;
}

router.post(
  "/vapi/consent",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.webhookVerified !== true && !verifyVapiSecret(req, res)) return;

      const event = req.body as Record<string, unknown> | undefined;
      const callId = getString(event?.callId);
      const consentGiven = getBoolean(event?.consentGiven);

      if (!callId || consentGiven === undefined) {
        return res
          .status(400)
          .json({ error: "callId and consentGiven are required" });
      }

      const eventId = getVapiEventId(event, `${callId}:consent`);
      await markWebhookReceived(eventId, "consent");

      await db
        .update(callsTable)
        .set({
          consentGiven,
          consentVersion: getString(event?.consentVersion) ?? "1.0",
          consentMethod: getString(event?.consentMethod) ?? "dtmf",
          consentTimestamp: getDate(event?.consentTimestamp) ?? new Date(),
          consentIpHash: getString(event?.consentIpHash) ?? getIpHash(req.ip),
          consentVapiEventId: eventId,
        })
        .where(eq(callsTable.vapiCallId, callId));

      return res.json({ received: true });
    } catch (err) {
      logger.error({ err }, "Webhook consent error");
      return next(err);
    }
  },
);

router.post(
  "/vapi",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.webhookVerified !== true && !verifyVapiSecret(req, res)) return;

      const event = req.body as Record<string, unknown> | undefined;
      const message = event?.message as Record<string, unknown> | undefined;
      const messageType = getString(message?.type);

      switch (messageType) {
        case "call-started": {
          const call = message?.call as Record<string, unknown> | undefined;
          const callId = getString(call?.id);
          if (!callId)
            return res.status(400).json({ error: "Vapi call id is required" });

          const assistantId = getString(call?.assistantId);
          const agentResult = assistantId
            ? await db
                .select({ id: agentsTable.id })
                .from(agentsTable)
                .where(eq(agentsTable.vapiAssistantId, assistantId))
                .limit(1)
            : [];
          const callerNumber = getCustomerNumber(call);

          await markWebhookReceived(
            getVapiEventId(event, `${callId}:call-started`),
            "call-started",
          );

          await db
            .insert(callsTable)
            .values({
              vapiCallId: callId,
              agentId: agentResult[0]?.id ?? null,
              callerNumber: encrypt(callerNumber),
              direction: "inbound",
              status: "in_progress",
              startedAt: new Date(),
            })
            .onConflictDoNothing();

          if (agentResult[0]?.id) {
            await db
              .update(agentsTable)
              .set({ totalCalls: sql`${agentsTable.totalCalls} + 1` })
              .where(eq(agentsTable.id, agentResult[0].id));
          }
          return res.json({ received: true });
        }

        case "call-ended": {
          const call = message?.call as Record<string, unknown> | undefined;
          const callId = getString(call?.id);
          if (!callId)
            return res.status(400).json({ error: "Vapi call id is required" });
          const duration =
            call?.endedAt && call?.startedAt
              ? Math.round(
                  (new Date(String(call.endedAt)).getTime() -
                    new Date(String(call.startedAt)).getTime()) /
                    1000,
                )
              : 0;

          const minutesUsed = Math.max(1, Math.ceil(duration / 60));

          await markWebhookReceived(
            getVapiEventId(event, `${callId}:call-ended`),
            "call-ended",
          );

          await db
            .update(callsTable)
            .set({
              status: "completed",
              durationSeconds: duration,
              endedAt: getDate(call?.endedAt) ?? null,
              transcript: encrypt(getString(call?.transcript)),
              summary: encrypt(getString(call?.summary)),
              resolved: true,
              resolutionType: "completed",
            })
            .where(eq(callsTable.vapiCallId, callId));

          const callRecord = await db
            .select({ agentId: callsTable.agentId })
            .from(callsTable)
            .where(eq(callsTable.vapiCallId, callId))
            .limit(1);

          if (callRecord[0]?.agentId) {
            await db
              .update(agentsTable)
              .set({
                totalMinutes: sql`${agentsTable.totalMinutes} + ${minutesUsed}`,
              })
              .where(eq(agentsTable.id, callRecord[0].agentId));
          }
          return res.json({ received: true });
        }

        case "function-call": {
          const functionCall = message?.functionCall as
            | Record<string, unknown>
            | undefined;
          logger.info(
            { functionCallName: getString(functionCall?.name) },
            "Tool call received",
          );
          return res.json({ result: "Tool endpoint handles this separately" });
        }

        default:
          return res.json({ received: true });
      }
    } catch (err) {
      logger.error({ err }, "Webhook error");
      return next(err);
    }
  },
);

export default router;
