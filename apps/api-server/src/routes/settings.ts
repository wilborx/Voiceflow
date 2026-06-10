import { Router, type Request, type Response, type NextFunction } from "express";
import { db, organizationsTable, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router = Router();

router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [org] = await db.select().from(organizationsTable).limit(1);
    res.json({
      ...org,
      vapiConfigured: !!process.env.VAPI_API_KEY,
      elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [org] = await db.select().from(organizationsTable).limit(1);

    if (!org) {
      const [newOrg] = await db
        .insert(organizationsTable)
        .values({
          name: req.body.name ?? "My Organization",
          slug: "default",
          ownerId: "unknown",
        })
        .returning();
      return res.json({
        ...newOrg,
        vapiConfigured: !!process.env.VAPI_API_KEY,
        elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
        googleCalendarConnected: false,
      });
    }

    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;
    if (parsed.data.language !== undefined) updates.language = parsed.data.language;

    const [updated] = await db
      .update(organizationsTable)
      .set(updates)
      .where(eq(organizationsTable.id, org.id))
      .returning();

    res.json({
      ...updated,
      vapiConfigured: !!process.env.VAPI_API_KEY,
      elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
      googleCalendarConnected: false,
    });
  } catch (err) {
    next(err);
  }
});

export default router;