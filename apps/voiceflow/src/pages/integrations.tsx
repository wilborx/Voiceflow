import { Calendar, CreditCard, MessageSquare, Database, Plug2, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { useListIntegrations } from "@workspace/api-client-react";
import type { Integration } from "@workspace/api-client-react";

const ICON_MAP: Record<string, typeof Calendar> = {
  "google-calendar": Calendar,
  stripe: CreditCard,
  vapi: MessageSquare,
  crm: Database,
  n8n: Plug2,
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  connected: { label: "Verbunden", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  available: { label: "Verfügbar", cls: "text-blue-700 bg-blue-50 border-blue-200" },
  "coming-soon": { label: "Demnächst", cls: "text-slate-600 bg-slate-50 border-slate-200" },
  disconnected: { label: "Getrennt", cls: "text-red-700 bg-red-50 border-red-200" },
};

export default function IntegrationsPage() {
  const { data: integrations = [], isLoading } = useListIntegrations();

  const connectGoogleCalendar = async (agentId: string) => {
    try {
      const response = await fetch(`/api/integrations/google/auth?agentId=${agentId}`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error("Failed to get Google auth URL:", err);
    }
  };

  return (
    <DashboardLayout>
      <TopNav title="Integrationen" subtitle="Verbinden Sie Ihre bestehenden Tools" />

      <div className="flex-1 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Integrationen werden geladen...
            </div>
          ) : (
            integrations.map((integration: Integration) => {
              const Icon = ICON_MAP[integration.id] ?? Plug2;
              const statusInfo = STATUS_LABELS[integration.status] ?? STATUS_LABELS.disconnected;
              return (
                <div
                  key={integration.id}
                  data-testid={`card-integration-${integration.id}`}
                  className="bg-card border border-card-border rounded-xl p-5 shadow-xs flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                      <Icon size={18} className="text-foreground" />
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-foreground">{integration.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{integration.description}</p>
                  </div>

                  <div className="mt-auto">
                    {integration.status === "connected" ? (
                      <Button variant="outline" size="sm" className="h-7 text-xs w-full" data-testid={`button-manage-${integration.id}`}>
                        Verwalten
                      </Button>
                    ) : integration.status === "available" ? (
                      integration.id === "google-calendar" ? (
                        <Button 
                          size="sm" 
                          className="h-7 text-xs w-full" 
                          data-testid={`button-connect-${integration.id}`}
                          onClick={() => connectGoogleCalendar("default")}
                        >
                          Verbinden
                        </Button>
                      ) : (
                        <Button size="sm" className="h-7 text-xs w-full" data-testid={`button-connect-${integration.id}`}>
                          Verbinden
                        </Button>
                      )
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-xs w-full" disabled>
                        Demnächst verfügbar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
