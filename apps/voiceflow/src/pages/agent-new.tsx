import { useState } from "react";
import { useLocation } from "wouter";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { useCreateAgent, getListAgentsQueryKey, useListVoices, useGetPromptTemplates } from "@workspace/api-client-react";
import type { Voice } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type AgentType = "booking" | "advisory" | "hr_screening" | "hr_onboarding";

const STEPS = [
  { id: 1, title: "Agent-Typ" },
  { id: 2, title: "Business-Daten" },
  { id: 3, title: "Stimme & Sprache" },
  { id: 4, title: "Verhalten" },
];

const AGENT_TYPES = [
  {
    id: "booking",
    title: "Terminbuchung",
    description: "Nimmt Terminanfragen entgegen und bucht direkt ins Kalender",
    useCases: ["Frisörsalons", "Beautystudios", "Arztpraxen"],
    color: "border-blue-300 bg-blue-50/50",
    activeColor: "border-blue-500 bg-blue-50",
  },
  {
    id: "advisory",
    title: "Beratung & Qualifizierung",
    description: "Beantwortet Fragen, qualifiziert Leads und leitet Anfragen weiter",
    useCases: ["Versicherungen", "Finanzberater", "Immobilien"],
    color: "border-violet-300 bg-violet-50/50",
    activeColor: "border-violet-500 bg-violet-50",
  },
  {
    id: "hr_screening",
    title: "HR Screening",
    description: "Führt strukturierte Erstgespräche mit Kandidaten durch",
    useCases: ["Recruiting", "HR-Abteilungen", "Zeitarbeit"],
    color: "border-amber-300 bg-amber-50/50",
    activeColor: "border-amber-500 bg-amber-50",
  },
  {
    id: "hr_onboarding",
    title: "Onboarding",
    description: "Beantwortet Fragen neuer Mitarbeiter zu Einarbeitung und Abläufen",
    useCases: ["Konzerne", "Retail", "Logistik"],
    color: "border-emerald-300 bg-emerald-50/50",
    activeColor: "border-emerald-500 bg-emerald-50",
  },
];

