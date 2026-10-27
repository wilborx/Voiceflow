import { NextResponse, type NextRequest } from "next/server";
import { runMaintenance } from "@/lib/booking/service";
import { env } from "@/lib/config";
import { log } from "@/lib/server/log";

/** Vercel Cron / externer Cron (alle 5–15 Min.): Authorization: Bearer $CRON_SECRET */
export async function GET(req: NextRequest) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runMaintenance({ force: true })) });
  } catch (err) {
    log.error("cron fehlgeschlagen", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
