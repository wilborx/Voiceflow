import { NextResponse, type NextRequest } from "next/server";
import { BookingError, joinWaitlist, requestBooking } from "@/lib/booking/service";
import { log } from "@/lib/server/log";
import { rateLimit } from "@/lib/server/ratelimit";
import { BOOKING_ERRORS, bookingRequestSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    // Honeypot ausgefüllt → so tun, als hätte es geklappt (Bots lernen nichts)
    const raw = body as { website?: unknown } | null;
    if (raw && typeof raw.website === "string" && raw.website.length > 0) {
      return NextResponse.json({ ok: true, status: "pending" });
    }
    return NextResponse.json({ ok: false, error: "validation", issues: parsed.error.flatten() }, { status: 422 });
  }
  if (!(await rateLimit("booking", 5, 600))) {
    return NextResponse.json({ ok: false, error: "rate_limited", message: BOOKING_ERRORS.rate_limited }, { status: 429 });
  }
  try {
    if (parsed.data.mode === "waitlist") {
      await joinWaitlist(parsed.data);
      return NextResponse.json({ ok: true, status: "waitlist" });
    }
    const result = await requestBooking(parsed.data);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ ok: false, error: err.code, message: err.message }, { status: 409 });
    }
    log.error("buchung fehlgeschlagen", err);
    return NextResponse.json({ ok: false, error: "server_error", message: "Da ist etwas schiefgelaufen. Bitte versuche es später erneut." }, { status: 500 });
  }
}
