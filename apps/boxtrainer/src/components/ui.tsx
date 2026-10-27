import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  secondary: "border border-line bg-surface-2 text-fg hover:border-muted",
  ghost: "text-muted hover:text-fg",
  danger: "border border-red-900 bg-red-950/60 text-red-200 hover:bg-red-900/60",
};
const SIZES = { sm: "min-h-9 px-3 text-sm", md: "min-h-11 px-5 text-sm", lg: "min-h-13 px-7 text-base" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md", extra?: string): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button className={buttonClass(variant, size, className)} {...p} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <Link className={buttonClass(variant, size, className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-xl border border-line bg-surface p-5", className)} {...p} />;
}

const BADGE: Record<string, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent/15 text-red-200 border-accent/40",
  ok: "bg-green-950 text-green-300 border-green-900",
  warn: "bg-amber-950 text-amber-300 border-amber-900",
  bad: "bg-red-950 text-red-300 border-red-900",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", BADGE[tone])}>{children}</span>;
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-base text-fg placeholder:text-zinc-500 focus:border-accent focus:outline-none aria-[invalid=true]:border-red-500";

export function Field({ label, hint, error, htmlFor, children, required }: { label: string; hint?: ReactNode; error?: string; htmlFor: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>}
      <h2 className="font-display text-4xl leading-none sm:text-5xl">{title}</h2>
      {intro && <p className="mt-4 text-muted">{intro}</p>}
    </div>
  );
}

/** Platzhalter für echte Fotos (keine Stockbilder). Ersetzen durch next/image. */
export function PhotoPlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Platzhalter: ${label}`}
      className={cx(
        "relative flex items-end overflow-hidden rounded-2xl border border-line bg-[radial-gradient(circle_at_30%_20%,#2a2a2e,#0b0b0c_70%)]",
        className,
      )}
    >
      <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(135deg,transparent,transparent_12px,#ffffff10_12px,#ffffff10_13px)]" />
      <span className="relative m-4 rounded bg-black/60 px-2 py-1 text-xs uppercase tracking-widest text-muted">Foto: {label}</span>
    </div>
  );
}

export function formatPrice(cents: number | null, perLabel?: string): string {
  if (cents === null) return "Preis auf Anfrage";
  if (cents === 0) return "Kostenlos";
  const v = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  return perLabel ? `${v} ${perLabel}` : v;
}
