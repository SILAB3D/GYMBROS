"use client";

import { useMemo, useState } from "react";
import { Check, Plus, TriangleAlert, X } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Input, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Una serie tal y como quedó guardada, más el ejercicio al que pertenece. */
type Session = {
  id: string;
  exercises: Array<{
    id: string;
    exercise: { name: string; noWeight: boolean };
    sets: Array<{ id: string; setNumber: number; reps: number; weight: number; completed: boolean }>;
  }>;
};

type Draft = { reps: number; weight: number; completed: boolean };
/** Serie que faltaba y se apunta ahora, todavía sin guardar. */
type NewSet = { key: string; workoutExerciseId: string; reps: number; weight: number };

/**
 * Incidencia: corregir lo que se anotó mal en una sesión ya guardada.
 *
 * Se puede repasar el entrenamiento entero —valores, series que se hicieron y
 * se quedaron sin marcar y series que ni siquiera se apuntaron— pero una sola
 * vez: al guardar, esta sesión queda cerrada a más correcciones. El servidor
 * recalcula totales, PRs y puntos, de ahí que el aviso diga que el ranking
 * puede moverse.
 */
export function WorkoutIncidentModal({
  workout,
  open,
  onClose,
}: {
  workout: Session;
  open: boolean;
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [added, setAdded] = useState<NewSet[]>([]);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<{ pointsDelta: number; newPRs: string[]; removedPRs: number } | null>(null);

  const original = useMemo(() => {
    const map = new Map<string, Draft>();
    for (const we of workout.exercises) {
      for (const s of we.sets) map.set(s.id, { reps: s.reps, weight: s.weight, completed: s.completed });
    }
    return map;
  }, [workout]);

  // Una serie tocada cuenta como una corrección, aunque se le cambie todo
  const changed = Object.entries(drafts).filter(([setId, d]) => {
    const o = original.get(setId);
    return o && (o.reps !== d.reps || o.weight !== d.weight || o.completed !== d.completed);
  });
  const total = changed.length + added.length;

  const report = api.workout.reportIncident.useMutation({
    onSuccess: (res) => {
      // Una corrección mueve volumen, PRs, puntos y ranking: se refresca todo
      utils.invalidate();
      setDone({ pointsDelta: res.pointsDelta, newPRs: res.newPRs, removedPRs: res.removedPRs });
    },
  });

  const close = () => {
    setDrafts({});
    setAdded([]);
    setReason("");
    setDone(null);
    report.reset();
    onClose();
  };

  const edit = (setId: string, patch: Partial<Draft>) =>
    setDrafts((prev) => {
      const base = prev[setId] ?? original.get(setId) ?? { reps: 0, weight: 0, completed: false };
      return { ...prev, [setId]: { ...base, ...patch } };
    });

  const editNew = (key: string, patch: Partial<NewSet>) =>
    setAdded((prev) => prev.map((n) => (n.key === key ? { ...n, ...patch } : n)));

  if (done) {
    return (
      <Modal open={open} onClose={close} title="Incidencia registrada" footer={
        <Button className="w-full" onClick={close}>Cerrar</Button>
      }>
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            La sesión queda corregida y sus totales recalculados. Era su única incidencia: ya no se
            puede volver a corregir.
          </p>
          {done.removedPRs > 0 && (
            <p>Se retiraron {done.removedPRs} récord{done.removedPRs === 1 ? "" : "s"} automático{done.removedPRs === 1 ? "" : "s"} que dependían de esos valores.</p>
          )}
          {done.newPRs.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium text-gold">PRs recalculados:</p>
              {done.newPRs.map((pr) => <p key={pr} className="text-accent">🏆 {pr}</p>)}
            </div>
          )}
          <p className={cn("font-medium", done.pointsDelta < 0 ? "text-red-400" : "text-accent")}>
            {done.pointsDelta === 0
              ? "Tus puntos no cambian."
              : done.pointsDelta > 0
                ? `+${done.pointsDelta} puntos ajustados a tu favor.`
                : `${done.pointsDelta} puntos retirados.`}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Incidencia en la sesión"
      subtitle="Repasa la sesión entera si hace falta. Solo se puede una vez"
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted">
            {total} {total === 1 ? "serie" : "series"}
          </span>
          <Button
            className="flex-1"
            loading={report.isLoading}
            disabled={total === 0}
            onClick={() =>
              report.mutate({
                workoutId: workout.id,
                reason: reason || undefined,
                changes: changed.map(([setId, d]) => ({
                  setId,
                  reps: d.reps,
                  weight: d.weight,
                  completed: d.completed,
                })),
                additions: added.map((n) => ({
                  workoutExerciseId: n.workoutExerciseId,
                  reps: n.reps,
                  weight: n.weight,
                  completed: true,
                })),
              })
            }
          >
            Corregir y recalcular
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-muted">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          Al corregir se recalculan el volumen de la sesión, los récords automáticos que salieron de
          ella y los puntos que dieron. Tu posición en el ranking puede cambiar.
        </p>

        <p className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-xs text-gold">
          Cada entrenamiento admite una única incidencia: deja todas las series como fueron de
          verdad antes de guardar, porque después esta sesión ya no se podrá volver a corregir
          (solo borrar el día entero desde el historial).
        </p>

        <p className="text-xs text-muted">
          El ✓ marca si la serie cuenta: enciéndelo en las que hiciste y se quedaron sin apuntar,
          apágalo en las que no llegaste a hacer. Si falta una serie entera, añádela.
        </p>

        {workout.exercises.map((we) => {
          const cols = we.exercise.noWeight
            ? "grid-cols-[2rem_1fr_2.25rem]"
            : "grid-cols-[2rem_1fr_1fr_2.25rem]";
          const lastNumber = we.sets.reduce((max, s) => Math.max(max, s.setNumber), 0);
          const newSets = added.filter((n) => n.workoutExerciseId === we.id);
          return (
            <div key={we.id} className="space-y-2">
              <p className="text-sm font-medium">
                {we.exercise.name}
                {we.exercise.noWeight && <span className="ml-2 text-xs font-normal text-muted">sin peso</span>}
              </p>
              {we.sets.map((s) => {
                const d = drafts[s.id] ?? { reps: s.reps, weight: s.weight, completed: s.completed };
                const o = original.get(s.id)!;
                const dirty = o.reps !== d.reps || o.weight !== d.weight || o.completed !== d.completed;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "grid items-center gap-2 rounded-xl px-2 py-1.5",
                      cols,
                      dirty && "bg-gold/10",
                      !d.completed && "opacity-60",
                    )}
                  >
                    <span className="text-xs text-muted">#{s.setNumber}</span>
                    {!we.exercise.noWeight && (
                      <Input
                        type="number" min={0} step="0.5" value={d.weight}
                        aria-label={`Peso de la serie ${s.setNumber} de ${we.exercise.name}`}
                        onChange={(e) => edit(s.id, { weight: +e.target.value || 0 })}
                      />
                    )}
                    <Input
                      type="number" min={0} value={d.reps}
                      aria-label={`Repeticiones de la serie ${s.setNumber} de ${we.exercise.name}`}
                      onChange={(e) => edit(s.id, { reps: +e.target.value || 0 })}
                    />
                    <button
                      type="button"
                      aria-label={`La serie ${s.setNumber} de ${we.exercise.name} ${d.completed ? "cuenta" : "no cuenta"}`}
                      title={d.completed ? "Cuenta en la sesión" : "No se hizo: no cuenta"}
                      onClick={() => edit(s.id, { completed: !d.completed })}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition",
                        d.completed
                          ? "bg-accent text-accent-fg"
                          : "bg-surface-2 text-muted hover:text-fg",
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              {newSets.map((n, i) => (
                <div
                  key={n.key}
                  className={cn("grid items-center gap-2 rounded-xl bg-accent/10 px-2 py-1.5", cols)}
                >
                  <span className="text-xs text-accent">#{lastNumber + i + 1}</span>
                  {!we.exercise.noWeight && (
                    <Input
                      type="number" min={0} step="0.5" value={n.weight}
                      aria-label={`Peso de la serie añadida a ${we.exercise.name}`}
                      onChange={(e) => editNew(n.key, { weight: +e.target.value || 0 })}
                    />
                  )}
                  <Input
                    type="number" min={0} value={n.reps}
                    aria-label={`Repeticiones de la serie añadida a ${we.exercise.name}`}
                    onChange={(e) => editNew(n.key, { reps: +e.target.value || 0 })}
                  />
                  <button
                    type="button"
                    aria-label="Quitar la serie añadida"
                    title="Quitar esta serie"
                    onClick={() => setAdded((prev) => prev.filter((x) => x.key !== n.key))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-muted transition hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setAdded((prev) => [
                    ...prev,
                    {
                      key: `${we.id}-${Date.now()}`,
                      workoutExerciseId: we.id,
                      reps: we.sets[we.sets.length - 1]?.reps ?? 10,
                      weight: we.exercise.noWeight ? 0 : we.sets[we.sets.length - 1]?.weight ?? 0,
                    },
                  ])
                }
                className="flex items-center gap-1 px-2 text-xs text-muted transition hover:text-accent"
              >
                <Plus className="h-3.5 w-3.5" /> Añadir una serie que falta
              </button>
            </div>
          );
        })}

        <Input
          value={reason}
          maxLength={200}
          placeholder="Qué pasó (opcional): anoté 18 en vez de 10…"
          onChange={(e) => setReason(e.target.value)}
        />

        {report.error && (
          <p className="text-xs text-red-400">No se pudo aplicar: {report.error.message}</p>
        )}
      </div>
    </Modal>
  );
}
