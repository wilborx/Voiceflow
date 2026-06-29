import { useState } from "react";
import {
  Save,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Trash2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  useGetSettings,
  useUpdateSettings,
  useListIntegrations,
  useExportOrgData,
  useRequestDataDeletion,
  type Integration,
} from "@workspace/api-client-react";

const DELETE_CONFIRMATION = "DELETE_MY_DATA";

function getApiOrigin() {
  return (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(
    /\/+$/,
    "",
  );
}

function downloadOrgData() {
  const url = new URL(`${getApiOrigin()}/api/settings/export`);
  window.open(url.toString(), "_blank");
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const statusConfig: Record<
    string,
    { icon: typeof CheckCircle2; label: string; className: string }
  > = {
    connected: {
      icon: CheckCircle2,
      label: "Verbunden",
      className: "text-emerald-600 bg-emerald-50 border-emerald-200",
    },
    available: {
      icon: ExternalLink,
      label: "Verfügbar",
      className: "text-blue-600 bg-blue-50 border-blue-200",
    },
    "coming-soon": {
      icon: Clock,
      label: "Demnächst",
      className: "text-amber-600 bg-amber-50 border-amber-200",
    },
    disconnected: {
      icon: XCircle,
      label: "Getrennt",
      className: "text-red-600 bg-red-50 border-red-200",
    },
  };

  const config = statusConfig[integration.status] ?? statusConfig.available;
  const StatusIcon = config.icon as React.ComponentType<{ size: number }>;

  return (
    <div className="border border-card-border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {integration.name}
          </h3>
          {integration.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {integration.description}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${config.className}`}
        >
          <StatusIcon size={12} />
          {config.label}
        </span>
      </div>
      {integration.connectedAt !== null &&
        integration.connectedAt !== undefined && (
          <Button
            variant="link"
            size="sm"
            className="h-8 text-xs"
            data-testid="button-open-privacy"
            onClick={() =>
              window.open(
                `/api/settings/documents/privacy-policy.txt`,
                "_blank",
              )
            }
          >
            Datenschutzerklärung lesen
          </Button>
        )}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const settingsQuery = useGetSettings();
  const integrationsQuery = useListIntegrations();
  const updateMutation = useUpdateSettings();
  const exportMutation = useExportOrgData();
  const deletionMutation = useRequestDataDeletion();

  const settings = settingsQuery.data;
  const integrations = integrationsQuery.data ?? [];

  const [form, setForm] = useState({
    name: settings?.name ?? "My Organization",
    email: settings?.email ?? "admin@company.com",
    timezone: settings?.timezone ?? "Europe/Berlin",
    language: settings?.language ?? "de",
    vapiKey: "",
    elevenLabsKey: "",
  });
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");

  const canDelete = deletionConfirmation === DELETE_CONFIRMATION;

  const handleSave = () => {
    updateMutation.mutate(
      {
        data: {
          name: form.name,
          email: form.email,
          timezone: form.timezone,
          language: form.language,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Settings saved",
            description: "Your settings have been updated successfully.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to save settings.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleRefreshIntegrations = () => {
    void integrationsQuery.refetch();
    toast({ title: "Refreshed", description: "Integration status updated." });
  };

  const handleExport = () => {
    downloadOrgData();
    toast({
      title: "Export started",
      description: "Your data export will download in a new tab.",
    });
  };

  const handleDeletion = () => {
    if (!canDelete) return;

    deletionMutation.mutate(
      { data: { confirmation: DELETE_CONFIRMATION } },
      {
        onSuccess: () => {
          toast({
            title: "Deletion complete",
            description: "All your data has been deleted.",
          });
          setDeletionOpen(false);
          setDeletionConfirmation("");
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to delete data.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <DashboardLayout>
      <TopNav
        title="Einstellungen"
        subtitle="Organisation und API-Zugänge konfigurieren"
        action={
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleSave}
            data-testid="button-save-settings"
          >
            <Save size="12" />
            Speichern
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-5 max-w-2xl">
        {/* Org Settings */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            Organisation
          </h2>
          <div>
            <Label htmlFor="name" className="text-xs font-medium">
              Unternehmensname
            </Label>
            <Input
              id="name"
              data-testid="input-name"
              className="mt-1.5 h-8 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-xs font-medium">
              E-Mail-Adresse
            </Label>
            <Input
              id="email"
              type="email"
              data-testid="input-email"
              className="mt-1.5 h-8 text-sm"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="timezone" className="text-xs font-medium">
                Zeitzone
              </Label>
              <Input
                id="timezone"
                data-testid="input-timezone"
                className="mt-1.5 h-8 text-sm"
                value={form.timezone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, timezone: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="language" className="text-xs font-medium">
                Sprache
              </Label>
              <Input
                id="language"
                data-testid="input-language"
                className="mt-1.5 h-8 text-sm"
                value={form.language}
                onChange={(e) =>
                  setForm((f) => ({ ...f, language: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Integrationen
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verbundene Dienste verwalten
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleRefreshIntegrations}
              disabled={integrationsQuery.isFetching}
              data-testid="button-refresh-integrations"
            >
              <RefreshCw
                size="12"
                className={integrationsQuery.isFetching ? "animate-spin" : ""}
              />
            </Button>
          </div>
          <div className="space-y-3">
            {integrationsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Lädt...</p>
            ) : integrationsQuery.isError ? (
              <p className="text-xs text-red-600">
                Fehler beim Laden der Integrationen
              </p>
            ) : (
              integrations.map((intg) => (
                <IntegrationCard key={intg.id} integration={intg} />
              ))
            )}
          </div>
        </div>

        {/* DSGVO */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Datenschutz (DSGVO)
          </h2>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              data-testid="button-avv-preview"
              onClick={() =>
                window.open(`/api/settings/documents/avv.txt`, "_blank")
              }
            >
              Auftragsverarbeitungsvertrag (AVV) anzeigen
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              data-testid="button-privacy-policy"
              onClick={() =>
                window.open(
                  `/api/settings/documents/privacy-policy.txt`,
                  "_blank",
                )
              }
            >
              Datenschutzerklärung anzeigen
            </Button>
            <br />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              data-testid="button-export-data"
              onClick={handleExport}
              disabled={deletionMutation.isPending || exportMutation.isFetching}
            >
              <Download size="12" />
              Daten exportieren
            </Button>
            <br />
            <AlertDialog open={deletionOpen} onOpenChange={setDeletionOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  data-testid="button-delete-data"
                  disabled={
                    deletionMutation.isPending || exportMutation.isFetching
                  }
                >
                  <Trash2 size="12" />
                  Alle meine Daten löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Datenlöschung bestätigen</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion löscht Calls, Agenten,
                    Organisationseinstellungen und zugehörige Daten
                    unwiderruflich.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3 py-3">
                  <Label htmlFor="delete-confirmation">
                    Zur Bestätigung bitte DELETE_MY_DATA eingeben
                  </Label>
                  <Input
                    id="delete-confirmation"
                    data-testid="input-delete-confirmation"
                    value={deletionConfirmation}
                    onChange={(e) => setDeletionConfirmation(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant="destructive"
                      data-testid="button-confirm-delete-data"
                      disabled={!canDelete || deletionMutation.isPending}
                      onClick={handleDeletion}
                    >
                      Löschung ausführen
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-xs text-muted-foreground">
            Alle Daten werden auf EU-Servern (Frankfurt) gespeichert und
            verarbeitet. Unsere Infrastruktur ist DSGVO-konform.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
