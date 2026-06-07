import { Router } from "express";
import Stripe from "stripe";
import { db, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getFrontendUrl } from "../lib/base-url.js";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any })
  : null;

const router = Router();

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    priceEuros: 99,
    minutes: 300,
    maxAgents: 1,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: ["1 KI-Agent", "300 Minuten / Monat", "Terminbuchung", "E-Mail-Support", "14 Tage kostenlos testen"],
  },
  {
    key: "professional",
    name: "Professional",
    priceEuros: 249,
    minutes: 1000,
    maxAgents: 3,
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    features: ["Bis zu 3 KI-Agenten", "1.000 Minuten / Monat", "Alle Agent-Typen", "Google Kalender Integration", "Priority Support", "14 Tage kostenlos testen"],
  },
  {
    key: "business",
    name: "Business",
    priceEuros: 549,
    minutes: 3000,
    maxAgents: 10,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    features: ["Bis zu 10 KI-Agenten", "3.000 Minuten / Monat", "CRM & ATS Integrationen", "Dedicated Success Manager", "SLA Garantie", "DSGVO Datenverarbeitungsvertrag"],
  },
];

router.get("/plans", (_req, res) => res.json(PLANS));

router.post("/checkout", async (req, res) => {
  if (!stripe) {
    const { planKey, email } = req.body;
    const plan = PLANS.find((p) => p.key === planKey);
    if (!plan) return res.status(400).json({ error: "Invalid plan" });
    const checkoutUrl = `https://checkout.stripe.com/pay/demo?plan=${planKey}&email=${encodeURIComponent(email ?? "")}`;
    return res.json({ checkoutUrl });
  }

  const { planKey, email, orgId } = req.body;
  if (!planKey || !email) return res.status(400).json({ error: "planKey and email required" });

  const plan = PLANS.find((p) => p.key === planKey);
  if (!plan?.priceId) return res.status(400).json({ error: "Invalid plan or price not configured" });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card", "sepa_debit"],
      customer_email: email,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${getFrontendUrl()}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getFrontendUrl()}/billing`,
      metadata: { orgId: orgId ?? "", planKey },
      subscription_data: {
        trial_period_days: 14,
        metadata: { orgId: orgId ?? "", planKey },
      },
      locale: "de",
    });

    res.json({ checkoutUrl: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/webhook", async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Stripe webhook not configured" });
  }

  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      const planKey = sub.metadata?.planKey ?? "starter";
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

  res.json({ received: true });
});

router.get("/usage", async (_req, res) => {
  res.json({
    plan: "starter",
    minutesUsed: 0,
    minutesIncluded: 300,
    subscriptionStatus: "trialing",
    billingCycleStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    currentPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
  });
});

router.get("/portal", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

  const { stripeCustomerId } = req.query;
  if (!stripeCustomerId || typeof stripeCustomerId !== "string") {
    return res.status(400).json({ error: "stripeCustomerId required" });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${getFrontendUrl()}/billing`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
