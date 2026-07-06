"use client";

import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCheck } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@prisma/client";

const FILTERS: Array<{ key: NotificationType | "ALL"; label: string }> = [
  { key: "ALL", label: "Todas" },
  { key: "FRIEND_PR", label: "PRs del grupo" },
  { key: "STREAK", label: "Rachas" },
  { key: "SYSTEM", label: "Sistema" },
];

export default function NotificationsPage() {
  const utils = api.useUtils();
  const [filter, setFilter] = useState<NotificationType | "ALL">("ALL");
  const { data: notifications, isLoading } = api.notification.list.useQuery({
    type: filter === "ALL" ? undefined : filter,
    limit: 50,
  });
  const markRead = api.notification.markRead.useMutation({
    onSuccess: () => utils.notification.invalidate(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notificaciones</h1>
        <Button variant="secondary" size="sm" onClick={() => markRead.mutate({})}>
          <CheckCheck className="h-4 w-4" /> Marcar todas leídas
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition",
              filter === f.key ? "bg-accent font-medium text-accent-fg" : "bg-surface text-muted hover:text-fg",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : notifications?.length === 0 ? (
        <EmptyState icon="🔔" title="Nada por aquí" subtitle="Cuando pase algo en el grupo, lo verás aquí" />
      ) : (
        <div className="space-y-2">
          {notifications?.map((n) => (
            <Card
              key={n.id}
              className={cn("cursor-pointer py-3 transition", !n.read && "border-accent/30 bg-accent/5")}
              onClick={() => !n.read && markRead.mutate({ id: n.id })}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                  {n.body && <p className="text-xs text-muted">{n.body}</p>}
                </div>
                <span className="whitespace-nowrap text-xs text-muted">
                  hace {formatDistanceToNowStrict(n.createdAt, { locale: es })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
