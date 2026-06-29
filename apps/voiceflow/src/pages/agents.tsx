import { Link } from "wouter";
import {
  Plus,
  Bot,
  Phone,
  CheckCircle,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
} from "lucide-react";
import {
  useListAgents,
  useActivateAgent,
  useDeactivateAgent,
  useDeleteAgent,
  getListAgentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const TYPE_LABELS: Record<string, string> = {
  booking: "Terminbuchung",
  advisory: "Beratung",
  hr_screening: "HR Screening",
  hr_onboarding: "Onboarding",
};

const TYPE_COLORS: Record<string, string> = {
  booking: "text-blue-700 bg-blue-50 border-blue-200",
  advisory: "text-violet-700 bg-violet-50 border-violet-200",
  hr_screening: "text-amber-700 bg-amber-50 border-amber-200",
  hr_onboarding: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-500",
    inactive: "bg-slate-400",
    draft: "bg-amber-400",
  };
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] ?? "bg-slate-400"}`}
    />
  );
}

function statusLabel(s: string) {
  return s === "active" ? "Aktiv" : s === "inactive" ? "Inaktiv" : "Entwurf";
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const { data: agents, isLoading } = useListAgents({
    query: { queryKey: getListAgentsQueryKey() },
  });
  const activateAgent = useActivateAgent();
  const deactivateAgent = useDeactivateAgent();
  const deleteAgent = useDeleteAgent();

  const refetch = () =>
    qc.invalidateQueries({ queryKey: getListAgentsQueryKey() });

  return (
    <DashboardLayout>
      <TopNav
        title="Agenten"
        subtitle="Verwalten Sie Ihre KI-Telefonagenten"
        action={
          <Link href="/agents/new">
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              data-testid="button-create-agent"
            >
              <Plus size={13} />
              Neuer Agent
            </Button>
          </Link>
        }
      />

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : (agents ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Bot size={22} className="text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Noch keine Agenten
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Erstellen Sie Ihren ersten KI-Telefonagenten.
            </p>
            <Link href="/agents/new">
              <Button
                size="sm"
                className="gap-1.5"
                data-testid="button-create-first-agent"
              >
                <Plus size={13} />
                Ersten Agent erstellen
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(agents ?? []).map((agent) => (
              <div
                key={agent.id}
                data-testid={`card-agent-${agent.id}`}
                className="bg-card border border-card-border rounded-xl p-5 shadow-xs hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={agent.status} />
                    <span className="text-xs text-muted-foreground">
                      {statusLabel(agent.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[agent.type]}`}
                    >
                      {TYPE_LABELS[agent.type]}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          data-testid={`button-agent-menu-${agent.id}`}
                        >
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <Link href={`/agents/${agent.id}`}>
                          <DropdownMenuItem>Details anzeigen</DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator />
                        {agent.status === "active" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              void deactivateAgent.mutate(
                                { id: agent.id },
                                { onSuccess: refetch },
                              )
                            }
                          >
                            <Pause size={13} className="mr-2" />
                            Deaktivieren
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              void activateAgent.mutate(
                                { id: agent.id },
                                { onSuccess: refetch },
                              )
                            }
                          >
                            <Play size={13} className="mr-2" />
                            Aktivieren
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() =>
                            void deleteAgent.mutate(
                              { id: agent.id },
                              { onSuccess: refetch },
                            )
                          }
                        >
                          <Trash2 size={13} className="mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <Link href={`/agents/${agent.id}`} className="block">
                  <h3 className="text-sm font-semibold text-foreground mb-0.5 hover:text-primary transition-colors cursor-pointer">
                    {agent.name}
                  </h3>
                </Link>
                {agent.businessName && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {agent.businessName}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <Phone size={11} />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {agent.totalCalls}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Anrufe</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <CheckCircle size={11} />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {Number(agent.resolutionRate).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Lösungsrate
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <Bot size={11} />
                    </div>
                    <p className="text-sm font-bold text-foreground">
                      {Number(agent.totalMinutes).toFixed(0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Minuten</p>
                  </div>
                </div>

                {agent.phoneNumber && (
                  <div className="mt-3 pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {agent.phoneNumber}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
