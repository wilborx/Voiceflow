import { Router, type Request, type Response, type NextFunction } from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendSMS } from "../lib/telnyx.js";
import { getAvailableSlots, createCalendarEvent } from "../lib/google-calendar.js";

const router = Router();

router.post("/calendar/availability", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, agentId } = req.body as { date?: string; agentId?: string };

    if (agentId) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));

      if (agent?.googleCalendarConnected && agent.googleCalendarAccessToken && agent.googleCalendarRefreshToken) {
        const slots = await getAvailableSlots(
          agent.googleCalendarAccessToken,
          agent.googleCalendarRefreshToken,
          date ?? ""
        );

        return res.json({
          result: JSON.stringify({
            available: slots.length > 0,
            slots: slots.map((s) => ({ datetime: s, label: formatGermanDateTime(s) })),
          }),
        });
      }
    }

    const slots = generatePlaceholderSlots(date ?? "");
    res.json({
      result: JSON.stringify({
        available: slots.length > 0,
        slots: slots.map((s) => ({
          datetime: s,
          label: formatGermanDateTime(s),
        })),
        message: slots.length > 0
          ? `Ich habe ${slots.length} freie Termine gefunden.`
          : "Leider sind für dieses Datum keine Termine verfügbar.",
        note: "Kalender nicht verbunden — Demo-Slots",
      }),
    });
  } catch (err) {
    console.error("Calendar availability error:", err);
    res.json({ result: JSON.stringify({ available: false, slots: [], error: "Kalender-Fehler" }) });
  }
});

router.post("/calendar/book", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerName, customerPhone, service, datetime, agentId } = req.body as {
      customerName?: string;
      customerPhone?: string;
      service?: string;
      datetime?: string;
      agentId?: string;
    };

    const confirmationNumber = Math.random().toString(36).slice(-6).toUpperCase();

    if (agentId && customerPhone && service && datetime) {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));

      if (agent?.googleCalendarConnected && agent.googleCalendarAccessToken && agent.googleCalendarRefreshToken) {
        await createCalendarEvent(
          agent.googleCalendarAccessToken,
          agent.googleCalendarRefreshToken,
          {
            summary: service,
            datetime,
            durationMinutes: 60,
            customerName: customerName ?? "",
            customerPhone,
          }
        );
      }
    }

    if (customerPhone && service && datetime) {
      const formattedDate = formatGermanDateTime(datetime);
      const smsText = `✓ Ihr Termin für ${service} am ${formattedDate} wurde bestätigt. Bestätigungs-Nr.: ${confirmationNumber}`;
      await sendSMS(customerPhone, smsText);
    }

    res.json({
      result: JSON.stringify({
        success: true,
        confirmationNumber,
        message: customerPhone && service && datetime
          ? `Termin erfolgreich gebucht für ${formatGermanDateTime(datetime)}. Eine Bestätigung wurde an ${customerPhone} gesendet.`
          : "Termin bestätigt.",
      }),
    });
  } catch (err) {
    console.error("Calendar book error:", err);
    res.json({
      result: JSON.stringify({
        success: false,
        error: "Buchung fehlgeschlagen, bitte erneut versuchen.",
      }),
    });
  }
});

router.post("/transfer", (_req: Request, res: Response) => {
  res.json({
    result: "Ich verbinde Sie jetzt mit einem Mitarbeiter. Bitte bleiben Sie in der Leitung.",
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