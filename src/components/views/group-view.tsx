"use client";

import Link from "next/link";
import { api } from "@/trpc/react";
import { Card, Spinner, Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Color de la afinidad por tramos, para leerla de un vistazo. */
function affinityStyle(pct: number) {
  if (pct >= 60) return { text: "text-accent", bar: "bg-accent", label: "Entrenáis casi igual" };
  if (pct >= 30) return { text: "text-lime-400", bar: "bg-lime-400", label: "Bastante en común" };
  if (pct >= 10) return { text: "text-amber-400", bar: "bg-amber-400", label: "Algo en común" };
  return { text: "text-muted", bar: "bg-muted", label: "Rutinas distintas" };
}

export function GroupView() {
  const { data: users, isLoading } = api.user.list.useQuery();

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">El grupo</h1>
        <p className="text-sm text-muted">
          La afinidad compara los ejercicios de vuestras rutinas: cuántos coincidís sobre el
          total que entrenáis entre los dos.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {users?.map((u) => {
          const style = u.affinity !== null ? affinityStyle(u.affinity) : null;
          return (
            <Link key={u.id} href={`/perfil/${u.id}`}>
              <Card className="flex flex-col gap-2 transition hover:border-accent/40">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} src={u.avatarUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {u.name}
                      {u.isMe && <span className="ml-1.5 text-xs font-normal text-muted">(tú)</span>}
                    </p>
                    {u.currentStreak > 0 && (
                      <p className="text-xs text-muted">🔥 racha de {u.currentStreak} sem.</p>
                    )}
                  </div>
                  {u.affinity !== null && style && (
                    <div className="shrink-0 text-right">
                      <p className={cn("text-lg font-bold leading-none", style.text)}>{u.affinity}%</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted">afinidad</p>
                    </div>
                  )}
                </div>

                {u.affinity !== null && style ? (
                  <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={cn("h-full rounded-full transition-all", style.bar)}
                        style={{ width: `${u.affinity}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted">
                      {style.label} · {u.commonExercises}{" "}
                      {u.commonExercises === 1 ? "ejercicio en común" : "ejercicios en común"}
                    </p>
                  </>
                ) : (
                  !u.isMe && (
                    <p className="text-[11px] text-muted">
                      {u.exerciseCount === 0
                        ? "Todavía no tiene ejercicios en sus rutinas"
                        : "Añade ejercicios a tus rutinas para ver la afinidad"}
                    </p>
                  )
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
