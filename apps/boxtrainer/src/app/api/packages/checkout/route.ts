import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sqlOne } from "@/lib/db/client";
import { getSettings } from "@/lib/db/queries";
import { createPackageCheckout } from "@/lib/payments";
import { rateLimit } from "@/lib/server/ratelimit";

const schema = z.object({ packageId: z.string().uuid(), email: z.string().email() });

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = schema.safeParse({ packageId: form.get("packageId"), email: form.get("email") });
  const settings = await getSettings();
  if (!parsed.success || !settings.features.packages) return NextResponse.redirect(new URL("/pakete?fehler=1", req.url), 303);
  if (!(await rateLimit("package", 5, 600))) return NextResponse.redirect(new URL("/pakete?fehler=1", req.url), 303);
  const pkg = await sqlOne<{ id: string; name: string; priceCents: number }>(
    `select id, name, price_cents as "priceCents" from packages where id = $1 and is_active`,
    [parsed.data.packageId],
  );
  const url = pkg ? await createPackageCheckout(pkg, parsed.data.email) : null;
  return NextResponse.redirect(url ?? new URL("/pakete?demo=1", req.url), 303);
}
