import { useState } from "react";
import { Save } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({
    orgName: "Mein Unternehmen",
    email: "admin@meinunternehmen.de",
    timezone: "Europe/Berlin",
    language: "de",
    vapiKey: "",
    elevenLabsKey: "",
  });

  const handleSave = () => {
    toast({ title: "Einstellungen gespeichert", description: "Ihre Einstellungen wurden erfolgreich gespeichert." });
  };

  return (
    <DashboardLayout>
      <TopNav
        title="Einstellungen"
        subtitle="Organisation und API-Zugänge konfigurieren"
        action={
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSave} data-testid="button-save-settings">
            <Save size={12} />
            Speichern
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-5 max-w-2xl">
        {/* Org Settings */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Organisation</h2>
          <div>
            <Label htmlFor="orgName" className="text-xs font-medium">Unternehmensname</Label>
            <Input
              id="orgName"
              data-testid="input-org-name"
              className="mt-1.5 h-8 text-sm"
              value={form.orgName}
              onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-xs font-medium">E-Mail-Adresse</Label>
            <Input
              id="email"
              type="email"
              data-testid="input-email"
              className="mt-1.5 h-8 text-sm"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="timezone" className="text-xs font-medium">Zeitzone</Label>
              <Input
                id="timezone"
                data-testid="input-timezone"
                className="mt-1.5 h-8 text-sm"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="language" className="text-xs font-medium">Sprache</Label>
              <Input
                id="language"
                data-testid="input-language"
                className="mt-1.5 h-8 text-sm"
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">API-Zugänge</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Verbinden Sie Ihre externen Dienste</p>
          </div>
          <div>
            <Label htmlFor="vapiKey" className="text-xs font-medium">Vapi API-Schlüssel</Label>
            <Input
              id="vapiKey"
              type="password"
              data-testid="input-vapi-key"
              className="mt-1.5 h-8 text-sm font-mono"
              placeholder="vapi_..."
              value={form.vapiKey}
              onChange={(e) => setForm((f) => ({ ...f, vapiKey: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="elevenLabsKey" className="text-xs font-medium">ElevenLabs API-Schlüssel</Label>
            <Input
              id="elevenLabsKey"
              type="password"
              data-testid="input-elevenlabs-key"
              className="mt-1.5 h-8 text-sm font-mono"
              placeholder="sk_..."
              value={form.elevenLabsKey}
              onChange={(e) => setForm((f) => ({ ...f, elevenLabsKey: e.target.value }))}
            />
          </div>
        </div>

        {/* DSGVO */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Datenschutz (DSGVO)</h2>
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-download-dpa">
              Auftragsverarbeitungsvertrag (AVV) herunterladen
            </Button>
            <br />
            <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="button-privacy-policy">
              Datenschutzerklärung anzeigen
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Alle Daten werden auf EU-Servern (Frankfurt) gespeichert und verarbeitet.
            Unsere Infrastruktur ist DSGVO-konform.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
