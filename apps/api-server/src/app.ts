import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkSetup } from "./middlewares/auth";
import { logger } from "./lib/logger";
import router from "./routes";

const app: Express = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL]
      : ["http://localhost:5173"],
    credentials: true,
  })
);

// Stripe Webhook braucht raw body -- vor JSON-Parser
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

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
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkSetup);

app.use("/api", router);

export default app;
