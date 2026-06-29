import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useLocation } from "wouter";
import { Check, ChevronRight } from "lucide-react";
import {
  useCreateAgent,
  getListAgentsQueryKey,
  useListVoices,
  useGetPromptTemplates,
} from "@workspace/api-client-react";
import type { Voice } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type AgentType = "booking" | "advisory" | "hr_screening" | "hr_onboarding";

const STEPS = [
  { id: 1, title: "Agent-Typ" },
  { id: 2, title: "Business-Daten" },
  { id: 3, title: "Stimme & Sprache" },
  { id: 4, title: "Verhalten" },
] as const;

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
    description:
      "Beantwortet Fragen, qualifiziert Leads und leitet Anfragen weiter",
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
    description:
      "Beantwortet Fragen neuer Mitarbeiter zu Einarbeitung und Abläufen",
    useCases: ["Konzerne", "Retail", "Logistik"],
    color: "border-emerald-300 bg-emerald-50/50",
    activeColor: "border-emerald-500 bg-emerald-50",
  },
];

const fallbackPromptTemplates = {
  booking:
    "Du bist eine freundliche KI-Telefonassistentin. Dein Name ist Lena.\n\nAUFGABE:\nNimm Terminanfragen entgegen und buche Termine direkt ins Kalendersystem.\n\nGESPRÄCHSFÜHRUNG:\n- Sprich immer Deutsch, professionell und warmherzig\n- Halte Antworten kurz (max. 2 Sätze)\n- Frage nur EINE Sache auf einmal\n- Bestätige wichtige Angaben durch Wiederholen\n\nPFLICHTINFORMATIONEN:\n1. Gewünschte Behandlung/Service\n2. Wunschdatum und -uhrzeit\n3. Vollständiger Name des Kunden\n4. Rückrufnummer für Bestätigung",
  advisory:
    "Du bist eine professionelle KI-Beratungsassistentin.\n\nAUFGABE:\nBeantworte Fragen, qualifiziere Leads und leite komplexe Anfragen weiter.\n\nGESPRÄCHSFÜHRUNG:\n- Professionell, kompetent und vertrauenswürdig\n- Stelle klärende Fragen um den Bedarf zu verstehen\n- Halte Antworten präzise und informativ",
  hr_screening:
    "Du bist eine KI-Assistentin für HR-Erstgespräche.\n\nAUFGABE:\nFühre strukturierte Erstgespräche mit Kandidaten.\n\nGESPRÄCHSFÜHRUNG:\n- Freundlich und professionell\n- Stelle eine Frage nach der anderen\n- Bestätige und fasse Antworten zusammen",
  hr_onboarding:
    "Du bist eine digitale Onboarding-Assistentin.\n\nAUFGABE:\nBeantworte Fragen neuer Mitarbeiter zu Einarbeitung und Abläufen.\n\nGESPRÄCHSFÜHRUNG:\n- Hilfsbereit und geduldig\n- Erkläre Prozesse klar und verständlich",
} as const satisfies Record<string, string>;

const agentFormSchema = z.object({
  type: z.enum(["booking", "advisory", "hr_screening", "hr_onboarding"]),
  name: z.string().min(1, "Name ist erforderlich"),
  businessName: z.string().optional(),
  businessHoursOpen: z.string().optional(),
  businessHoursClose: z.string().optional(),
  timezone: z.string().optional(),
  voiceId: z.string().min(1, "Bitte wählen Sie eine Stimme"),
  voiceName: z.string().optional(),
  language: z.enum(["de", "at", "ch"]),
  systemPrompt: z.string().min(1, "System-Prompt ist erforderlich"),
  consentRequired: z.boolean().optional(),
});

type AgentFormValues = z.infer<typeof agentFormSchema>;

const STEP_FIELDS: Record<number, (keyof AgentFormValues)[]> = {
  1: ["type"],
  2: [
    "name",
    "businessName",
    "businessHoursOpen",
    "businessHoursClose",
    "timezone",
  ],
  3: ["voiceId", "voiceName", "language"],
  4: ["systemPrompt", "consentRequired"],
};

