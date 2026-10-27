import "server-only";
import { env, integrations } from "./config";
import { sql } from "./db/client";
import type { BookingDetail, Settings } from "./db/types";
import { log } from "./server/log";

export function paymentsEnabled(s: Settings): boolean {
  return s.paymentMode !== "off" && integrations.stripe;
}

export function amountDue(priceCents: number | null, s: Settings): number | null {
  if (!priceCents || s.paymentMode === "off") return null;
  return s.paymentMode === "deposit" ? Math.round((priceCents * s.depositPercent) / 100) : priceCents;
}

async function stripe() {
  const { default: Stripe } = await import("stripe");
  return new Stripe(env.stripeSecretKey!);
}

/** Zahlungslink nach Bestätigung durch den Trainer (Anzahlung oder Vollzahlung). */
export async function createBookingCheckout(b: BookingDetail, s: Settings, returnUrl: string): Promise<string | null> {
  const amount = amountDue(b.offering.priceCents, s);
  if (!paymentsEnabled(s) || !amount) return null;
  try {
    const session = await (await stripe()).checkout.sessions.create({
      mode: "payment",
      customer_email: b.customer.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amount,
            product_data: { name: `${b.offering.name}${s.paymentMode === "deposit" ? " (Anzahlung)" : ""}` },
          },
        },
      ],
      metadata: { booking_id: b.id },
      success_url: `${returnUrl}?bezahlt=1`,
      cancel_url: returnUrl,
    });
    await sql("update bookings set payment_status = 'open', amount_due_cents = $2, stripe_checkout_id = $3 where id = $1", [b.id, amount, session.id]);
    return session.url;
  } catch (err) {
    log.error("stripe checkout fehlgeschlagen", err, { bookingId: b.id });
    return null;
  }
}

export async function createPackageCheckout(pkg: { id: string; name: string; priceCents: number }, email: string): Promise<string | null> {
  if (!integrations.stripe) return null;
  const session = await (await stripe()).checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: pkg.priceCents, product_data: { name: pkg.name } } }],
    metadata: { package_id: pkg.id },
    success_url: `${env.appUrl}/pakete?gekauft=1`,
    cancel_url: `${env.appUrl}/pakete`,
  });
  return session.url;
}

export async function handleStripeWebhook(rawBody: string, signature: string): Promise<void> {
  const client = await stripe();
  const event = client.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret ?? "");
  if (event.type !== "checkout.session.completed") return;
  const session = event.data.object;
  const bookingId = session.metadata?.booking_id;
  const packageId = session.metadata?.package_id;
  if (bookingId) {
    await sql("update bookings set payment_status = 'paid' where id = $1", [bookingId]);
  }
  if (packageId && session.customer_details?.email) {
    const email = session.customer_details.email.toLowerCase();
    await sql(
      `insert into customers (email, name) values ($1, $2) on conflict (email) do nothing`,
      [email, session.customer_details.name ?? email],
    );
    await sql(
      `insert into customer_packages (customer_id, package_id, credits_total, expires_at, stripe_payment_intent_id)
       select c.id, p.id, p.credits, case when p.valid_days is null then null else now() + make_interval(days => p.valid_days) end, $3
         from customers c, packages p where c.email = $1 and p.id = $2`,
      [email, packageId, typeof session.payment_intent === "string" ? session.payment_intent : null],
    );
  }
}
