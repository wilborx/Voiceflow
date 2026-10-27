import { bookingIdFromToken, getBooking, icsFor } from "@/lib/booking/service";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const id = bookingIdFromToken((await params).token);
  const b = id ? await getBooking(id) : undefined;
  if (!b || !["pending", "confirmed"].includes(b.status)) return new Response("Nicht gefunden", { status: 404 });
  return new Response(icsFor(b), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="termin.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