export default function AgentNewPage() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const createAgent = useCreateAgent();
  const { data: voices = [] } = useListVoices();
  const { data: promptTemplates } = useGetPromptTemplates();

  const fallbackVoices: Voice[] = [
    {
      id: "21m00Tcm4TlvDq8ikWAM",
      name: "Lena",
      description: "Freundlich, warm",
    },
    {
      id: "AZnzlk1XvdvUeBnXmlld",
      name: "Domi",
      description: "Professionell, klar",
    },
    {
      id: "EXAVITQu4vr4xnSDxMaL",
      name: "Bella",
      description: "Sanft, vertrauensvoll",
    },
    {
      id: "ErXwobaYiN019PkySvjV",
      name: "Antoni",
      description: "Ruhig, kompetent",
    },
  ];
  const activeVoices: Voice[] = voices.length > 0 ? voices : fallbackVoices;
  const promptTemplatesDict =
    promptTemplates &&
    "type" in promptTemplates &&
    (promptTemplates as { type?: string }).type
      ? {
          [(promptTemplates as { type: string }).type]: (
            promptTemplates as { prompt: string }
          ).prompt,
        }
      : ((promptTemplates as Record<string, string>) ?? {});

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      type: "" as AgentFormValues["type"],
      name: "",
      businessName: "",
      businessHoursOpen: "09:00",
      businessHoursClose: "18:00",
      timezone: "Europe/Berlin",
      voiceId: "",
      voiceName: "",
      language: "de",
      systemPrompt: "",
      consentRequired: false,
    },
  });

  const watchedType = useWatch({ control: form.control, name: "type" });
  const watchedVoiceId = useWatch({ control: form.control, name: "voiceId" });
  const watchedLanguage = useWatch({ control: form.control, name: "language" });

  const handleTypeSelect = (type: AgentType) => {
    const prompt =
      promptTemplatesDict[type] ?? fallbackPromptTemplates[type] ?? "";
    form.setValue("type", type);
    form.setValue("systemPrompt", prompt);
  };

  const handleVoiceSelect = (voice: Voice) => {
    form.setValue("voiceId", voice.id);
    form.setValue("voiceName", voice.name);
  };

  const handleNext = async () => {
    const fields = STEP_FIELDS[step] || [];
    const isValid = await form.trigger(fields);
    if (isValid) {
      setStep((s) => Math.min(STEPS.length, s + 1));
    }
  };

  const onSubmit = (values: AgentFormValues) => {
    const agentName =
      values.name ||
      `${AGENT_TYPES.find((t) => t.id === values.type)?.title ?? ""} Agent`;
    createAgent.mutate(
      {
        data: {
          name: agentName,
          type: values.type,
          businessName: values.businessName || undefined,
          businessHoursOpen: values.businessHoursOpen || undefined,
          businessHoursClose: values.businessHoursClose || undefined,
          timezone: values.timezone || undefined,
          voiceId: values.voiceId || undefined,
          voiceName: values.voiceName || undefined,
          language: values.language,
          systemPrompt: values.systemPrompt,
          consentRequired: values.consentRequired ?? false,
          consentMethod: "dtmf",
        },
      },
      {
        onSuccess: (agent) => {
          void qc.invalidateQueries({ queryKey: getListAgentsQueryKey() });
          toast({
            title: "Agent erstellt",
            description: `${agent.name} wurde erfolgreich erstellt.`,
          });
          setLocation(`/agents/${agent.id}`);
        },
        onError: () => {
          toast({
            title: "Fehler",
            description: "Agent konnte nicht erstellt werden.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <DashboardLayout>
      <TopNav
        title="Neuer Agent"
        subtitle="Schritt-für-Schritt Agent erstellen"
      />

      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-0 mb-8">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center flex-1 last:flex-none"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all",
                      step > s.id
                        ? "bg-primary border-primary text-white"
                        : step === s.id
                          ? "border-primary text-primary bg-background"
                          : "border-border text-muted-foreground bg-background",
                    )}
                  >
                    {step > s.id ? <Check size={12} /> : s.id}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      step === s.id
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-px mx-3 transition-colors",
                      step > s.id ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-xs">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit(onSubmit)(e);
              }}
            >
              {step === 1 && (
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">
                    Was soll Ihr Agent tun?
                  </h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    Wählen Sie den passenden Agenten-Typ für Ihr Unternehmen.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AGENT_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        data-testid={`card-agent-type-${t.id}`}
                        onClick={() => handleTypeSelect(t.id as AgentType)}
                        className={cn(
                          "text-left p-4 rounded-xl border-2 transition-all",
                          watchedType === t.id
                            ? t.activeColor
                            : "border-border bg-background hover:border-muted-foreground/30",
                        )}
                      >
                        <p className="text-sm font-semibold text-foreground mb-1">
                          {t.title}
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">
                          {t.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {t.useCases.map((uc) => (
                            <span
                              key={uc}
                              className="text-[10px] bg-background/80 text-muted-foreground px-1.5 py-0.5 rounded border border-border"
                            >
                              {uc}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                  {form.formState.errors.type && (
                    <p className="text-sm text-destructive mt-2">
                      {form.formState.errors.type.message}
                    </p>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground mb-1">
                      Business-Daten
                    </h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      Informationen zu Ihrem Unternehmen
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="agentName" className="text-xs font-medium">
                      Name des Agenten
                    </Label>
                    <Input
                      id="agentName"
                      data-testid="input-agent-name"
                      className={cn(
                        "mt-1.5",
                        form.formState.errors.name && "border-destructive",
                      )}
                      placeholder="z.B. Lena – Terminbuchung"
                      {...form.register("name")}
                    />
                    {form.formState.errors.name && (
                      <p className="text-xs text-destructive mt-1">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label
                      htmlFor="businessName"
                      className="text-xs font-medium"
                    >
                      Unternehmensname
                    </Label>
                    <Input
                      id="businessName"
                      data-testid="input-business-name"
                      className="mt-1.5"
                      placeholder="z.B. Salon Bella München"
                      {...form.register("businessName")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label
                        htmlFor="hoursOpen"
                        className="text-xs font-medium"
                      >
                        Öffnung
                      </Label>
                      <Input
                        id="hoursOpen"
                        type="time"
                        className="mt-1.5"
                        {...form.register("businessHoursOpen")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="hoursClose"
                        className="text-xs font-medium"
                      >
                        Schluss
                      </Label>
                      <Input
                        id="hoursClose"
                        type="time"
                        className="mt-1.5"
                        {...form.register("businessHoursClose")}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-1">
                    Stimme & Sprache
                  </h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    Wie soll Ihr Agent klingen?
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {activeVoices.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        data-testid={`card-voice-${v.id}`}
                        onClick={() => handleVoiceSelect(v)}
                        className={cn(
                          "text-left p-3.5 rounded-xl border-2 transition-all",
                          watchedVoiceId === v.id
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background hover:border-muted-foreground/30",
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground mb-2">
                          {v.name[0]}
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {v.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {v.description}
                        </p>
                      </button>
                    ))}
                  </div>
                  {form.formState.errors.voiceId && (
                    <p className="text-sm text-destructive mb-3">
                      {form.formState.errors.voiceId.message}
                    </p>
                  )}
                  <div>
                    <Label className="text-xs font-medium">
                      Sprachvariante
                    </Label>
                    <div className="flex gap-2 mt-1.5">
                      {[
                        { id: "de", label: "Deutsch (DE)" },
                        { id: "at", label: "Österreich (AT)" },
                        { id: "ch", label: "Schweiz (CH)" },
                      ].map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          data-testid={`button-lang-${l.id}`}
                          onClick={() =>
                            form.setValue(
                              "language",
                              l.id as "de" | "at" | "ch",
                            )
                          }
                          className={cn(
                            "flex-1 py-2 rounded-lg border text-xs font-medium transition-all",
                            watchedLanguage === l.id
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground/50",
                          )}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground mb-1">
                      Verhalten & Anweisungen
                    </h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      Passen Sie das Verhalten Ihres Agenten an.
                    </p>
                  </div>
                  <div>
                    <Label
                      htmlFor="systemPrompt"
                      className="text-xs font-medium"
                    >
                      System-Prompt
                    </Label>
                    <Textarea
                      id="systemPrompt"
                      data-testid="textarea-system-prompt"
                      className={cn(
                        "mt-1.5 font-mono text-xs min-h-52 resize-none",
                        form.formState.errors.systemPrompt &&
                          "border-destructive",
                      )}
                      placeholder="Anweisungen für den Agenten..."
                      {...form.register("systemPrompt")}
                    />
                    {form.formState.errors.systemPrompt && (
                      <p className="text-xs text-destructive mt-1">
                        {form.formState.errors.systemPrompt.message}
                      </p>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 border border-border">
                    <p className="text-xs font-medium text-foreground mb-1">
                      Zusammenfassung
                    </p>
                    <dl className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex gap-2">
                        <dt className="font-medium text-foreground">Typ:</dt>
                        <dd>
                          {AGENT_TYPES.find((t) => t.id === watchedType)
                            ?.title ?? "-"}
                        </dd>
                      </div>
                      {form.getValues("businessName") && (
                        <div className="flex gap-2">
                          <dt className="font-medium text-foreground">
                            Unternehmen:
                          </dt>
                          <dd>{form.getValues("businessName")}</dd>
                        </div>
                      )}
                      {form.getValues("voiceName") && (
                        <div className="flex gap-2">
                          <dt className="font-medium text-foreground">
                            Stimme:
                          </dt>
                          <dd>{form.getValues("voiceName")}</dd>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <dt className="font-medium text-foreground">
                          Sprache:
                        </dt>
                        <dd>{watchedLanguage.toUpperCase()}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                    <div>
                      <Label
                        htmlFor="consentRequired"
                        className="text-xs font-medium"
                      >
                        Double-Opt-In Consent (DTMF)
                      </Label>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Anrufer müssen explizit zustimmen (DSGVO)
                      </p>
                    </div>
                    <Controller
                      control={form.control}
                      name="consentRequired"
                      render={({ field }) => (
                        <Switch
                          id="consentRequired"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>
              )}
            </form>
          </div>

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
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={step === 1 && !watchedType}
                onClick={() => void handleNext()}
                data-testid="button-next-step"
              >
                Weiter <ChevronRight size={13} />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={form.handleSubmit(onSubmit)}
                disabled={createAgent.isPending}
                data-testid="button-activate-agent"
              >
                {createAgent.isPending
                  ? "Wird erstellt..."
                  : "Agent aktivieren"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
