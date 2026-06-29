import type { NextFunction, Request, Response } from "express";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export function verifyVapiWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  const headerSecret = req.headers["x-vapi-secret"];

  if (process.env.NODE_ENV === "test" && !secret) {
    req.webhookVerified = true;
    next();
    return;
  }

  if (!secret || typeof headerSecret !== "string" || headerSecret !== secret) {
    res
      .status(secret ? 401 : 503)
      .json({
        error: secret ? "Unauthorized" : "Vapi webhook secret not configured",
      });
    return;
  }

  req.webhookVerified = true;
  next();
}

export async function verifyStripeWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (process.env.NODE_ENV === "test" && !process.env.STRIPE_WEBHOOK_SECRET) {
    req.webhookVerified = true;
    next();
    return;
  }

  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: "Stripe webhook not configured" });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    res.status(400).json({ error: "stripe-signature header required" });
    return;
  }

  try {
    req.stripeWebhookEvent = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    req.webhookVerified = true;
    next();
  } catch {
    res.status(400).json({ error: "Invalid Stripe webhook signature" });
  }
}
