import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { sql } from "@/lib/db/client";
import { audit, getCustomer } from "@/lib/db/queries";

/** Datenauskunft nach Art. 15 DSGVO als JSON */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const bookings = await sql(
    `select b.id, o.name as offering, b.status, b.starts_at, b.ends_at, b.goal, b.health_notes, b.message,
            b.preferred_channel, b.utm, b.created_at, b.cancelled_at
       from bookings b join offerings o on o.id = b.offering_id where b.customer_id = $1 order by b.starts_at`,
    [id],
  );
  const messages = await sql("select channel, template, status, created_at from messages_log where customer_id = $1 order by created_at", [id]);
  const waitlist = await sql("select occurrence_id, status, created_at from waitlist_entries where customer_id = $1", [id]);
  await audit("export_customer", "customers", id);
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), customer, bookings, waitlist, messages }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="datenauskunft-${id}.json"`, "Cache-Control": "no-store" },
  });
}
