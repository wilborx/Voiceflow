import {
  useGetCallVolume,
  useGetAgentPerformance,
  useGetDashboardStats,
  getGetCallVolumeQueryKey,
  getGetAgentPerformanceQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["hsl(221,83%,53%)", "hsl(142,71%,45%)", "hsl(35,91%,54%)", "hsl(271,73%,60%)"];

export default function AnalyticsPage() {
  const { data: callVolume, isLoading: volLoading } = useGetCallVolume({ query: { queryKey: getGetCallVolumeQueryKey() } });
  const { data: agentPerf, isLoading: perfLoading } = useGetAgentPerformance({ query: { queryKey: getGetAgentPerformanceQueryKey() } });
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });

  const chartData = (callVolume ?? []).map((d) => ({
    ...d,
    date: new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(d.date)),
  }));

  const pieData = [
    { name: "Gelöst", value: stats?.resolutionRate ?? 0 },
    { name: "Weitergeleitet", value: 100 - (stats?.resolutionRate ?? 0) },
  ];

  return (
    <DashboardLayout>
      <TopNav title="Analytik" subtitle="Leistungskennzahlen und Trends" />

      <div className="flex-1 p-6 space-y-5">
        {/* Call Volume */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-foreground mb-1">Anrufvolumen</h2>
          <p className="text-xs text-muted-foreground mb-4">Letzte 30 Tage</p>
          {volLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <ResponsiveContainer width="100%" height={208}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221,83%,53%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(221,83%,53%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142,71%,45%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(142,71%,45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="calls" name="Anrufe" stroke="hsl(221,83%,53%)" strokeWidth={2} fill="url(#volGrad)" />
                <Area type="monotone" dataKey="resolved" name="Gelöst" stroke="hsl(142,71%,45%)" strokeWidth={2} fill="url(#resGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Agent Performance */}
          <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-foreground mb-1">Agent-Performance</h2>
            <p className="text-xs text-muted-foreground mb-4">Anrufe pro Agent</p>
            {perfLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (agentPerf ?? []).length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">Keine Daten</div>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={agentPerf ?? []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="agentName" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar dataKey="totalCalls" name="Anrufe" fill="hsl(221,83%,53%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="resolutionRate" name="Lösungsrate %" fill="hsl(142,71%,45%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Resolution Pie */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-foreground mb-1">Lösungsrate</h2>
            <p className="text-xs text-muted-foreground mb-4">Diesen Monat</p>
            {statsLoading ? (
              <Skeleton className="h-44 w-full rounded-full" />
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(v) => `${v}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="text-center mt-2">
              <p className="text-3xl font-bold text-foreground">{stats?.resolutionRate ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Gelöste Anrufe</p>
            </div>
          </div>
        </div>

        {/* Agent Table */}
        {!perfLoading && (agentPerf ?? []).length > 0 && (
          <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Agent-Übersicht</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Agent</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Anrufe</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Lösungsrate</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Ø Dauer</th>
                </tr>
              </thead>
              <tbody>
                {(agentPerf ?? []).map((a) => (
                  <tr key={a.agentId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{a.agentName}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${a.status === "active" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-600 bg-slate-50 border-slate-200"}`}>
                        {a.status === "active" ? "Aktiv" : a.status === "inactive" ? "Inaktiv" : "Entwurf"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground font-semibold">{a.totalCalls}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-semibold text-emerald-600">{a.resolutionRate}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {Math.floor(a.avgDurationSeconds / 60)}:{(a.avgDurationSeconds % 60).toString().padStart(2, "0")} Min.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
