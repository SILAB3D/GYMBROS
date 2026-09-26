"use client";

import { useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export type PendingExercise = {
  workoutExerciseId: string;
  exercise: string;
  noWeight: boolean;
  sets: Array<{ id: string; setNumber: number; reps: number; weight: number }>;
};

type Draft = { reps: number; weight: number; completed: boolean };

/**
 * Al terminar, las series que se quedaron sin completar: si fue un despiste
 * se marcan aquí mismo. Corregir es una incidencia de la sesión (la única que
 * admite), así que se recalculan totales, PRs y puntos igual que desde el
 * historial.
 */
export function PendingSetsReview({
  workoutId,
  pending,
  onDone,
}: {
  workoutId: string;
  pending: PendingExercise[];
  onDone: (pointsDelta: number | null) => void;
}) {
  const utils = api.useUtils();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      pending.flatMap((we) => we.sets.map((s) => [s.id, { reps: s.reps, weight: s.weight, completed: false }])),
    ),
  );

  const report = api.workout.reportIncident.useMutation({
    onSuccess: (res) => {
      utils.invalidate();
      onDone(res.pointsDelta);
    },
  });

  const marked = Object.entries(drafts).filter(([, d]) => d.completed);
  const edit = (setId: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [setId]: { ...prev[setId]!, ...patch } }));

  return (
    <Card className="w-full max-w-md space-y-4 text-left">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-semibold">
          <TriangleAlert className="h-4 w-4 text-gold" /> Se quedaron sin completar
        </p>
        <p className="text-xs text-muted">
          Si alguna la hiciste y se te olvidó marcarla, márcala con ✓ y corrige los valores. Contará
          como la incidencia de esta sesión: después ya no se podrá volver a corregir.
        </p>
      </div>

      {pending.map((we) => {
        const cols = we.noWeight ? "grid-cols-[2rem_1fr_2.25rem]" : "grid-cols-[2rem_1fr_1fr_2.25rem]";
        return (
          <div key={we.workoutExerciseId} className="space-y-2">
            <p className="text-sm font-medium">
              {we.exercise}
              <span className="ml-2 text-xs font-normal text-muted">
                {we.sets.length} {we.sets.length === 1 ? "serie" : "series"}
              </span>
            </p>
            {we.sets.map((s) => {
              const d = drafts[s.id]!;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "grid items-center gap-2 rounded-xl px-2 py-1.5",
                    cols,
                    d.completed ? "bg-gold/10" : "opacity-60",
                  )}
                >
                  <span className="text-xs text-muted">#{s.setNumber}</span>
                  {!we.noWeight && (
                    <Input
                      type="number" min={0} step="0.5" value={d.weight}
                      aria-label={`Peso de la serie ${s.setNumber} de ${we.exercise}`}
                      onChange={(e) => edit(s.id, { weight: +e.target.value || 0 })}
                    />
                  )}
                  <Input
                    type="number" min={0} value={d.reps}
                    aria-label={`Repeticiones de la serie ${s.setNumber} de ${we.exercise}`}
                    onChange={(e) => edit(s.id, { reps: +e.target.value || 0 })}
                  />
                  <button
                    type="button"
                    aria-label={`Marcar la serie ${s.setNumber} de ${we.exercise} como hecha`}
                    title={d.completed ? "La hice: cuenta" : "No la hice"}
                    onClick={() => edit(s.id, { completed: !d.completed })}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition",
                      d.completed ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg",
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      {report.error && <p className="text-xs text-red-400">No se pudo corregir: {report.error.message}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => onDone(null)}>
          Está bien así
        </Button>
        <Button
          className="flex-1"
          disabled={marked.length === 0}
          loading={report.isLoading}
          onClick={() =>
            report.mutate({
              workoutId,
              reason: "Series sin marcar al terminar el entrenamiento",
              changes: marked.map(([setId, d]) => ({ setId, reps: d.reps, weight: d.weight, completed: true })),
            })
          }
        >
          Corregir {marked.length > 0 ? `(${marked.length})` : ""}
        </Button>
      </div>
    </Card>
  );
}
