import { NextResponse, type NextRequest } from "next/server";
import { getEventSlots, getSingleSlots } from "@/lib/booking/slots";
import { runMaintenance } from "@/lib/booking/service";
import { getOfferingBySlug } from "@/lib/db/queries";
import { log } from "@/lib/server/log";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/availability?offering=slug&from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const slug = p.get("offering") ?? "";
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to) || to < from) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }
  const offering = await getOfferingBySlug(slug);
  if (!offering) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await runMaintenance(); // gibt abgelaufene Holds frei (gedrosselt)
    if (offering.capacity > 1) {
      const events = await getEventSlots(offering, from, to);
      return NextResponse.json({ kind: "events", events: events.map((e) => ({ ...e, start: new Date(e.start).toISOString(), end: new Date(e.end).toISOString() })) });
    }
    const slots = await getSingleSlots(offering, from, to);
    return NextResponse.json(
      { kind: "slots", slots: slots.map((s) => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString() })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    log.error("availability fehlgeschlagen", err, { offering: slug });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