export default function AgentNewPage() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const createAgent = useCreateAgent();
  const { data: voices = [] } = useListVoices();
  const { data: promptTemplates } = useGetPromptTemplates();

  const fallbackVoices: Voice[] = [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Lena", description: "Freundlich, warm" },
    { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Professionell, klar" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Sanft, vertrauensvoll" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Ruhig, kompetent" },
  ];
  const fallbackPromptTemplates = {
    booking: "Du bist eine freundliche KI-Telefonassistentin. Dein Name ist Lena.\n\nAUFGABE:\nNimm Terminanfragen entgegen und buche Termine direkt ins Kalendersystem.\n\nGESPRÄCHSFÜHRUNG:\n- Sprich immer Deutsch, professionell und warmherzig\n- Halte Antworten kurz (max. 2 Sätze)\n- Frage nur EINE Sache auf einmal\n- Bestätige wichtige Angaben durch Wiederholen\n\nPFLICHTINFORMATIONEN:\n1. Gewünschte Behandlung/Service\n2. Wunschdatum und -uhrzeit\n3. Vollständiger Name des Kunden\n4. Rückrufnummer für Bestätigung",
    advisory: "Du bist eine professionelle KI-Beratungsassistentin.\n\nAUFGABE:\nBeantworte Fragen, qualifiziere Leads und leite komplexe Anfragen weiter.\n\nGESPRÄCHSFÜHRUNG:\n- Professionell, kompetent und vertrauenswürdig\n- Stelle klärende Fragen um den Bedarf zu verstehen\n- Halte Antworten präzise und informativ",
    hr_screening: "Du bist eine KI-Assistentin für HR-Erstgespräche.\n\nAUFGABE:\nFühre strukturierte Erstgespräche mit Kandidaten.\n\nGESPRÄCHSFÜHRUNG:\n- Freundlich und professionell\n- Stelle eine Frage nach der anderen\n- Bestätige und fasse Antworten zusammen",
    hr_onboarding: "Du bist eine digitale Onboarding-Assistentin.\n\nAUFGABE:\nBeantworte Fragen neuer Mitarbeiter zu Einarbeitung und Abläufen.\n\nGESPRÄCHSFÜHRUNG:\n- Hilfsbereit und geduldig\n- Erkläre Prozesse klar und verständlich",
  } as const satisfies Record<string, string>;
  const activeVoices: Voice[] = voices.length > 0 ? voices : fallbackVoices;
  const promptTemplatesDict = (promptTemplates && "type" in promptTemplates && (promptTemplates as { type?: string }).type)
    ? { [(promptTemplates as { type: string }).type]: (promptTemplates as { prompt: string }).prompt }
    : (promptTemplates as Record<string, string>) ?? {};

  const [form, setForm] = useState({
    type: "",
    name: "",
    businessName: "",
    businessHoursOpen: "09:00",
    businessHoursClose: "18:00",
    timezone: "Europe/Berlin",
    voiceId: "",
    voiceName: "",
    language: "de",
    systemPrompt: "",
  });

  const update = (k: Partial<typeof form>) => setForm((f) => ({ ...f, ...k }));

  const handleTypeSelect = (type: string) => {
    const typed = type as AgentType;
    const prompt = promptTemplatesDict[typed] ?? fallbackPromptTemplates[typed] ?? "";
    update({ type: typed, systemPrompt: prompt });
  };

  const handleSubmit = async () => {
    const     agentName = form.name || `${AGENT_TYPES.find((t) => t.id === form.type)?.title} Agent`;
    createAgent.mutate(
      {
        data: {
          name: agentName,
          type: form.type as AgentType,
          businessName: form.businessName || undefined,
          businessHoursOpen: form.businessHoursOpen || undefined,
          businessHoursClose: form.businessHoursClose || undefined,
          timezone: form.timezone,
          voiceId: form.voiceId || undefined,
          voiceName: form.voiceName || undefined,
          language: form.language,
          systemPrompt: form.systemPrompt,
        },
      },
      {
        onSuccess: (agent) => {
          qc.invalidateQueries({ queryKey: getListAgentsQueryKey() });
          toast({ title: "Agent erstellt", description: `${agent.name} wurde erfolgreich erstellt.` });
          setLocation(`/agents/${agent.id}`);
        },
        onError: () => {
          toast({ title: "Fehler", description: "Agent konnte nicht erstellt werden.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <DashboardLayout>
      <TopNav title="Neuer Agent" subtitle="Schritt-für-Schritt Agent erstellen" />

      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">
          {/* Step Indicator */}
          <div className="flex items-center gap-0 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all",
                      step > s.id
                        ? "bg-primary border-primary text-white"
                        : step === s.id
                        ? "border-primary text-primary bg-background"
                        : "border-border text-muted-foreground bg-background"
                    )}
                  >
                    {step > s.id ? <Check size={12} /> : s.id}
                  </div>
                  <span className={cn("text-xs font-medium", step === s.id ? "text-foreground" : "text-muted-foreground")}>
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("flex-1 h-px mx-3 transition-colors", step > s.id ? "bg-primary" : "bg-border")} />
                )}
              </div>
            ))}
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-xs">
            {/* Step 1: Type */}
            {step === 1 && (
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">Was soll Ihr Agent tun?</h2>
                <p className="text-sm text-muted-foreground mb-5">Wählen Sie den passenden Agenten-Typ für Ihr Unternehmen.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AGENT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      data-testid={`card-agent-type-${t.id}`}
                      onClick={() => handleTypeSelect(t.id)}
                      className={cn(
                        "text-left p-4 rounded-xl border-2 transition-all",
                        form.type === t.id ? t.activeColor : "border-border bg-background hover:border-muted-foreground/30"
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground mb-1">{t.title}</p>
                      <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {t.useCases.map((uc) => (
                          <span key={uc} className="text-[10px] bg-background/80 text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                            {uc}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Business */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">Business-Daten</h2>
                  <p className="text-sm text-muted-foreground mb-5">Informationen zu Ihrem Unternehmen</p>
                </div>
                <div>
                  <Label htmlFor="agentName" className="text-xs font-medium">Name des Agenten</Label>
                  <Input
                    id="agentName"
                    data-testid="input-agent-name"
                    className="mt-1.5"
                    placeholder="z.B. Lena – Terminbuchung"
                    value={form.name}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="businessName" className="text-xs font-medium">Unternehmensname</Label>
                  <Input
                    id="businessName"
                    data-testid="input-business-name"
                    className="mt-1.5"
                    placeholder="z.B. Salon Bella München"
                    value={form.businessName}
                    onChange={(e) => update({ businessName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="hoursOpen" className="text-xs font-medium">Öffnung</Label>
                    <Input
                      id="hoursOpen"
                      type="time"
                      className="mt-1.5"
                      value={form.businessHoursOpen}
                      onChange={(e) => update({ businessHoursOpen: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hoursClose" className="text-xs font-medium">Schluss</Label>
                    <Input
                      id="hoursClose"
                      type="time"
                      className="mt-1.5"
                      value={form.businessHoursClose}
                      onChange={(e) => update({ businessHoursClose: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Voice */}
            {step === 3 && (
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">Stimme & Sprache</h2>
                <p className="text-sm text-muted-foreground mb-5">Wie soll Ihr Agent klingen?</p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {activeVoices.map((v) => (
                    <button
                      key={v.id}
                      data-testid={`card-voice-${v.id}`}
                      onClick={() => update({ voiceId: v.id, voiceName: v.name })}
                      className={cn(
                        "text-left p-3.5 rounded-xl border-2 transition-all",
                        form.voiceId === v.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-muted-foreground/30"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground mb-2">
                        {v.name[0]}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.description}</p>
                    </button>
                  ))}
                </div>
                <div>
                  <Label className="text-xs font-medium">Sprachvariante</Label>
                  <div className="flex gap-2 mt-1.5">
                    {[
                      { id: "de", label: "Deutsch (DE)" },
                      { id: "at", label: "Österreich (AT)" },
                      { id: "ch", label: "Schweiz (CH)" },
                    ].map((l) => (
                      <button
                        key={l.id}
                        data-testid={`button-lang-${l.id}`}
                        onClick={() => update({ language: l.id })}
                        className={cn(
                          "flex-1 py-2 rounded-lg border text-xs font-medium transition-all",
                          form.language === l.id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-muted-foreground/50"
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: System Prompt */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">Verhalten & Anweisungen</h2>
                  <p className="text-sm text-muted-foreground">Passen Sie das Verhalten Ihres Agenten an.</p>
                </div>
                <div>
                  <Label htmlFor="systemPrompt" className="text-xs font-medium">System-Prompt</Label>
                  <Textarea
                    id="systemPrompt"
                    data-testid="textarea-system-prompt"
                    className="mt-1.5 font-mono text-xs min-h-52 resize-none"
                    value={form.systemPrompt}
                    onChange={(e) => update({ systemPrompt: e.target.value })}
                    placeholder="Anweisungen für den Agenten..."
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-3 border border-border">
                  <p className="text-xs font-medium text-foreground mb-1">Zusammenfassung</p>
                  <dl className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex gap-2">
                      <dt className="font-medium text-foreground">Typ:</dt>
                      <dd>{AGENT_TYPES.find((t) => t.id === form.type)?.title}</dd>
                    </div>
                    {form.businessName && (
                      <div className="flex gap-2">
                        <dt className="font-medium text-foreground">Unternehmen:</dt>
                        <dd>{form.businessName}</dd>
                      </div>
                    )}
                    {form.voiceName && (
                      <div className="flex gap-2">
                        <dt className="font-medium text-foreground">Stimme:</dt>
                        <dd>{form.voiceName}</dd>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <dt className="font-medium text-foreground">Sprache:</dt>
                      <dd>{form.language.toUpperCase()}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              Zurück
            </Button>
            {step < STEPS.length ? (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={step === 1 && !form.type}
                onClick={() => setStep((s) => s + 1)}
                data-testid="button-next-step"
              >
                Weiter <ChevronRight size={13} />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createAgent.isPending}
                data-testid="button-activate-agent"
              >
                {createAgent.isPending ? "Wird erstellt..." : "Agent aktivieren"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
