import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import callsRouter from "./calls";
import dashboardRouter from "./dashboard";
import billingRouter from "./billing";
import webhooksRouter from "./webhooks";
import toolsRouter from "./tools";
import integrationsRouter from "./integrations";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/webhooks", webhooksRouter);
router.use("/billing/webhook", billingRouter);

router.use("/agents", agentsRouter);
router.use("/calls", callsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/billing", billingRouter);
router.use("/tools", toolsRouter);
router.use("/integrations", integrationsRouter);

export default router;
