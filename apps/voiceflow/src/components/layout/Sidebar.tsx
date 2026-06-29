import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Bot,
  Phone,
  BarChart3,
  Plug,
  CreditCard,
  Settings,
  Zap,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetBillingUsage } from "@workspace/api-client-react";

function UsageFooter() {
  const { data: usage, isLoading } = useGetBillingUsage();
  const minutesUsed = usage?.minutesUsed ?? 0;
  const minutesIncluded = usage?.minutesIncluded ?? 300;
  const plan = usage?.plan ?? "Starter";
  const percent =
    minutesIncluded > 0 ? Math.round((minutesUsed / minutesIncluded) * 100) : 0;

  return (
    <div className="rounded-md bg-sidebar-accent px-3 py-2.5">
      <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wider font-medium mb-0.5">
        {plan} Plan
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-sidebar-foreground/70">
          {isLoading ? "..." : `${minutesUsed} / ${minutesIncluded} Min.`}
        </span>
        <span className="text-xs text-sidebar-primary font-medium">
          {percent}%
        </span>
      </div>
      <div className="mt-1.5 h-1 bg-sidebar-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/agents", icon: Bot, label: "Agenten" },
  { href: "/calls", icon: Phone, label: "Anrufe" },
  { href: "/analytics", icon: BarChart3, label: "Analytik" },
  { href: "/integrations", icon: Plug, label: "Integrationen" },
  { href: "/billing", icon: CreditCard, label: "Abrechnung" },
  { href: "/audit", icon: FileText, label: "Audit-Logs" },
  { href: "/settings", icon: Settings, label: "Einstellungen" },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white" />
        </div>
        <div>
          <span className="text-sidebar-foreground font-semibold text-sm tracking-tight">
            VoiceFlow
          </span>
          <span className="text-sidebar-primary font-semibold text-sm tracking-tight">
            {" "}
            AI
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active =
            href === "/" ? location === "/" : location.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
              )}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon
                size={16}
                className={active ? "text-primary" : "text-current"}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer badge */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <UsageFooter />
      </div>
    </aside>
  );
}
