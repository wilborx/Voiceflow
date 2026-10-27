import "server-only";
import { headers } from "next/headers";
import { sqlOne } from "../db/client";
import { hashToken } from "./crypto";

/** Rate-Limit pro IP (gehasht, keine Klar-IP in der DB). true = erlaubt */
export async function rateLimit(route: string, max: number, windowSeconds: number): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const key = `${route}:${hashToken(ip).slice(0, 32)}`;
  const row = await sqlOne<{ ok: boolean }>("select hit_rate_limit($1, $2, $3) as ok", [key, windowSeconds, max]);
  return row?.ok ?? true;
}
