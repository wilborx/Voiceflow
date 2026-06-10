import { useState } from "react";
import { Link } from "wouter";
import { Search, Filter } from "lucide-react";
import { useListCalls, getListCallsQueryKey } from "@workspace/api-client-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")} Min.`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Abgeschlossen", failed: "Fehlgeschlagen", no_answer: "Keine Antwort",
  in_progress: "Aktiv", queued: "Wartend",
};

const SENTIMENT_LABELS: Record<string, string> = { positive: "Positiv", neutral: "Neutral", negative: "Negativ" };

function statusBadge(s: string) {
  const map: Record<string, string> = {
    completed: "text-emerald-700 bg-emerald-50 border-emerald-200",
    failed: "text-red-700 bg-red-50 border-red-200",
    no_answer: "text-slate-600 bg-slate-50 border-slate-200",
    in_progress: "text-blue-700 bg-blue-50 border-blue-200",
    queued: "text-amber-700 bg-amber-50 border-amber-200",
  };
  return map[s] ?? "text-slate-600 bg-slate-50 border-slate-200";
}

function sentimentBadge(s?: string | null) {
  if (s === "positive") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (s === "negative") return "text-red-700 bg-red-50 border-red-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

export default function CallsPage() {
  const [search, setSearch] = useState("");
  const { data: calls, isLoading } = useListCalls(
    { limit: 100 },
    { query: { queryKey: getListCallsQueryKey({ limit: 100 }) } }
  );

  const filtered = (calls ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.callerNumber ?? "").includes(q) ||
      (c.agentName ?? "").toLowerCase().includes(q) ||
      (c.summary ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout>
      <TopNav title="Anrufe" subtitle="Vollständige Anrufhistorie" />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="input-search-calls"
              className="pl-8 h-8 text-xs"
              placeholder="Anrufer, Agent, Zusammenfassung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter size={12} />
            {filtered.length} Anrufe
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {search ? "Keine Anrufe gefunden." : "Noch keine Anrufe."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Anrufer</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Agent</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Sentiment</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Dauer</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Zeitpunkt</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Gelöst</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((call) => (
                    <Link key={call.id} href={`/calls/${call.id}`}>
                      <tr
                        data-testid={`row-call-${call.id}`}
                        className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground">{call.callerNumber ?? "Unbekannt"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{call.agentName ?? "–"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge(call.status)}`}>
                            {STATUS_LABELS[call.status] ?? call.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {call.sentiment ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${sentimentBadge(call.sentiment)}`}>
                              {SENTIMENT_LABELS[call.sentiment]}
                            </span>
                          ) : <span className="text-muted-foreground">–</span>}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDuration(call.durationSeconds)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatDate(call.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          {call.resolved ? (
                            <span className="text-emerald-600 font-medium">Ja</span>
                          ) : (
                            <span className="text-muted-foreground">Nein</span>
                          )}
                        </td>
                      </tr>
                    </Link>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
