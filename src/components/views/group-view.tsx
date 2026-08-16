"use client";

import Link from "next/link";
import { CalendarRange, Layers, PieChart } from "lucide-react";
import { api } from "@/trpc/react";
import { Card, Spinner, Avatar } from "@/components/ui";
import { cn, MUSCLE_LABELS } from "@/lib/utils";

/** Color de la afinidad por tramos, para leerla de un vistazo. */
function affinityStyle(pct: number) {
  if (pct >= 75) return { text: "text-accent", bar: "bg-accent", label: "Entrenáis igual" };
  if (pct >= 50) return { text: "text-lime-400", bar: "bg-lime-400", label: "Estilo parecido" };
  if (pct >= 25) return { text: "text-amber-400", bar: "bg-amber-400", label: "Algo en común" };
  return { text: "text-red-400", bar: "bg-red-400", label: "Entrenáis distinto" };
}

/** Una de las tres patas de la afinidad. */
function Part({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarRange;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${value}%`}>
      <Icon className="h-3 w-3 shrink-0 text-muted" />
      <span className="text-[10px] text-muted">{label}</span>
      <span className="ml-auto text-[11px] font-semibold tabular-nums">{value}%</span>
    </div>
  );
}

export function GroupView() {
  const { data: users, isLoading } = api.user.list.useQuery();

  if (isLoading) return <Spinner />;

  const myProfileEmpty = users?.some((u) => u.myProfileEmpty) ?? false;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">El grupo</h1>
        <p className="text-sm text-muted">
          La <strong>afinidad de entrenamiento</strong> compara vuestras rutinas: días por semana,
          tamaño de la rutina y reparto por grupo muscular.
        </p>
      </div>

      {myProfileEmpty && (
        <Card className="border-amber-400/40 bg-amber-400/5 py-3 text-sm">
          Crea alguna rutina con ejercicios para poder calcular tu afinidad con el grupo.
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {users?.map((u) => {
          const style = u.affinity ? affinityStyle(u.affinity.total) : null;
          return (
            <Link key={u.id} href={`/perfil/${u.id}`}>
              <Card className="flex flex-col gap-2.5 transition hover:border-accent/40">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} src={u.avatarUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {u.name}
                      {u.isMe && <span className="ml-1.5 text-xs font-normal text-muted">(tú)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {u.currentStreak > 0 && <>🔥 {u.currentStreak} sem. · </>}
                      {u.profile && u.profile.routines > 0
                        ? `${u.profile.weekly} días/sem · ${u.profile.avgExercises} ejercicios · ${u.profile.avgSets} series`
                        : "sin rutinas todavía"}
                    </p>
                  </div>
                  {u.affinity && style && (
                    <div className="shrink-0 text-right">
                      <p className={cn("text-lg font-bold leading-none", style.text)}>
                        {u.affinity.total}%
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted">afinidad</p>
                    </div>
                  )}
                </div>

                {u.affinity && style ? (
                  <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={cn("h-full rounded-full transition-all", style.bar)}
                        style={{ width: `${u.affinity.total}%` }}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Part icon={PieChart} label="Grupos musculares" value={u.affinity.muscles} />
                      <Part icon={CalendarRange} label="Días por semana" value={u.affinity.frequency} />
                      <Part icon={Layers} label="Tamaño de rutina" value={u.affinity.volume} />
                    </div>
                    <p className="text-[11px] text-muted">
                      {style.label}
                      {u.profile?.topMuscle && (
                        <> · entrena sobre todo {MUSCLE_LABELS[u.profile.topMuscle]?.toLowerCase()}</>
                      )}
                    </p>
                  </>
                ) : (
                  !u.isMe && (
                    <p className="text-[11px] text-muted">
                      {(u.profile?.routines ?? 0) === 0
                        ? "Todavía no tiene rutinas con ejercicios"
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
