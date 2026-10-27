import Link from "next/link";
import { Empty, Flash, PageHeader } from "@/components/admin/bits";
import { Button, inputClass } from "@/components/ui";
import { listCustomers } from "@/lib/db/queries";
import { formatForDisplay } from "@/lib/time/zoned";

export default async function KundenPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; fehler?: string }> }) {
  const p = await searchParams;
  const customers = await listCustomers(p.q);
  return (
    <>
      <PageHeader title="Kunden">
        <form className="flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Suche</label>
          <input id="q" name="q" defaultValue={p.q} placeholder="Name oder E-Mail" className={inputClass} />
          <Button type="submit" variant="secondary">Suchen</Button>
        </form>
      </PageHeader>
      <Flash ok={p.ok} error={p.fehler} />
      {customers.length === 0 ? <Empty>Keine Kunden gefunden.</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr><th className="p-3">Name</th><th className="p-3">Sessions</th><th className="p-3">No-Shows</th><th className="p-3">Kommend</th><th className="p-3">Zuletzt</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <td className="p-3"><Link href={`/admin/kunden/${c.id}`} className="font-semibold hover:underline">{c.name}</Link><span className="block text-xs text-muted">{c.email}</span></td>
                  <td className="p-3 tabular-nums">{c.sessions}</td>
                  <td className={`p-3 tabular-nums ${c.noShows > 0 ? "text-red-400" : ""}`}>{c.noShows}</td>
                  <td className="p-3 tabular-nums">{c.upcoming}</td>
                  <td className="p-3">{c.lastSession ? formatForDisplay(c.lastSession.getTime(), "Europe/Berlin", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
