import { LogOut } from "lucide-react";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { runMaintenance } from "@/lib/booking/service";
import { isDemo } from "@/lib/config";
import { sqlOne } from "@/lib/db/client";
import { log } from "@/lib/server/log";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  // Fallback, falls kein Cron läuft (gedrosselt auf 1×/Min.)
  await runMaintenance().catch((err) => log.error("wartung fehlgeschlagen", err));
  const pending = await sqlOne<{ n: number }>("select count(*)::int as n from bookings where status = 'pending' and not awaiting_customer and hold_expires_at > now()");
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/95 px-4 backdrop-blur">
        <Link href="/admin" className="font-display text-lg">Admin</Link>
        <div className="flex items-center gap-3">
          {isDemo && <span className="rounded bg-amber-900/60 px-2 py-0.5 text-xs text-amber-200">Demo-Modus</span>}
          <Link href="/" className="text-sm text-muted hover:text-fg">Website</Link>
          <form action={logoutAction}>
            <button type="submit" className="flex items-center gap-1 text-sm text-muted hover:text-fg"><LogOut aria-hidden size={16} /> Abmelden</button>
          </form>
        </div>
      </header>
      <div className="lg:flex">
        <AdminNav pendingCount={pending?.n ?? 0} />
        <main id="main" className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
