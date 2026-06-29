import { type Request, type Response, type NextFunction } from "express";
import { db, organizationsTable, agentsTable, callsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: unknown,
  ) {
    super(message, { cause: details });
    this.name = "HttpError";
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

export function unauthorized(message = "Unauthorized"): never {
  throw new HttpError(401, message);
}

export function forbidden(message = "Forbidden"): never {
  throw new HttpError(403, message);
}

export function notFound(message: string): never {
  throw new HttpError(404, message);
}

export function internalError(
  message = "Internal server error",
  cause?: unknown,
): never {
  throw new HttpError(500, message, cause);
}

function serializeError(error: unknown) {
  if (error instanceof HttpError) {
    return {
      error: error.message,
      ...(process.env.NODE_ENV !== "production" && error.details !== undefined
        ? { details: error.details }
        : {}),
    };
  }

  const zodError = error as {
    issues?: Array<{ path: unknown[]; message: string }>;
  } | null;
  if (zodError?.issues && Array.isArray(zodError.issues)) {
    return {
      error: "Validation failed",
      details: zodError.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }

  return {
    error: "Internal server error",
    ...(process.env.NODE_ENV !== "production" && error instanceof Error
      ? { message: error.message }
      : {}),
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.id as string | undefined;

  if (err instanceof HttpError) {
    logger.warn(
      {
        error: err.message,
        req: {
          id: requestId,
          method: req.method,
          url: req.url?.split("?")[0],
        },
      },
      err.message,
    );

    return res.status(err.statusCode).json(serializeError(err));
  }

  logger.error(
    {
      error: err,
      req: {
        id: requestId,
        method: req.method,
        url: req.url?.split("?")[0],
      },
    },
    "Unhandled error",
  );

  return res.status(500).json(serializeError(err));
}

export async function getCurrentOrganization(userId: string) {
  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.ownerId, userId))
    .limit(1);

  return org ?? null;
}

export async function requireOrganization(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      unauthorized("Authentication required");
    }

    const org = await getCurrentOrganization(userId);
    if (!org) {
      forbidden("No organization found for this user");
    }

    (req as unknown as { org: typeof org }).org = org;
    (req as unknown as { userId: string }).userId = userId;
    next();
  } catch (err) {
    if (err instanceof HttpError) {
      next(err);
      return;
    }
    logger.error({ err }, "requireOrganization failed");
    internalError("Failed to resolve organization", err);
  }
}

export function requireOrgResource(
  resource:
    | "agents"
    | "calls"
    | "billing"
    | "dashboard"
    | "integrations"
    | "tools"
    | "settings",
  idField = "id",
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const org = (req as unknown as { org?: { id: string } }).org;
      if (!org) {
        forbidden("Organization context required");
      }

      const resourceId = req.params[idField] as string | undefined;
      if (!resourceId) {
        badRequest(`${idField} parameter required`);
      }

      if (resource === "calls") {
        const rows = await db
          .select({
            agentOwnerId: agentsTable.ownerId,
          })
          .from(callsTable)
          .leftJoin(agentsTable, eq(callsTable.agentId, agentsTable.id))
          .where(eq(callsTable.id, resourceId))
          .limit(1);

        const row = rows[0];
        if (!row) {
          notFound("Resource not found");
        }
        if (
          row.agentOwnerId !==
          (req as unknown as { user?: { userId: string } }).user?.userId
        ) {
          forbidden("Access denied");
        }
        next();
        return;
      }

      if (resource === "agents") {
        const [record] = await db
          .select({ ownerId: agentsTable.ownerId })
          .from(agentsTable)
          .where(eq(agentsTable.id, resourceId))
          .limit(1);

        if (!record) {
          notFound("Resource not found");
        }
        if (
          record.ownerId !==
          (req as unknown as { user?: { userId: string } }).user?.userId
        ) {
          forbidden("Access denied");
        }
        next();
        return;
      }

      forbidden(
        `Resource type "${resource}" not supported for ownership checks`,
      );
    } catch (err) {
      if (err instanceof HttpError) {
        next(err);
        return;
      }
      logger.error({ err, resource, idField }, "requireOrgResource failed");
      internalError("Failed to verify resource ownership", err);
    }
  };
}

export function requireOrgIdGuard(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const org = (req as unknown as { org?: { id: string } }).org;
  if (!org) {
    forbidden("Organization context required");
  }
  next();
}
