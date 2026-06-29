import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkSetup } from "./middlewares/auth";
import { errorHandler } from "./middlewares/errorHandler";
import { logger } from "./lib/logger";
import { rateLimitMiddleware } from "./middlewares/rateLimit";
import {
  verifyStripeWebhookSignature,
  verifyVapiWebhookSignature,
} from "./lib/webhook-signatures";
import router from "./routes";
import { db, callsTable, agentsTable, organizationsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const app: Express = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

if (process.env.NODE_ENV === "production") {
  app.use(
    helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    }),
  );
}

app.use(
  cors({
    origin: process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL]
      : ["http://localhost:5173"],
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "req.body.email",
        "req.body.callerNumber",
        "req.body.transcript",
        "req.body.summary",
      ],
      censor: "[REDACTED]",
    },
  }),
);

app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/webhooks/vapi", verifyVapiWebhookSignature);
app.use("/api/billing/webhook", verifyStripeWebhookSignature);
app.use(rateLimitMiddleware);
app.use(clerkSetup);

app.use("/api", router);

app.use(errorHandler);

const RECURRING_JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function runRetentionJob() {
  try {
    const result = await db
      .delete(callsTable)
      .where(
        sql`${callsTable.deletedAt} IS NULL AND ${callsTable.createdAt} < now() - (
        SELECT ${organizationsTable.dataRetentionDays} * interval '1 day'
        FROM ${agentsTable}
        JOIN ${organizationsTable} ON ${organizationsTable.id} = ${agentsTable.ownerId}
        WHERE ${agentsTable.id} = ${callsTable.agentId}
        LIMIT 1
      )`,
      )
      .returning({ id: callsTable.id });

    if (result.length > 0) {
      void logger.info(
        { count: result.length },
        "Retention job deleted expired calls",
      );
    }
  } catch (err) {
    void logger.error({ err }, "Retention job failed");
  }
}

setInterval(() => {
  void runRetentionJob();
}, RECURRING_JOB_INTERVAL_MS).unref?.();
void runRetentionJob();

export default app;
