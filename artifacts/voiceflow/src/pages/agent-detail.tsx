import { useParams, Link } from "wouter";
import { ArrowLeft, Play, Pause, Phone, Clock, CheckCircle } from "lucide-react";
import {
  useGetAgent,
  useListCalls,
  useActivateAgent,
  useDeactivateAgent,
  getGetAgentQueryKey,
  getListCallsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const TYPE_LABELS: Record<string, string> = {
  booking: "Terminbuchung",
  advisory: "Beratung",
  hr_screening: "HR Screening",
  hr_onboarding: "Onboarding",
};

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")} Min.`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: agent, isLoading } = useGetAgent(id!, { query: { enabled: !!id, queryKey: getGetAgentQueryKey(id!) } });
  const { data: calls, isLoading: callsLoading } = useListCalls(
    { agentId: id, limit: 20 },
    { query: { enabled: !!id, queryKey: getListCallsQueryKey({ agentId: id, limit: 20 }) } }
  );
  const activate = useActivateAgent();
  const deactivate = useDeactivateAgent();

  const handleToggle = () => {
    if (!agent) return;
    const action = agent.status === "active" ? deactivate : activate;
    action.mutate(
      { id: id! },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetAgentQueryKey(id!) });
          toast({ title: agent.status === "active" ? "Agent deaktiviert" : "Agent aktiviert" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <TopNav title="Agent laden..." />
        <div className="p-6"><Skeleton className="h-96 w-full rounded-xl" /></div>
      </DashboardLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardLayout>
        <TopNav title="Nicht gefunden" />
        <div className="p-6 text-center text-muted-foreground">Agent nicht gefunden.</div>
      </DashboardLayout>
    );
  }

  const statusLabel = agent.status === "active" ? "Aktiv" : agent.status === "inactive" ? "Inaktiv" : "Entwurf";

  return (
    <DashboardLayout>
      <TopNav
        title={agent.name}
        subtitle={`${TYPE_LABELS[agent.type]} · ${statusLabel}`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/agents">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                <ArrowLeft size={12} /> Zurück
              </Button>
            </Link>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              variant={agent.status === "active" ? "outline" : "default"}
              onClick={handleToggle}
              disabled={activate.isPending || deactivate.isPending}
              data-testid="button-toggle-agent"
            >
              {agent.status === "active" ? (
                <><Pause size={12} /> Deaktivieren</>
              ) : (
                <><Play size={12} /> Aktivieren</>
              )}
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Phone, label: "Anrufe gesamt", value: agent.totalCalls, color: "text-blue-600 bg-blue-50" },
            { icon: CheckCircle, label: "Lösungsrate", value: `${Number(agent.resolutionRate).toFixed(0)}%`, color: "text-emerald-600 bg-emerald-50" },
            { icon: Clock, label: "Minuten gesamt", value: Number(agent.totalMinutes).toFixed(0), color: "text-violet-600 bg-violet-50" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-card border border-card-border rounded-xl p-4 shadow-xs flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold text-foreground" data-testid={`stat-${label}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Config */}
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground mb-3">Konfiguration</h3>
            <dl className="space-y-2.5 text-sm">
              {agent.businessName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Unternehmen</dt>
                  <dd className="font-medium text-foreground">{agent.businessName}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Typ</dt>
                <dd className="font-medium text-foreground">{TYPE_LABELS[agent.type]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Sprache</dt>
                <dd className="font-medium text-foreground">{agent.language.toUpperCase()}</dd>
              </div>
              {agent.voiceName && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Stimme</dt>
                  <dd className="font-medium text-foreground">{agent.voiceName}</dd>
                </div>
              )}
              {agent.businessHoursOpen && agent.businessHoursClose && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Öffnungszeiten</dt>
                  <dd className="font-medium text-foreground">{agent.businessHoursOpen} – {agent.businessHoursClose}</dd>
                </div>
              )}
              {agent.phoneNumber && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Telefonnummer</dt>
                  <dd className="font-mono text-xs text-foreground font-medium">{agent.phoneNumber}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Erstellt</dt>
                <dd className="text-foreground">{formatDate(agent.createdAt)}</dd>
              </div>
            </dl>
          </div>

          {/* System Prompt */}
          <div className="bg-card border border-card-border rounded-xl p-4 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground mb-3">System-Prompt</h3>
            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
              {agent.systemPrompt}
            </pre>
          </div>
        </div>

        {/* Calls */}
        <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Letzte Anrufe</h3>
          </div>
          {callsLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (calls ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Noch keine Anrufe</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Anrufer</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Dauer</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Zeitpunkt</th>
                </tr>
              </thead>
              <tbody>
                {(calls ?? []).map((call) => (
                  <tr key={call.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{call.callerNumber ?? "Unbekannt"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${call.status === "completed" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-600 bg-slate-50 border-slate-200"}`}>
                        {call.status === "completed" ? "Abgeschlossen" : call.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDuration(call.durationSeconds)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(call.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
