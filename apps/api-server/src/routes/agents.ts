import { Router, type Request, type Response, type NextFunction } from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createVapiAssistant, deleteVapiAssistant, updateVapiAssistant } from "../lib/vapi.js";
import { purchaseGermanPhoneNumber, releasePhoneNumber } from "../lib/telnyx.js";
import {
  CreateAgentBody,
  UpdateAgentBody,
  GetAgentParams,
  UpdateAgentParams,
  DeleteAgentParams,
  ActivateAgentParams,
  DeactivateAgentParams,
} from "@workspace/api-zod";

const router = Router();

const SYSTEM_PROMPT_TEMPLATES: Record<string, string> = {
  booking: `Du bist eine freundliche KI-Telefonassistentin. Dein Name ist Lena.

AUFGABE:
Nimm Terminanfragen entgegen und buche Termine direkt ins Kalendersystem.

GESPRÄCHSFÜHRUNG:
- Sprich immer Deutsch, professionell und warmherzig
- Halte Antworten kurz (max. 2 Sätze)
- Frage nur EINE Sache auf einmal
- Bestätige wichtige Angaben durch Wiederholen

PFLICHTINFORMATIONEN für eine Buchung:
1. Gewünschte Behandlung/Service
2. Wunschdatum und -uhrzeit
3. Vollständiger Name des Kunden
4. Rückrufnummer für Bestätigung`,
  advisory: `Du bist eine professionelle KI-Beratungsassistentin.

AUFGABE:
Beantworten Fragen, qualifiziere Leads und leite komplexe Anfragen weiter.

GESPRÄCHSFÜHRUNG:
- Professionell, kompetent und vertrauenswürdig
- Stelle klärende Fragen um den Bedarf zu verstehen
- Halte Antworten präzise und informativ`,
  hr_screening: `Du bist eine KI-Assistentin für HR-Erstgespräche.

AUFGABE:
Führe strukturierte Erstgespräche mit Kandidaten und sammle relevante Informationen.

GESPRÄCHSFÜHRUNG:
- Freundlich und professionell
- Stelle eine Frage nach der anderen
- Bestätige und fasse Antworten zusammen`,
  hr_onboarding: `Du bist eine digitale Onboarding-Assistentin.

AUFGABE:
Beantworte Fragen neuer Mitarbeiter zu Einarbeitung, Tools und Abläufen.

GESPRÄCHSFÜHRUNG:
- Hilfsbereit und geduldig
- Erkläre Prozesse klar und verständlich
- Verweise bei komplexen Fragen an die HR-Abteilung`,
};

function mapAgent(agent: typeof agentsTable.$inferSelect) {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    status: agent.status,
    phoneNumber: agent.phoneNumber,
    voiceId: agent.voiceId,
    voiceName: agent.voiceName,
    language: agent.language,
    systemPrompt: agent.systemPrompt,
    businessName: agent.businessName,
    businessHoursOpen: agent.businessHoursOpen,
    businessHoursClose: agent.businessHoursClose,
    timezone: agent.timezone,
    totalCalls: agent.totalCalls,
    totalMinutes: Number(agent.totalMinutes),
    resolutionRate: Number(agent.resolutionRate),
    vapiAssistantId: agent.vapiAssistantId,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

// GET /api/agents
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const agents = await db.select().from(agentsTable).orderBy(agentsTable.createdAt);
    res.json(agents.map(mapAgent));
  } catch (err) {
    console.error("GET /api/agents error:", err);
    next(err);
  }
});

// POST /api/agents
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = CreateAgentBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const body = parsed.data;
    const systemPrompt = body.systemPrompt || SYSTEM_PROMPT_TEMPLATES[body.type] || "";

    const [agent] = await db.insert(agentsTable).values({
      name: body.name,
      type: body.type as "booking" | "advisory" | "hr_screening" | "hr_onboarding",
      systemPrompt,
      language: body.language ?? "de",
      timezone: body.timezone ?? "Europe/Berlin",
      businessName: body.businessName ?? null,
      businessHoursOpen: body.businessHoursOpen ?? null,
      businessHoursClose: body.businessHoursClose ?? null,
      voiceId: body.voiceId ?? null,
      voiceName: body.voiceName ?? null,
    }).returning();

    if (process.env.VAPI_API_KEY) {
      try {
        const vapiAssistant = await createVapiAssistant({
          name: body.name,
          type: body.type as "booking" | "advisory" | "hr_screening" | "hr_onboarding",
          systemPrompt,
          voiceId: body.voiceId,
          language: body.language ?? "de",
          businessName: body.businessName,
        });

        console.log("Vapi assistant created:", vapiAssistant.id);

        let phoneNumber: string | null = null;
        if (process.env.TELNYX_API_KEY) {
          phoneNumber = await purchaseGermanPhoneNumber();
        }

        const [updatedAgent] = await db
          .update(agentsTable)
          .set({
            vapiAssistantId: vapiAssistant.id,
            phoneNumber: phoneNumber ?? null,
            updatedAt: new Date(),
          })
          .where(eq(agentsTable.id, agent.id))
          .returning();

        return res.status(201).json(mapAgent(updatedAgent));
      } catch (vapiErr) {
        console.error("Vapi assistant creation failed, agent saved without Vapi ID:", vapiErr);
      }
    }

    res.status(201).json(mapAgent(agent));
  } catch (err) {
    console.error("POST /api/agents error:", err);
    next(err);
  }
});

