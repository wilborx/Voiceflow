import { Empty, PageHeader } from "@/components/admin/bits";
import { Badge } from "@/components/ui";
import { integrations } from "@/lib/config";
import { listMessages } from "@/lib/db/queries";
import { getOutbox } from "@/lib/notify/send";
import { DEFAULT_TEMPLATES, MESSAGE_KINDS, type MessageKind } from "@/lib/notify/templates";
import { formatForDisplay } from "@/lib/time/zoned";

export default async function NachrichtenPage() {
  const log = await listMessages(100);
  const outbox = getOutbox();
  const simulated = !integrations.email || !integrations.whatsapp;
  return (
    <>
      <PageHeader title="Nachrichten" />
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Vorlagen-Vorschau</h2>
        <div className="flex flex-wrap gap-2">
          {MESSAGE_KINDS.map((k) => (
            <a key={k} href={`/admin/nachrichten/vorschau/${k}`} target="_blank" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-muted">{DEFAULT_TEMPLATES[k].label}</a>
          ))}
        </div>
      </section>

      {simulated && (
        <section className="mb-10">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-muted">Simulierter Postausgang</h2>
          <p className="mb-3 text-sm text-muted">Ohne konfigurierten Provider werden Nachrichten nicht versendet, sondern hier angezeigt (nur im Speicher, max. 50).</p>
          {outbox.length === 0 ? <Empty>Noch keine Nachrichten in dieser Sitzung. Lege eine Test-Anfrage über die Website an.</Empty> : (
            <ul className="space-y-3">
              {outbox.map((m, i) => (
                <li key={i}>
                  <details className="rounded-xl border border-line bg-surface p-4">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                      <span><Badge tone={m.channel === "whatsapp" ? "ok" : "neutral"}>{m.channel === "whatsapp" ? "WhatsApp" : "E-Mail"}</Badge> <strong>{m.subject}</strong></span>
                      <span className="text-xs text-muted">an {m.to} · {formatForDisplay(m.at.getTime())}</span>
                    </summary>
                    <iframe title={m.subject} srcDoc={m.html} sandbox="" className="mt-3 h-[520px] w-full rounded-lg border border-line bg-white" />
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted">Versandprotokoll</h2>
        {log.length === 0 ? <Empty>Noch keine Nachrichten.</Empty> : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-muted"><tr><th className="p-3">Zeit</th><th className="p-3">Kunde</th><th className="p-3">Vorlage</th><th className="p-3">Kanal</th><th className="p-3">Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {log.map((m) => (
                  <tr key={m.id}>
                    <td className="p-3 whitespace-nowrap">{formatForDisplay(m.createdAt.getTime())}</td>
                    <td className="p-3">{m.customerName ?? "–"}</td>
                    <td className="p-3">{DEFAULT_TEMPLATES[m.template as MessageKind]?.label ?? m.template}</td>
                    <td className="p-3">{m.channel === "whatsapp" ? "WhatsApp" : "E-Mail"}</td>
                    <td className="p-3">
                      <Badge tone={m.status === "failed" ? "bad" : m.status === "fallback" ? "warn" : "ok"}>{{ sent: "gesendet", delivered: "zugestellt", failed: "fehlgeschlagen", fallback: "Fallback E-Mail", queued: "wartend" }[m.status] ?? m.status}</Badge>
                      {m.error && <span className="block text-xs text-red-400">{m.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
