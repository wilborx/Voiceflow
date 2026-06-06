import { Router } from "express";
import { CreateCheckoutBody } from "@workspace/api-zod";

const router = Router();

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    priceEuros: 99,
    minutes: 300,
    maxAgents: 1,
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
    features: [
      "Bis zu 10 KI-Agenten",
      "3.000 Minuten / Monat",
      "CRM & ATS Integrationen",
      "Dedicated Success Manager",
      "SLA Garantie",
      "DSGVO Datenverarbeitungsvertrag",
    ],
  },
];

// GET /api/billing/plans
router.get("/plans", async (_req, res) => {
  res.json(PLANS);
});

// POST /api/billing/checkout
router.post("/checkout", async (req, res) => {
  const parsed = CreateCheckoutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const { planKey, email } = parsed.data;
  const plan = PLANS.find((p) => p.key === planKey);
  if (!plan) return res.status(400).json({ error: "Invalid plan" });

  // In production this would create a Stripe Checkout session
  // For now, return a placeholder URL
  const checkoutUrl = `https://checkout.stripe.com/pay/demo?plan=${planKey}&email=${encodeURIComponent(email)}`;

  res.json({ checkoutUrl });
});

// GET /api/billing/usage
router.get("/usage", async (_req, res) => {
  // In production this would look up the org's subscription from DB/Stripe
  res.json({
    plan: "starter",
    minutesUsed: 47,
    minutesIncluded: 300,
    subscriptionStatus: "trialing",
    billingCycleStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    currentPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
  });
});

export default router;
