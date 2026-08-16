"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { api } from "@/trpc/react";
import { Card, Spinner, Avatar } from "@/components/ui";

/**
 * Miembros del grupo en una rejilla sencilla de dos columnas. El detalle de
 * cada uno —incluida la afinidad de entrenamiento— vive en su perfil.
 */
export function GroupView() {
  const { data: users, isLoading } = api.user.list.useQuery();

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">El grupo</h1>
        <p className="text-sm text-muted">
          Pulsa un miembro para ver su perfil y vuestra afinidad de entrenamiento.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {users?.map((u) => (
          <Link key={u.id} href={`/perfil/${u.id}`}>
            <Card className="flex h-full items-center gap-3 transition hover:border-accent/40">
              <Avatar name={u.name} src={u.avatarUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {u.name}
                  {u.isMe && <span className="ml-1.5 text-xs font-normal text-muted">(tú)</span>}
                </p>
                {u.currentStreak > 0 && (
                  <p className="truncate text-xs text-muted">🔥 racha de {u.currentStreak} sem.</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
