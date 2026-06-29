import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendSMS } from "../lib/telnyx.js";
import {
  getAvailableSlots,
  createCalendarEvent,
} from "../lib/google-calendar.js";
import { logger } from "../lib/logger";
import { decryptGoogleTokens } from "./integrations";

const router = Router();

async function verifyVapiRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    const headerSecret = req.headers["x-vapi-secret"];

    if (process.env.NODE_ENV === "test" && !secret) {
      req.webhookVerified = true;
      next();
      return;
    }

    if (
      !secret ||
      typeof headerSecret !== "string" ||
      headerSecret !== secret
    ) {
      res
        .status(secret ? 401 : 503)
        .json({
          error: secret ? "Unauthorized" : "Vapi webhook secret not configured",
        });
      return;
    }

    req.webhookVerified = true;
    next();
  } catch (err) {
    return next(err);
  }
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

router.post(
  "/calendar/availability",
  verifyVapiRequest,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { date, agentId } = req.body as { date?: string; agentId?: string };

      if (!agentId) {
        const slots = generatePlaceholderSlots(date ?? "");
        return res.json({
          result: JSON.stringify({
            available: slots.length > 0,
            slots: slots.map((s) => ({
              datetime: s,
              label: formatGermanDateTime(s),
            })),
            note: "Demo-Slots (keine agentId)",
          }),
        });
      }

      const agent = await getOrgAgent(agentId, req.org?.ownerId ?? "");

      if (!agent) {
        logger.warn(
          { agentId, path: "/calendar/availability" },
          "Agent not found for tool request",
        );
        return res.json({
          result: JSON.stringify({
            available: false,
            slots: [],
            error: "Agent nicht gefunden",
          }),
        });
      }

      const { accessToken, refreshToken } = decryptGoogleTokens(agent);
      if (agent.googleCalendarConnected && accessToken && refreshToken) {
        const slots = await getAvailableSlots(
          accessToken,
          refreshToken,
          date ?? "",
        );

        return res.json({
          result: JSON.stringify({
            available: slots.length > 0,
            slots: slots.map((s) => ({
              datetime: s,
              label: formatGermanDateTime(s),
            })),
          }),
        });
      }

      const slots = generatePlaceholderSlots(date ?? "");
      return res.json({
        result: JSON.stringify({
          available: slots.length > 0,
          slots: slots.map((s) => ({
            datetime: s,
            label: formatGermanDateTime(s),
          })),
          message:
            slots.length > 0
              ? `Ich habe ${slots.length} freie Termine gefunden.`
              : "Leider sind für dieses Datum keine Termine verfügbar.",
          note: "Kalender nicht verbunden — Demo-Slots",
        }),
      });
    } catch (err) {
      logger.error({ err }, "Calendar availability error");
      return res.json({
        result: JSON.stringify({
          available: false,
          slots: [],
          error: "Kalender-Fehler",
        }),
      });
    }
  },
);

router.post(
  "/calendar/book",
  verifyVapiRequest,
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { customerName, customerPhone, service, datetime, agentId } =
        req.body as {
          customerName?: string;
          customerPhone?: string;
          service?: string;
          datetime?: string;
          agentId?: string;
        };

      const confirmationNumber = Math.random()
        .toString(36)
        .slice(-6)
        .toUpperCase();
      let calendarBooked = false;

      if (agentId && customerPhone && service && datetime) {
        const agent = await getOrgAgent(agentId, req.org?.ownerId ?? "");

        if (agent) {
          const { accessToken, refreshToken } = decryptGoogleTokens(agent);
          if (agent.googleCalendarConnected && accessToken && refreshToken) {
            await createCalendarEvent(accessToken, refreshToken, {
              summary: service,
              datetime,
              durationMinutes: 60,
              customerName: customerName ?? "",
              customerPhone,
            });
            calendarBooked = true;
          }
        }
      }

      if (customerPhone && service && datetime) {
        const formattedDate = formatGermanDateTime(datetime);
        const smsText = `✓ Ihr Termin für ${service} am ${formattedDate} wurde bestätigt. Bestätigungs-Nr.: ${confirmationNumber}`;
        await sendSMS(customerPhone, smsText);
      }

      return res.json({
        result: JSON.stringify({
          success: true,
          confirmationNumber,
          calendarBooked,
          message:
            customerPhone && service && datetime
              ? `Termin erfolgreich gebucht für ${formatGermanDateTime(datetime)}. Eine Bestätigung wurde an ${customerPhone} gesendet.`
              : "Termin bestätigt.",
        }),
      });
    } catch (err) {
      logger.error({ err }, "Calendar book error");
      return res.json({
        result: JSON.stringify({
          success: false,
          error: "Buchung fehlgeschlagen, bitte erneut versuchen.",
        }),
      });
    }
  },
);

router.post("/transfer", verifyVapiRequest, (_req: Request, res: Response) => {
  res.json({
    result:
      "Ich verbinde Sie jetzt mit einem Mitarbeiter. Bitte bleiben Sie in der Leitung.",
  });
});

function generatePlaceholderSlots(date: string): string[] {
  const slots: string[] = [];
  const baseDate = new Date(date + "T00:00:00+02:00");

  if (isNaN(baseDate.getTime())) return [];

  const hours = [9, 10, 11, 14, 15, 16];
  for (const hour of hours) {
    const slot = new Date(baseDate);
    slot.setHours(hour, 0, 0, 0);
    if (slot > new Date()) {
      slots.push(slot.toISOString());
    }
  }

  return slots.slice(0, 3);
}

function formatGermanDateTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export default router;
