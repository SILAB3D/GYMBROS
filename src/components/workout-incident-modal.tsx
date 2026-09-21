"use client";

import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Input, Modal } from "@/components/ui";
import { cn, MAX_INCIDENT_CHANGES } from "@/lib/utils";

/** Una serie tal y como quedó guardada, más el ejercicio al que pertenece. */
type Session = {
  id: string;
  exercises: Array<{
    id: string;
    exercise: { name: string; noWeight: boolean };
    sets: Array<{ id: string; setNumber: number; reps: number; weight: number; completed: boolean }>;
  }>;
};

type Draft = { reps: number; weight: number };

/**
 * Incidencia: corregir valores mal anotados de una sesión ya guardada.
 *
 * Solo deja tocar cuatro valores (peso y reps de una misma serie cuentan como
 * uno): es para la errata del 18 que era 10, no para rehacer el entreno. Al
 * guardar, el servidor recalcula totales, PRs y puntos —de ahí que el aviso
 * diga que el ranking puede moverse.
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
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<{ pointsDelta: number; newPRs: string[]; removedPRs: number } | null>(null);

  const original = useMemo(() => {
    const map = new Map<string, Draft>();
    for (const we of workout.exercises) {
      for (const s of we.sets) map.set(s.id, { reps: s.reps, weight: s.weight });
    }
    return map;
  }, [workout]);

  // Una serie tocada cuenta como un valor, aunque se le cambien peso y reps
  const changed = Object.entries(drafts).filter(([setId, d]) => {
    const o = original.get(setId);
    return o && (o.reps !== d.reps || o.weight !== d.weight);
  });
  const tooMany = changed.length > MAX_INCIDENT_CHANGES;

  const report = api.workout.reportIncident.useMutation({
    onSuccess: (res) => {
      // Una corrección mueve volumen, PRs, puntos y ranking: se refresca todo
      utils.invalidate();
      setDone({ pointsDelta: res.pointsDelta, newPRs: res.newPRs, removedPRs: res.removedPRs });
    },
  });

  const close = () => {
    setDrafts({});
    setReason("");
    setDone(null);
    report.reset();
    onClose();
  };

  const edit = (setId: string, field: keyof Draft, value: number) =>
    setDrafts((prev) => {
      const base = prev[setId] ?? original.get(setId) ?? { reps: 0, weight: 0 };
      return { ...prev, [setId]: { ...base, [field]: value } };
    });

  if (done) {
    return (
      <Modal open={open} onClose={close} title="Incidencia registrada" footer={
        <Button className="w-full" onClick={close}>Cerrar</Button>
      }>
        <div className="space-y-3 text-sm">
          <p className="text-muted">La sesión queda corregida y sus totales recalculados.</p>
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
      subtitle={`Corrige hasta ${MAX_INCIDENT_CHANGES} valores mal anotados`}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className={cn("text-xs", tooMany ? "text-red-400" : "text-muted")}>
            {changed.length}/{MAX_INCIDENT_CHANGES}
          </span>
          <Button
            className="flex-1"
            loading={report.isLoading}
            disabled={changed.length === 0 || tooMany}
            onClick={() =>
              report.mutate({
                workoutId: workout.id,
                reason: reason || undefined,
                changes: changed.map(([setId, d]) => ({ setId, reps: d.reps, weight: d.weight })),
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

        {tooMany && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-400">
            Solo se pueden corregir {MAX_INCIDENT_CHANGES} valores por incidencia. Deja el resto como
            estaban o borra el día entero desde el historial.
          </p>
        )}

        {workout.exercises.map((we) => (
          <div key={we.id} className="space-y-2">
            <p className="text-sm font-medium">
              {we.exercise.name}
              {we.exercise.noWeight && <span className="ml-2 text-xs font-normal text-muted">sin peso</span>}
            </p>
            {we.sets.map((s) => {
              const d = drafts[s.id] ?? { reps: s.reps, weight: s.weight };
              const o = original.get(s.id)!;
              const dirty = o.reps !== d.reps || o.weight !== d.weight;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "grid items-center gap-2 rounded-xl px-2 py-1.5",
                    we.exercise.noWeight ? "grid-cols-[2rem_1fr]" : "grid-cols-[2rem_1fr_1fr]",
                    dirty && "bg-gold/10",
                    !s.completed && "opacity-50",
                  )}
                >
                  <span className="text-xs text-muted">#{s.setNumber}</span>
                  {!we.exercise.noWeight && (
                    <Input
                      type="number" min={0} step="0.5" value={d.weight}
                      aria-label={`Peso de la serie ${s.setNumber} de ${we.exercise.name}`}
                      onChange={(e) => edit(s.id, "weight", +e.target.value || 0)}
                    />
                  )}
                  <Input
                    type="number" min={0} value={d.reps}
                    aria-label={`Repeticiones de la serie ${s.setNumber} de ${we.exercise.name}`}
                    onChange={(e) => edit(s.id, "reps", +e.target.value || 0)}
                  />
                </div>
              );
            })}
          </div>
        ))}

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
