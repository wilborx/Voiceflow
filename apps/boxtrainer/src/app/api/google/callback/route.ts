import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getAdmin } from "@/lib/auth";
import { env } from "@/lib/config";
import { googleExchangeCode } from "@/lib/google";
import { log } from "@/lib/server/log";

export async function GET(req: NextRequest) {
  const target = new URL("/admin/einstellungen#integrationen", env.appUrl);
  const jar = await cookies();
  const state = jar.get("bt_oauth_state")?.value;
  jar.delete("bt_oauth_state");
  const code = req.nextUrl.searchParams.get("code");
  if (!(await getAdmin()) || !code || !state || state !== req.nextUrl.searchParams.get("state")) {
    target.searchParams.set("google", "fehler");
    return NextResponse.redirect(target);
  }
  try {
    await googleExchangeCode(code);
    target.searchParams.set("google", "verbunden");
  } catch (err) {
    log.error("google oauth fehlgeschlagen", err);
    target.searchParams.set("google", "fehler");
  }
  return NextResponse.redirect(target);
}
