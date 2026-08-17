"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus, Square, Timer, Lock, LockOpen } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "@/trpc/react";
import { Button, Card, Input, Modal, Spinner, EmptyState, ProgressBar } from "@/components/ui";
import { WorkoutLauncher } from "@/components/workout-launcher";
import { RestTimer } from "@/components/rest-timer";
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
  const [locked, setLocked] = useState(false);

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
          <Button size="lg">Volver a inicio</Button>
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

  // Progreso del entrenamiento: series completadas sobre el total
  const totalSets = workout.exercises.reduce((acc, we) => acc + we.sets.length, 0);
  const doneSets = workout.exercises.reduce(
    (acc, we) => acc + we.sets.filter((s) => s.completed).length,
    0,
  );
  const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            {workout.routine ? `${workout.routine.emoji} ${workout.routine.name}` : "Entrenamiento libre"}
          </h1>
          <p className="flex items-center gap-1 text-sm text-muted">
            <Timer className="h-3.5 w-3.5" />
            Empezado hace {formatDistanceToNowStrict(workout.startedAt, { locale: es })}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            variant={locked ? "primary" : "secondary"}
            size="sm"
            title={locked ? "Desbloquear edición" : "Bloquear edición (evita cambios accidentales)"}
            onClick={() => setLocked((v) => !v)}
          >
            {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          </Button>
          {!locked && (
            <Button variant="secondary" size="sm" title="Añadir ejercicio" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Ejercicio</span>
            </Button>
          )}
        </div>
      </div>

      {/* Progreso del entrenamiento: se queda pegado arriba al hacer scroll,
          justo debajo de la cabecera fija del móvil, para no perderlo de vista
          en rutinas largas. El fondo es opaco porque debajo pasa contenido. */}
      <div className="sticky top-[3.5rem] z-30 -mx-4 bg-bg/85 px-4 py-2 backdrop-blur-xl md:top-0 md:-mx-8 md:px-8 md:py-3">
        <Card className="space-y-2 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progreso</span>
            <span className="text-muted">{doneSets}/{totalSets} series · {pct}%</span>
          </div>
          <ProgressBar value={pct} />
        </Card>
      </div>

      <RestTimer />

      {locked ? (
        <p className="flex items-center gap-1.5 text-xs text-accent">
          <Lock className="h-3.5 w-3.5" /> Edición bloqueada: solo puedes marcar series completadas.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Los valores <span className="italic">en gris</span> vienen de tu última sesión; al editarlos o
          completar la serie pasan a esta.
        </p>
      )}

      {workout.exercises.map((we) => {
        // Los ejercicios sin peso solo piden repeticiones: la columna de kg sobra
        const noWeight = we.exercise.noWeight;
        const cols = noWeight
          ? "grid-cols-[2rem_1fr_2.5rem]"
          : "grid-cols-[2rem_1fr_1fr_2.5rem]";
        return (
        <Card key={we.id} className="space-y-2">
          <p className="font-semibold">
            {we.exercise.name}
            {noWeight && <span className="ml-2 text-xs font-normal text-muted">sin peso</span>}
          </p>
          <div className={cn("grid items-center gap-2 text-xs uppercase text-muted", cols)}>
            <span>#</span>{!noWeight && <span>Peso (kg)</span>}<span>Reps</span><span />
          </div>
          {we.sets.map((s) => (
            <div key={s.id} className={cn("grid items-center gap-2", cols)}>
              <span className="text-sm text-muted">{s.setNumber}</span>
              {!noWeight && (
                <Input
                  type="number" min={0} step="0.5" defaultValue={s.weight || ""}
                  placeholder="0"
                  disabled={locked}
                  className={cn(!s.touched && "italic text-muted", locked && "opacity-60")}
                  onBlur={(e) => updateSet.mutate({ setId: s.id, weight: +e.target.value || 0 })}
                />
              )}
              <Input
                type="number" min={0} defaultValue={s.reps || ""}
                placeholder="0"
                disabled={locked}
                className={cn(!s.touched && "italic text-muted", locked && "opacity-60")}
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
          {!locked && (
            <Button size="sm" variant="ghost" onClick={() => addSet.mutate({ workoutExerciseId: we.id })}>
              <Plus className="h-3.5 w-3.5" /> Añadir serie
            </Button>
          )}
        </Card>
        );
      })}

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

      <Modal
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Terminar entrenamiento"
        footer={
          <Button
            size="lg"
            className="w-full"
            loading={finish.isLoading}
            onClick={() => finish.mutate({ workoutId: workout.id, notes: notes || undefined })}
          >
            Guardar y terminar
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Se guardarán las series marcadas como completadas y se detectarán tus nuevos PRs automáticamente.
          </p>
          <Input
            value={notes}
            placeholder="Comentarios (opcional)"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Añadir ejercicio">
        {/* El propio modal limita la altura y hace scroll */}
        <div className="space-y-3">
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
                    {ex.noWeight && <span className="ml-1 text-xs text-muted">· sin peso</span>}
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