// GET /api/agents/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = GetAgentParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, parsed.data.id));
    if (!agent) return res.status(404).json({ error: "Not found" });
    res.json(mapAgent(agent));
  } catch (err) {
    console.error("GET /api/agents/:id error:", err);
    next(err);
  }
});

// PATCH /api/agents/:id
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramsParsed = UpdateAgentParams.safeParse(req.params);
    if (!paramsParsed.success) return res.status(400).json({ error: "Invalid ID" });

    const bodyParsed = UpdateAgentBody.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json({ error: bodyParsed.error.message });

    const body = bodyParsed.data;
    const updates: Partial<typeof agentsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.status !== undefined) updates.status = body.status as "active" | "inactive" | "draft";
    if (body.businessName !== undefined) updates.businessName = body.businessName ?? null;
    if (body.businessHoursOpen !== undefined) updates.businessHoursOpen = body.businessHoursOpen ?? null;
    if (body.businessHoursClose !== undefined) updates.businessHoursClose = body.businessHoursClose ?? null;
    if (body.voiceId !== undefined) updates.voiceId = body.voiceId ?? null;
    if (body.voiceName !== undefined) updates.voiceName = body.voiceName ?? null;
    if (body.language !== undefined) updates.language = body.language ?? "de";
    if (body.systemPrompt !== undefined) updates.systemPrompt = body.systemPrompt;

    const [agent] = await db
      .update(agentsTable)
      .set(updates)
      .where(eq(agentsTable.id, paramsParsed.data.id))
      .returning();
    if (!agent) return res.status(404).json({ error: "Not found" });

    if (agent.vapiAssistantId && process.env.VAPI_API_KEY) {
      try {
        await updateVapiAssistant(agent.vapiAssistantId, {
          name: body.name,
          voiceId: body.voiceId,
          language: body.language,
          systemPrompt: body.systemPrompt,
        });
      } catch (err) {
        console.error("Vapi update failed (non-fatal):", err);
      }
    }

    res.json(mapAgent(agent));
  } catch (err) {
    console.error("PATCH /api/agents/:id error:", err);
    next(err);
  }
});

// POST /api/agents/:id/sync-vapi
router.post("/:id/sync-vapi", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ActivateAgentParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, parsed.data.id));
    if (!agent) return res.status(404).json({ error: "Not found" });
    if (!agent.vapiAssistantId) return res.status(400).json({ error: "No Vapi assistant linked" });

    await updateVapiAssistant(agent.vapiAssistantId, {
      voiceId: agent.voiceId ?? "nova",
      language: agent.language ?? "de",
    });

    res.json({ ok: true, vapiAssistantId: agent.vapiAssistantId });
  } catch (err) {
    console.error("POST /api/agents/:id/sync-vapi error:", err);
    next(err);
  }
});

// DELETE /api/agents/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = DeleteAgentParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, parsed.data.id));

    if (agent?.vapiAssistantId) {
      await deleteVapiAssistant(agent.vapiAssistantId);
    }
    if (agent?.phoneNumber) {
      await releasePhoneNumber(agent.phoneNumber);
    }

    await db.delete(agentsTable).where(eq(agentsTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/agents/:id error:", err);
    next(err);
  }
});

// POST /api/agents/:id/activate
router.post("/:id/activate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ActivateAgentParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

    const [agent] = await db
      .update(agentsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(agentsTable.id, parsed.data.id))
      .returning();
    if (!agent) return res.status(404).json({ error: "Not found" });
    res.json(mapAgent(agent));
  } catch (err) {
    console.error("POST /api/agents/:id/activate error:", err);
    next(err);
  }
});

// POST /api/agents/:id/deactivate
router.post("/:id/deactivate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = DeactivateAgentParams.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

    const [agent] = await db
      .update(agentsTable)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(eq(agentsTable.id, parsed.data.id))
      .returning();
    if (!agent) return res.status(404).json({ error: "Not found" });
    res.json(mapAgent(agent));
  } catch (err) {
    console.error("POST /api/agents/:id/deactivate error:", err);
    next(err);
  }
});

export default router;