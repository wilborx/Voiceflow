import { Link } from "wouter";
import {
  Phone, Clock, CheckCircle, TrendingUp, Bot, ArrowUpRight, ArrowRight,
} from "lucide-react";
import {
  useGetDashboardStats,
  useGetRecentCalls,
  useGetCallVolume,
  useGetAgentPerformance,
  getGetDashboardStatsQueryKey,
  getGetRecentCallsQueryKey,
  getGetCallVolumeQueryKey,
  getGetAgentPerformanceQueryKey,
} from "@workspace/api-client-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")} Min.`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function sentimentColor(s?: string | null) {
  if (s === "positive") return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (s === "negative") return "text-red-600 bg-red-50 border-red-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

function sentimentLabel(s?: string | null) {
  if (s === "positive") return "Positiv";
  if (s === "negative") return "Negativ";
  return "Neutral";
}

function statusColor(s: string) {
  if (s === "completed") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (s === "failed" || s === "no_answer") return "text-red-700 bg-red-50 border-red-200";
  if (s === "in_progress") return "text-blue-700 bg-blue-50 border-blue-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    completed: "Abgeschlossen",
    failed: "Fehlgeschlagen",
    no_answer: "Keine Antwort",
    in_progress: "Aktiv",
    queued: "Wartend",
  };
  return map[s] ?? s;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });
  const { data: recentCalls, isLoading: callsLoading } = useGetRecentCalls(
    { limit: 8 },
    { query: { queryKey: getGetRecentCallsQueryKey({ limit: 8 }) } }
  );
  const { data: callVolume, isLoading: volumeLoading } = useGetCallVolume({
    query: { queryKey: getGetCallVolumeQueryKey() },
  });
  const { data: agentPerf, isLoading: agentLoading } = useGetAgentPerformance({
    query: { queryKey: getGetAgentPerformanceQueryKey() },
  });

  const statCards = [
    {
      label: "Anrufe heute",
      value: stats?.totalCallsToday ?? 0,
      sub: `${stats?.totalCallsThisMonth ?? 0} diesen Monat`,
      icon: Phone,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Ø Gesprächsdauer",
      value: statsLoading ? "–" : formatDuration(stats?.avgDurationSeconds ?? 0),
      sub: "Durchschnitt",
      icon: Clock,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Lösungsrate",
      value: statsLoading ? "–" : `${stats?.resolutionRate ?? 0}%`,
      sub: "Diesen Monat",
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Buchungen",
      value: stats?.bookingsThisMonth ?? 0,
      sub: "Diesen Monat",
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  const chartData = (callVolume ?? []).slice(-14).map((d) => ({
    ...d,
    date: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(d.date)),
  }));

  return (
    <DashboardLayout>
      <TopNav
        title="Dashboard"
        subtitle={new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
        action={
          <Link href="/agents/new">
            <Button size="sm" className="h-8 gap-1.5 text-xs" data-testid="button-create-agent">
              <Bot size={13} />
              Neuer Agent
            </Button>
          </Link>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-card border border-card-border rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                  <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <Icon size={14} className={card.color} />
                  </div>
                </div>
                {statsLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <div className="text-2xl font-bold text-foreground" data-testid={`stat-${card.label}`}>{card.value}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Call Volume Chart */}
          <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Anrufvolumen</h2>
              <span className="text-xs text-muted-foreground">Letzte 14 Tage</span>
            </div>
            {volumeLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">Keine Daten verfügbar</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="calls" name="Anrufe" stroke="hsl(221,83%,53%)" strokeWidth={2} fill="url(#callGradient)" />
                  <Area type="monotone" dataKey="resolved" name="Gelöst" stroke="hsl(142,71%,45%)" strokeWidth={2} fill="none" strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Agent Performance */}
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Agenten</h2>
              <Link href="/agents" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Alle <ArrowRight size={11} />
              </Link>
            </div>
            {agentLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (agentPerf ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">Noch keine Agenten</div>
            ) : (
              <div className="space-y-2">
                {(agentPerf ?? []).slice(0, 4).map((a) => (
                  <div key={a.agentId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.status === "active" ? "bg-emerald-500" : a.status === "inactive" ? "bg-slate-400" : "bg-amber-400"}`} />
                      <span className="text-xs font-medium text-foreground truncate">{a.agentName}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{a.totalCalls} Anrufe</span>
                      <span className="text-xs font-semibold text-emerald-600">{a.resolutionRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Calls */}
        <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Letzte Anrufe</h2>
            <Link href="/calls" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Alle anzeigen <ArrowUpRight size={11} />
            </Link>
          </div>
          {callsLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (recentCalls ?? []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Noch keine Anrufe</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Anrufer</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Agent</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Sentiment</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Dauer</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Zeitpunkt</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentCalls ?? []).map((call) => (
                    <tr key={call.id} className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{call.callerNumber ?? "Unbekannt"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{call.agentName ?? "–"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor(call.status)}`}>
                          {statusLabel(call.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {call.sentiment ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${sentimentColor(call.sentiment)}`}>
                            {sentimentLabel(call.sentiment)}
                          </span>
                        ) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDuration(call.durationSeconds)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(call.createdAt)}</td>
                    </tr>
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
