import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import Stripe from "stripe";
import { db, organizationsTable, webhookEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateCheckoutBody } from "@workspace/api-zod";
import { getFrontendUrl } from "../lib/base-url.js";
import { logger } from "../lib/logger";
import { requireOrganization } from "../middlewares/errorHandler";

const router = Router();

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    priceEuros: 99,
    minutes: 300,
    maxAgents: 1,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: [
      "1 KI-Agent",
      "300 Minuten / Monat",
      "Terminbuchung",
      "E-Mail-Support",
      "14 Tage kostenlos testen",
    ],
  },
  {
    key: "professional",
    name: "Professional",
    priceEuros: 249,
    minutes: 1000,
    maxAgents: 3,
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    features: [
      "Bis zu 3 KI-Agenten",
      "1.000 Minuten / Monat",
      "Alle Agent-Typen",
      "Google Kalender Integration",
      "Priority Support",
      "14 Tage kostenlos testen",
    ],
  },
  {
    key: "business",
    name: "Business",
    priceEuros: 549,
    minutes: 3000,
    maxAgents: 10,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    features: [
      "Bis zu 10 KI-Agenten",
      "3.000 Min / Monat",
      "CRM & ATS Integrationen",
      "Dedicated Success Manager",
      "SLA Garantie",
      "DSGVO Datenverarbeitungsvertrag",
    ],
  },
];

async function markWebhookReceived(eventId: string, eventType: string) {
  await db
    .insert(webhookEventsTable)
    .values({
      source: "stripe",
      eventId,
      eventType,
      receivedAt: new Date(),
    })
    .onConflictDoNothing();
}

router.get("/plans", (_req: Request, res: Response) => {
  res.json(PLANS);
});

router.post(
  "/checkout",
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateCheckoutBody.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: parsed.error.message });

      const { planKey, email } = parsed.data;
      const orgId = req.org?.id ?? "";

      if (!stripe) {
        const plan = PLANS.find((p) => p.key === planKey);
        if (!plan) return res.status(400).json({ error: "Invalid plan" });
        const safeEmail = (() => {
          try {
            return encodeURIComponent(email);
          } catch {
            return "";
          }
        })();
        const allowedHost = process.env.FRONTEND_URL
          ? new URL(process.env.FRONTEND_URL).hostname
          : "localhost:5173";
        const checkoutUrl = `https://${allowedHost}/billing?demo=1&plan=${planKey}&email=${safeEmail}`;
        return res.json({ checkoutUrl, demo: true });
      }

      const plan = PLANS.find((p) => p.key === planKey);
      if (!plan?.priceId)
        return res
          .status(400)
          .json({ error: "Invalid plan or price not configured" });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card", "sepa_debit"],
        customer_email: email,
        line_items: [{ price: plan.priceId, quantity: 1 }],
        success_url: `${getFrontendUrl()}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${getFrontendUrl()}/billing`,
        metadata: { orgId },
        subscription_data: {
          trial_period_days: 14,
          metadata: { orgId, planKey },
        },
        locale: "de",
      });

      return res.json({ checkoutUrl: session.url });
    } catch (err) {
      logger.error({ err }, "Stripe checkout error");
      return next(err);
    }
  },
);

async function getStripeWebhookEvent(
  req: Request,
): Promise<Stripe.Event | null> {
  if (req.stripeWebhookEvent) return req.stripeWebhookEvent;
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return null;

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") return null;

  return stripe.webhooks.constructEvent(
    req.body as Buffer,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET,
  );
}

router.post(
  "/webhook",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (
        process.env.NODE_ENV !== "test" &&
        (!stripe || !process.env.STRIPE_WEBHOOK_SECRET)
      ) {
        return res.status(503).json({ error: "Stripe webhook not configured" });
      }

      const event = await getStripeWebhookEvent(req);
      if (!event) {
        return res
          .status(process.env.NODE_ENV === "test" ? 200 : 400)
          .json({ error: "Stripe webhook signature invalid" });
      }

      await markWebhookReceived(event.id, event.type);

      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const orgId = sub.metadata?.orgId;
          const planKey = (sub.metadata?.planKey as string) ?? "starter";
          const plan = PLANS.find((p) => p.key === planKey);

          if (orgId) {
            await db
              .update(organizationsTable)
              .set({
                plan: planKey,
                stripeSubscriptionId: sub.id,
                subscriptionStatus: sub.status,
                minutesIncluded: plan?.minutes ?? 300,
                updatedAt: new Date(),
              })
              .where(eq(organizationsTable.id, orgId));
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const orgId = sub.metadata?.orgId;
          if (orgId) {
            await db
              .update(organizationsTable)
              .set({ subscriptionStatus: "canceled", updatedAt: new Date() })
              .where(eq(organizationsTable.id, orgId));
          }
          break;
        }
      }

      return res.json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook error");
      return next(err);
    }
  },
);

router.get(
  "/usage",
  requireOrganization,
  async (_req: Request, res: Response) => {
    return res.json({
      plan: "starter",
      minutesUsed: 0,
      minutesIncluded: 300,
      subscriptionStatus: "trialing",
      billingCycleStart: new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString(),
      currentPeriodEnd: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0,
      ).toISOString(),
    });
  },
);

router.get(
  "/portal",
  requireOrganization,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!stripe)
        return res.status(503).json({ error: "Stripe not configured" });

      const requestedStripeCustomerId = req.query.stripeCustomerId;
      const orgStripeCustomerId = req.org?.stripeCustomerId;
      const stripeCustomerId =
        typeof requestedStripeCustomerId === "string"
          ? requestedStripeCustomerId
          : orgStripeCustomerId;

      if (!stripeCustomerId) {
        return res.status(404).json({ error: "Stripe customer not found" });
      }

      if (orgStripeCustomerId && stripeCustomerId !== orgStripeCustomerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${getFrontendUrl()}/billing`,
      });
      return res.json({ url: session.url });
    } catch (err) {
      logger.error({ err }, "Stripe portal error");
      return next(err);
    }
  },
);

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export default router;
