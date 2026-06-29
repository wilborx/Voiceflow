import { Search } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListAuditLogs,
  getListAuditLogsQueryKey,
} from "@workspace/api-client-react";

const ACTION_LABELS: Record<string, string> = {
  "agent.created": "Agent erstellt",
  "agent.accessed": "Agent abgerufen",
  "agent.updated": "Agent aktualisiert",
  "agent.deleted": "Agent gelöscht",
  "call.accessed": "Anruf abgerufen",
  "call.deleted": "Anruf gelöscht",
  "consent.revoked": "Consent widerrufen",
  "data.export_requested": "Datenexport angefordert",
  "data.deletion_requested": "Datenlöschung angefordert",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AuditPage() {
  const { data: logs, isLoading } = useListAuditLogs(
    { limit: 500 },
    { query: { queryKey: getListAuditLogsQueryKey({ limit: 500 }) } },
  );

  return (
    <DashboardLayout>
      <TopNav
        title="Audit-Logs"
        subtitle="Nachvollziehbarkeit aller Aktionen"
      />

      <div className="flex-1 p-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm opacity-50 pointer-events-none">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Nach Aktion filtern..."
              disabled
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Noch keine Audit-Logs vorhanden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">
                      Zeitpunkt
                    </th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">
                      Aktion
                    </th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">
                      Ressource
                    </th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">
                      IP-Adresse
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {log.resourceType}: {log.resourceId.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {log.ipAddress ?? "–"}
                      </td>
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
