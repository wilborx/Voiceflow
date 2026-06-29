import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db, auditLogsTable } from "@workspace/db";
import type { InferSelectModel } from "drizzle-orm";
import { desc, eq } from "drizzle-orm";
import { requireOrganization } from "../middlewares/errorHandler";

const router = Router();

function mapAuditLog(log: InferSelectModel<typeof auditLogsTable>) {
  return {
    ...log,
    createdAt: log.createdAt.toISOString(),
  };
}

router.get(
  "/logs",
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 100), 500);
      const logs = await db
        .select()
        .from(auditLogsTable)
        .where(eq(auditLogsTable.orgId, req.org?.id ?? ""))
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(Number.isFinite(limit) ? limit : 100);

      return res.json(logs.map(mapAuditLog));
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
