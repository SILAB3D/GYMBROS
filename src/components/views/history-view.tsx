"use client";

import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, Check } from "lucide-react";
import { api } from "@/trpc/react";
import { Spinner, EmptyState, Badge } from "@/components/ui";
import { formatKg } from "@/lib/utils";

export function HistoryView() {
  const { data: workouts, isLoading } = api.workout.history.useQuery({ limit: 30 });

  if (isLoading) return <Spinner />;

  if (workouts?.length === 0) {
    return <EmptyState icon="📖" title="Aún no hay entrenamientos" subtitle="Cuando termines tu primera sesión aparecerá aquí" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Historial</h1>
      {workouts?.map((w) => (
        <details key={w.id} className="group rounded-2xl border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="font-medium">
                {w.routine ? `${w.routine.emoji} ${w.routine.name}` : "Entrenamiento libre"}
              </p>
              <p className="text-xs capitalize text-muted">
                {format(w.startedAt, "EEEE d MMM yyyy", { locale: es })}
                {w.endedAt ? ` · ${differenceInMinutes(w.endedAt, w.startedAt)} min` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{formatKg(w.totalVolume)}</Badge>
              <Badge>{w.totalSets} series</Badge>
              <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="space-y-3 border-t border-border p-4 pt-3">
            {w.exercises.map((we) => (
              <div key={we.id}>
                <p className="mb-1 text-sm font-medium">{we.exercise.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {we.sets.map((s) => (
                    <span
                      key={s.id}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
                        s.completed ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted line-through"
                      }`}
                    >
                      {s.weight > 0 ? `${s.weight} kg × ` : ""}{s.reps}
                      {s.completed && <Check className="h-3 w-3" />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {w.notes && <p className="text-xs text-muted">📝 {w.notes}</p>}
          </div>
        </details>
      ))}
    </div>
  );
}
