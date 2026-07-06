"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Dumbbell, CalendarCheck, Trophy, Medal, Ruler, Target,
  Bell, Settings, LogOut, Shield, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const NAV = [
  { href: "/panel", label: "Panel", icon: LayoutDashboard },
  { href: "/rutinas", label: "Rutinas", icon: Dumbbell },
  { href: "/asistencia", label: "Asistencia", icon: CalendarCheck },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/prs", label: "PRs", icon: Medal },
];

const NAV_EXTRA = [
  { href: "/objetivos", label: "Objetivos", icon: Target },
  { href: "/medidas", label: "Medidas (privado)", icon: Ruler },
  { href: "/perfil", label: "Grupo", icon: Users },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const { data: unread } = api.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const items = [...NAV, ...NAV_EXTRA, ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : [])];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface p-4 md:flex">
      <Link href="/panel" className="mb-6 flex items-center gap-2 px-2 text-xl font-extrabold">
        🏋️ Gym<span className="text-accent">Bros</span>
      </Link>
      <nav className="flex-1 space-y-1">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-accent/10 font-medium text-accent"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {href === "/notificaciones" && (unread ?? 0) > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-xs font-bold text-accent-fg">
                {unread}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
      >
        <LogOut className="h-4 w-4" />
        Salir
      </button>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-[10px]",
            pathname.startsWith(href) ? "text-accent" : "text-muted",
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileHeader() {
  const { data: unread } = api.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:hidden">
      <Link href="/panel" className="text-lg font-extrabold">
        🏋️ Gym<span className="text-accent">Bros</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link href="/notificaciones" className="relative rounded-full p-2 text-muted hover:text-fg">
          <Bell className="h-5 w-5" />
          {(unread ?? 0) > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
          )}
        </Link>
        <Link href="/ajustes" className="rounded-full p-2 text-muted hover:text-fg">
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}
