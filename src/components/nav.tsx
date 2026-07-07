"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dumbbell, Users, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/panel", label: "Panel", icon: LayoutDashboard, match: /^\/panel/ },
  { href: "/entrenamiento", label: "Entrenamiento", icon: Dumbbell, match: /^\/(entrenamiento|rutinas|entrenar|asistencia|prs)/ },
  { href: "/comunidad", label: "Comunidad", icon: Users, match: /^\/(comunidad|ranking|perfil)/ },
  { href: "/ajustes", label: "Ajustes", icon: Settings, match: /^\/(ajustes|admin)/ },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: unread } = api.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const items = [
    ...NAV.slice(0, 3),
    { href: "/notificaciones", label: "Notificaciones", icon: Bell, match: /^\/notificaciones/ },
    ...NAV.slice(3),
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface p-4 md:flex">
      <Link href="/panel" className="mb-6 flex items-center gap-2 px-2 text-xl font-extrabold">
        <Logo size={28} /> Gym<span className="text-accent">Bros</span>
      </Link>
      <nav className="flex-1 space-y-1">
        {items.map(({ href, label, icon: Icon, match }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              match.test(pathname)
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
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur md:hidden">
      {NAV.map(({ href, label, icon: Icon, match }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-[10px]",
            match.test(pathname) ? "text-accent" : "text-muted",
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
      <Link href="/panel" className="flex items-center gap-2 text-lg font-extrabold">
        <Logo size={24} /> Gym<span className="text-accent">Bros</span>
      </Link>
      <Link href="/notificaciones" className="relative rounded-full p-2 text-muted hover:text-fg">
        <Bell className="h-5 w-5" />
        {(unread ?? 0) > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
        )}
      </Link>
    </header>
  );
}
