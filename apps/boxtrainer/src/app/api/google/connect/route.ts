import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { integrations } from "@/lib/config";
import { googleAuthUrl } from "@/lib/google";
import { newToken } from "@/lib/server/crypto";

export async function GET() {
  if (!(await getAdmin())) return NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  if (!integrations.google) return NextResponse.json({ error: "GOOGLE_CLIENT_ID/SECRET fehlen" }, { status: 400 });
  const state = newToken();
  (await cookies()).set("bt_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return NextResponse.redirect(googleAuthUrl(state));
}
