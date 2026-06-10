import { Calendar, CreditCard, MessageSquare, Database, Plug2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";

const INTEGRATIONS = [
  {
    id: "google-calendar",
    name: "Google Kalender",
    description: "Verfügbarkeit prüfen und Termine direkt buchen",
    icon: Calendar,
    status: "available",
    category: "Kalender",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Zahlungen und Subscriptions verwalten",
    icon: CreditCard,
    status: "connected",
    category: "Zahlungen",
  },
  {
    id: "vapi",
    name: "Vapi.ai",
    description: "KI-Sprachagent Orchestrierung",
    icon: MessageSquare,
    status: "connected",
    category: "Sprache",
  },
  {
    id: "crm",
    name: "CRM System",
    description: "Kundendaten synchronisieren",
    icon: Database,
    status: "coming-soon",
    category: "CRM",
  },
  {
    id: "n8n",
    name: "n8n Automation",
    description: "Workflows und Automatisierungen",
    icon: Plug2,
    status: "coming-soon",
    category: "Automation",
  },
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  connected: { label: "Verbunden", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  available: { label: "Verfügbar", cls: "text-blue-700 bg-blue-50 border-blue-200" },
  "coming-soon": { label: "Demnächst", cls: "text-slate-600 bg-slate-50 border-slate-200" },
};

export default function IntegrationsPage() {
  return (
    <DashboardLayout>
      <TopNav title="Integrationen" subtitle="Verbinden Sie Ihre bestehenden Tools" />

      <div className="flex-1 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            const statusInfo = STATUS_LABELS[integration.status];
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
                    <Button size="sm" className="h-7 text-xs w-full" data-testid={`button-connect-${integration.id}`}>
                      Verbinden
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="h-7 text-xs w-full" disabled>
                      Demnächst verfügbar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
