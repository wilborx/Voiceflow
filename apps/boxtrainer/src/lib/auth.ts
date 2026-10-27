import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./config";
import { sqlOne } from "./db/client";
import { sign, verify } from "./server/crypto";
import { log } from "./server/log";

const COOKIE = "bt_admin";
const MAX_AGE_S = 12 * 3600;

interface Session {
  sub: string;
  exp: number;
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Login über Supabase Auth (wenn SUPABASE_URL gesetzt; Nutzer muss in `admins` stehen)
 * oder – für Demo/kleine Setups – über ADMIN_EMAIL/ADMIN_PASSWORD.
 */
export async function login(email: string, password: string): Promise<boolean> {
  let sub: string | null = null;
  if (env.supabaseUrl && env.supabaseAnonKey) {
    const res = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: env.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const json = (await res.json()) as { user?: { id: string } };
      const id = json.user?.id;
      if (id && (await sqlOne("select 1 from admins where user_id = $1", [id]))) sub = id;
    }
  } else if (env.adminEmail && env.adminPassword) {
    if (safeEqual(email.trim().toLowerCase(), env.adminEmail.toLowerCase()) && safeEqual(password, env.adminPassword)) {
      sub = "env-admin";
    }
  }
  if (!sub) {
    log.warn("admin login fehlgeschlagen");
    return false;
  }
  const session: Session = { sub, exp: Date.now() + MAX_AGE_S * 1000 };
  (await cookies()).set(COOKIE, sign(JSON.stringify(session)), {
    httpOnly: true,
    secure: env.appUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
  return true;
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getAdmin(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const payload = verify(raw);
  if (!payload) return null;
  try {
    const s = JSON.parse(payload) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/** Für Admin-Seiten und Server-Actions: ohne Session → Login. */
export async function requireAdmin(): Promise<Session> {
  const s = await getAdmin();
  if (!s) redirect("/admin/login");
  return s;
}
