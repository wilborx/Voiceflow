import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import callsRouter from "./calls";
import dashboardRouter from "./dashboard";
import billingRouter from "./billing";
import webhooksRouter from "./webhooks";
import toolsRouter from "./tools";
import integrationsRouter from "./integrations";
import settingsRouter from "./settings";
import agentConfigRouter from "./agent-config";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use("/healthz", healthRouter);
router.use("/webhooks", webhooksRouter);
router.use("/billing/webhook", billingRouter);
router.use("/integrations/google/auth", integrationsRouter);
router.use("/integrations/google/callback", integrationsRouter);
router.use("/integrations/google/status", integrationsRouter);

router.use(requireAuth());
router.use("/agents", agentsRouter);
router.use("/calls", callsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/billing", billingRouter);
router.use("/tools", toolsRouter);
router.use("/integrations", integrationsRouter);
router.use("/settings", settingsRouter);
router.use("/agent-config", agentConfigRouter);

export default router;
