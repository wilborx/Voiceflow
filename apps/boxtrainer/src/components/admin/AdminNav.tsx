"use client";

import { BarChart3, CalendarDays, Inbox, Mail, Settings, Tag, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../ui";

const ITEMS = [
  { href: "/admin", label: "Anfragen", icon: Inbox },
  { href: "/admin/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/admin/termine", label: "Gruppen", icon: UsersRound },
  { href: "/admin/kunden", label: "Kunden", icon: Users },
  { href: "/admin/angebote", label: "Angebote", icon: Tag },
  { href: "/admin/statistik", label: "Statistik", icon: BarChart3 },
  { href: "/admin/nachrichten", label: "Nachrichten", icon: Mail },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: Settings },
];

export function AdminNav({ pendingCount }: { pendingCount: number }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <>
      {/* Desktop: Seitenleiste */}
      <nav aria-label="Admin" className="hidden w-56 shrink-0 border-r border-line p-4 lg:block">
        <ul className="space-y-1">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} aria-current={active(href) ? "page" : undefined} className={cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm", active(href) ? "bg-surface-2 font-semibold text-fg" : "text-muted hover:text-fg")}>
                <Icon aria-hidden size={18} />
                {label}
                {href === "/admin" && pendingCount > 0 && <span className="ml-auto rounded-full bg-accent px-2 text-xs font-bold text-white">{pendingCount}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Mobile: horizontale Leiste */}
      <nav aria-label="Admin mobil" className="sticky top-14 z-30 overflow-x-auto border-b border-line bg-bg/95 backdrop-blur lg:hidden">
        <ul className="flex gap-1 px-2 py-2">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} aria-current={active(href) ? "page" : undefined} className={cx("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm", active(href) ? "bg-surface-2 font-semibold" : "text-muted")}>
                <Icon aria-hidden size={16} />
                {label}
                {href === "/admin" && pendingCount > 0 && <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-white">{pendingCount}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
