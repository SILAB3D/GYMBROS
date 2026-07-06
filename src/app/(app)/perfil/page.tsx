"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { Card, Spinner, Avatar } from "@/components/ui";

export default function GroupPage() {
  const { data: users, isLoading } = api.user.list.useQuery();

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">El grupo</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {users?.map((u) => (
          <Link key={u.id} href={`/perfil/${u.id}`}>
            <Card className="flex items-center gap-3 transition hover:border-accent/40">
              <Avatar name={u.name} src={u.avatarUrl} size={44} />
              <div>
                <p className="font-medium">{u.name}</p>
                {u.currentStreak > 0 && (
                  <p className="text-xs text-muted">🔥 racha de {u.currentStreak} días</p>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
