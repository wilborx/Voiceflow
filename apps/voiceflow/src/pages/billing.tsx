import { Check, Zap } from "lucide-react";
import {
  useGetBillingPlans,
  useGetBillingUsage,
  useCreateCheckout,
  getGetBillingPlansQueryKey,
  getGetBillingUsageQueryKey,
} from "@workspace/api-client-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TopNav from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function BillingPage() {
  const { data: plans, isLoading: plansLoading } = useGetBillingPlans({ query: { queryKey: getGetBillingPlansQueryKey() } });
  const { data: usage, isLoading: usageLoading } = useGetBillingUsage({ query: { queryKey: getGetBillingUsageQueryKey() } });
  const createCheckout = useCreateCheckout();
  const { toast } = useToast();

  const handleUpgrade = (planKey: string) => {
    createCheckout.mutate(
      { data: { planKey, email: "user@example.com" } },
      {
        onSuccess: (result) => {
          window.open(result.checkoutUrl, "_blank");
        },
        onError: () => {
          toast({ title: "Fehler", description: "Checkout konnte nicht geöffnet werden.", variant: "destructive" });
        },
      }
    );
  };

  const usagePercent = usage ? Math.round((usage.minutesUsed / usage.minutesIncluded) * 100) : 0;

  const statusLabel: Record<string, string> = {
    trialing: "Testphase",
    active: "Aktiv",
    past_due: "Zahlung ausstehend",
    canceled: "Gekündigt",
  };

  return (
    <DashboardLayout>
      <TopNav title="Abrechnung" subtitle="Tarife, Nutzung und Subscription" />

      <div className="flex-1 p-6 space-y-6">
        {/* Current Usage */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-xs">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Aktuelle Nutzung</h2>
              {usageLoading ? (
                <Skeleton className="h-4 w-24 mt-1" />
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {statusLabel[usage?.subscriptionStatus ?? "trialing"] ?? usage?.subscriptionStatus} ·{" "}
                  <span className="font-medium capitalize">{usage?.plan}</span>
                </p>
              )}
            </div>
          </div>

          {usageLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Minuten verbraucht</span>
                <span className="text-xs font-semibold text-foreground">
                  {usage?.minutesUsed} / {usage?.minutesIncluded} Min.
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    usagePercent > 80 ? "bg-red-500" : usagePercent > 60 ? "bg-amber-500" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(100, usagePercent)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{usagePercent}% verbraucht</p>
            </div>
          )}
        </div>

        {/* Plans */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Tarife</h2>
          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(plans ?? []).map((plan, i) => {
                const isCurrent = plan.key === usage?.plan;
                const isPopular = i === 1;
                return (
                  <div
                    key={plan.key}
                    data-testid={`card-plan-${plan.key}`}
                    className={cn(
                      "relative bg-card border rounded-xl p-5 shadow-xs flex flex-col",
                      isPopular ? "border-primary ring-1 ring-primary/20" : "border-card-border"
                    )}
                  >
                    {isPopular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary text-white rounded-full text-[10px] font-semibold">
                          <Zap size={9} /> Empfohlen
                        </span>
                      </div>
                    )}

                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-bold text-foreground">€{plan.priceEuros}</span>
                        <span className="text-xs text-muted-foreground">/Monat</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {plan.minutes.toLocaleString("de-DE")} Min. · max. {plan.maxAgents} Agent{plan.maxAgents > 1 ? "en" : ""}
                      </p>
                    </div>

                    <ul className="space-y-2 flex-1 mb-5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Check size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full h-8 text-xs"
                      variant={isCurrent ? "outline" : isPopular ? "default" : "outline"}
                      disabled={isCurrent || createCheckout.isPending}
                      onClick={() => !isCurrent && handleUpgrade(plan.key)}
                      data-testid={`button-upgrade-${plan.key}`}
                    >
                      {isCurrent ? "Aktueller Tarif" : "Tarif wählen"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Alle Preise zzgl. MwSt. SEPA-Lastschrift und Kreditkarte verfügbar. 14 Tage kostenlos testen.
        </p>
      </div>
    </DashboardLayout>
  );
}
