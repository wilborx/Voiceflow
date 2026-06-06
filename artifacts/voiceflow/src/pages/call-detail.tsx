import { useParams, Link } from "wouter";
import { ArrowLeft, Phone, Clock, CheckCircle, User, AlertTriangle } from "lucide-react";
import { useGetCall, getGetCallQueryKey } from "@workspace/api-client-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")} Min.`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const SENTIMENT_MAP: Record<string, { label: string; cls: string }> = {
  positive: { label: "Positiv", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  neutral: { label: "Neutral", cls: "text-slate-600 bg-slate-50 border-slate-200" },
  negative: { label: "Negativ", cls: "text-red-700 bg-red-50 border-red-200" },
};

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: call, isLoading } = useGetCall(id!, { query: { enabled: !!id, queryKey: getGetCallQueryKey(id!) } });

  if (isLoading) {
    return (
      <DashboardLayout>
        <TopNav title="Anruf laden..." />
        <div className="p-6"><Skeleton className="h-96 w-full rounded-xl" /></div>
      </DashboardLayout>
    );
  }

  if (!call) {
    return (
      <DashboardLayout>
        <TopNav title="Nicht gefunden" />
        <div className="p-6 text-center text-muted-foreground">Anruf nicht gefunden.</div>
      </DashboardLayout>
    );
  }

  const sentimentInfo = call.sentiment ? SENTIMENT_MAP[call.sentiment] : null;

  return (
    <DashboardLayout>
      <TopNav
        title={`Anruf von ${call.callerNumber ?? "Unbekannt"}`}
        subtitle={call.startedAt ? formatDate(call.startedAt) : ""}
        action={
          <Link href="/calls">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <ArrowLeft size={12} /> Zurück
            </Button>
          </Link>
        }
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Phone, label: "Anrufer", value: call.callerNumber ?? "Unbekannt" },
            { icon: Clock, label: "Dauer", value: formatDuration(call.durationSeconds) },
            { icon: CheckCircle, label: "Gelöst", value: call.resolved ? "Ja" : "Nein" },
            { icon: User, label: "Agent", value: call.agentName ?? "–" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card border border-card-border rounded-xl p-3.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                <Icon size={13} />
                <span className="text-xs">{label}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Summary & Flags */}
          <div className="space-y-4">
            {call.summary && (
              <div className="bg-card border border-card-border rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zusammenfassung</h3>
                <p className="text-sm text-foreground leading-relaxed">{call.summary}</p>
              </div>
            )}

            <div className="bg-card border border-card-border rounded-xl p-4 shadow-xs space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
              {sentimentInfo && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Sentiment</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${sentimentInfo.cls}`}>{sentimentInfo.label}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Richtung</span>
                <span className="text-xs font-medium text-foreground">{call.direction === "inbound" ? "Eingehend" : "Ausgehend"}</span>
              </div>
              {call.resolutionType && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Ergebnis</span>
                  <span className="text-xs font-medium text-foreground">{call.resolutionType}</span>
                </div>
              )}
              {call.escalatedToHuman && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle size={12} className="text-amber-600 flex-shrink-0" />
                  <span className="text-xs text-amber-700">An menschlichen Mitarbeiter weitergeleitet</span>
                </div>
              )}
            </div>
          </div>

          {/* Transcript */}
          <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Transkript</h3>
            {call.transcript ? (
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-mono max-h-96 overflow-y-auto text-xs">
                {call.transcript}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">Kein Transkript verfügbar</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
