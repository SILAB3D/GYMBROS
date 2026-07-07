"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus, Square, Timer } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "@/trpc/react";
import { Button, Card, Input, Modal, Spinner, EmptyState } from "@/components/ui";
import { WorkoutLauncher } from "@/components/workout-launcher";
import { cn, MUSCLE_LABELS } from "@/lib/utils";

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: workout, isLoading } = api.workout.active.useQuery();
  const { data: catalog } = api.exercise.list.useQuery();
  const [finishOpen, setFinishOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<string[] | null>(null);

  const invalidate = () => utils.workout.active.invalidate();
  const updateSet = api.workout.updateSet.useMutation({ onSuccess: invalidate });
  const addSet = api.workout.addSet.useMutation({ onSuccess: invalidate });
  const addExercise = api.workout.addExercise.useMutation({
    onSuccess: () => {
      setAddOpen(false);
      invalidate();
    },
  });
  const cancel = api.workout.cancel.useMutation({
    onSuccess: () => {
      utils.invalidate();
      router.push("/panel");
    },
  });
  const finish = api.workout.finish.useMutation({
    onSuccess: (res) => {
      utils.invalidate();
      setFinishOpen(false);
      setResult(res.newPRs);
    },
  });

  if (isLoading) return <Spinner />;

  if (result) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold">¡Entrenamiento guardado!</h1>
        {result.length > 0 ? (
          <div className="space-y-1">
            <p className="font-medium text-gold">Nuevos PRs detectados:</p>
            {result.map((pr) => (
              <p key={pr} className="text-accent">🏆 {pr}</p>
            ))}
          </div>
        ) : (
          <p className="text-muted">+15 puntos para el ranking</p>
        )}
        <Link href="/panel">
          <Button size="lg">Volver al panel</Button>
        </Link>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-8">
        <EmptyState
          icon="🏋️"
          title="No hay ningún entrenamiento en curso"
          subtitle="Registra tu entrenamiento eligiendo una de tus rutinas"
        />
        <WorkoutLauncher />
      </div>
    );
  }

  const grouped = (catalog ?? []).reduce<Record<string, NonNullable<typeof catalog>>>((acc, e) => {
    (acc[e.muscleGroup] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {workout.routine ? `${workout.routine.emoji} ${workout.routine.name}` : "Entrenamiento libre"}
          </h1>
          <p className="flex items-center gap-1 text-sm text-muted">
            <Timer className="h-3.5 w-3.5" />
            Empezado hace {formatDistanceToNowStrict(workout.startedAt, { locale: es })}
          </p>
        </div>
        <Button variant="secondary" size="sm" title="Añadir ejercicio" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Ejercicio</span>
        </Button>
      </div>

      {workout.exercises.map((we) => (
        <Card key={we.id} className="space-y-2">
          <p className="font-semibold">{we.exercise.name}</p>
          <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2 text-xs uppercase text-muted">
            <span>#</span><span>Peso (kg)</span><span>Reps</span><span />
          </div>
          {we.sets.map((s) => (
            <div key={s.id} className="grid grid-cols-[2rem_1fr_1fr_2.5rem] items-center gap-2">
              <span className="text-sm text-muted">{s.setNumber}</span>
              <Input
                type="number" min={0} step="0.5" defaultValue={s.weight || ""}
                placeholder="0"
                onBlur={(e) => updateSet.mutate({ setId: s.id, weight: +e.target.value || 0 })}
              />
              <Input
                type="number" min={0} defaultValue={s.reps || ""}
                placeholder="0"
                onBlur={(e) => updateSet.mutate({ setId: s.id, reps: +e.target.value || 0 })}
              />
              <button
                onClick={() => updateSet.mutate({ setId: s.id, completed: !s.completed })}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition",
                  s.completed ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg",
                )}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => addSet.mutate({ workoutExerciseId: we.id })}>
            <Plus className="h-3.5 w-3.5" /> Añadir serie
          </Button>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button size="lg" className="flex-1" onClick={() => setFinishOpen(true)}>
          <Square className="h-4 w-4" /> Terminar entrenamiento
        </Button>
        <Button
          size="lg"
          variant="danger"
          onClick={() => {
            if (confirm("¿Descartar este entrenamiento? No se guardará nada.")) {
              cancel.mutate({ workoutId: workout.id });
            }
          }}
        >
          Descartar
        </Button>
      </div>

      <Modal open={finishOpen} onClose={() => setFinishOpen(false)} title="Terminar entrenamiento">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Se guardarán las series marcadas como completadas y se detectarán tus nuevos PRs automáticamente.
          </p>
          <Input
            value={notes}
            placeholder="Comentarios (opcional)"
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            size="lg"
            className="w-full"
            loading={finish.isLoading}
            onClick={() => finish.mutate({ workoutId: workout.id, notes: notes || undefined })}
          >
            Guardar y terminar
          </Button>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Añadir ejercicio">
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {Object.entries(grouped).map(([group, exercises]) => (
            <div key={group}>
              <p className="mb-1 text-xs font-semibold uppercase text-muted">
                {MUSCLE_LABELS[group] ?? group}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {exercises.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addExercise.mutate({ workoutId: workout.id, exerciseId: ex.id })}
                    className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm hover:bg-accent/20"
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

