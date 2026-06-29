import type { Request, Response, NextFunction } from "express";
import { db, auditLogsTable } from "@workspace/db";
import type { InsertAuditLog } from "@workspace/db";

type AuditAction = InsertAuditLog["action"];

export async function recordAudit(
  req: Request,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
) {
  const userId = req.userId ?? req.user?.userId;
  const orgId = req.org?.id;

  if (!orgId) {
    return;
  }

  const log: InsertAuditLog = {
    orgId,
    userId,
    action,
    resourceType,
    resourceId,
    ipAddress: req.ip ?? undefined,
    userAgent: req.get("user-agent") ?? undefined,
    metadata,
  };

  await db.insert(auditLogsTable).values(log as any);
}

export function auditAccess(
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await recordAudit(req, action, resourceType, resourceId, metadata);
      next();
    } catch (err) {
      next(err);
    }
  };
}
