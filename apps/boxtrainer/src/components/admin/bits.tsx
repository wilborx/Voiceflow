import type { ReactNode } from "react";
import type { BookingStatus } from "@/lib/availability/types";
import { STATUS_LABELS } from "@/lib/db/types";
import { Badge } from "../ui";

export function StatusBadge({ status, awaiting }: { status: BookingStatus; awaiting?: boolean }) {
  if (awaiting && status === "pending") return <Badge tone="warn">Wartet auf Kunde</Badge>;
  const tone = ({ pending: "warn", confirmed: "ok", completed: "neutral", no_show: "bad", declined: "neutral", expired: "neutral", cancelled: "neutral" } as const)[status];
  return <Badge tone={tone}>{STATUS_LABELS[status]}</Badge>;
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
      {children}
    </div>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p role={error ? "alert" : "status"} className={error ? "mb-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200" : "mb-4 rounded-lg border border-green-900 bg-green-950/50 p-3 text-sm text-green-200"}>
      {error ?? ok}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</p>;
}
