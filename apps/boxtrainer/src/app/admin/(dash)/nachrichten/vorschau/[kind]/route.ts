import { getAdmin } from "@/lib/auth";
import { renderMessage } from "@/lib/notify/send";
import { MESSAGE_KINDS, type MessageKind } from "@/lib/notify/templates";
import { env } from "@/lib/config";
import { addDays, localDateOf, zonedToUtc } from "@/lib/time/zoned";

/** Vorschau einer Vorlage mit Beispieldaten (aktuelle Texte aus den Einstellungen). */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await getAdmin())) return new Response("unauthorized", { status: 401 });
  const { kind } = await params;
  if (!MESSAGE_KINDS.includes(kind as MessageKind)) return new Response("not found", { status: 404 });
  const msg = await renderMessage(
    kind as MessageKind,
    { name: "Max Mustermann", offeringName: "1:1 Personal Training", startsAt: new Date(zonedToUtc(addDays(localDateOf(Date.now()), 3), 18 * 60)), location: null },
    { link: `${env.appUrl}/buchung/beispiel`, reason: "Ich bin an dem Tag auf einem Wettkampf.", hours: 24, extraLinks: kind === "booking_confirmed" ? [{ label: "Kalendereintrag herunterladen", href: "#" }] : [] },
  );
  return new Response(msg.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
