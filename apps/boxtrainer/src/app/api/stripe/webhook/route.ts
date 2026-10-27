import { NextResponse, type NextRequest } from "next/server";
import { handleStripeWebhook } from "@/lib/payments";
import { log } from "@/lib/server/log";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });
  try {
    await handleStripeWebhook(await req.text(), signature);
    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("stripe webhook fehlgeschlagen", err);
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
}
