"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trophy, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Modal, Spinner, EmptyState, Badge } from "@/components/ui";
import { MUSCLE_LABELS } from "@/lib/utils";

// Recharts se carga solo cuando hace falta la gráfica (reduce ~100 kB la carga inicial)
const PrHistoryChart = dynamic(() => import("@/components/charts/pr-history-chart"), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-xl bg-surface-2" />,
});

export function PRsView() {
  const utils = api.useUtils();
  const { data: bests, isLoading } = api.pr.bests.useQuery();
  const { data: recent } = api.pr.recent.useQuery({ limit: 15 });
  const { data: catalog } = api.exercise.list.useQuery();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [form, setForm] = useState({ exerciseId: "", weight: "", reps: "1", notes: "" });

  const { data: history } = api.pr.history.useQuery(
    { exerciseId: selectedExercise ?? "" },
    { enabled: !!selectedExercise },
  );

  const create = api.pr.create.useMutation({
    onSuccess: () => {
      utils.pr.invalidate();
      setAddOpen(false);
      setForm({ exerciseId: "", weight: "", reps: "1", notes: "" });
    },
  });
  // Borrado optimista: el PR desaparece de la lista al instante
  const remove = api.pr.delete.useMutation({
    onMutate: async ({ id }) => {
      const recentInput = { limit: 15 } as const;
      await Promise.all([utils.pr.recent.cancel(recentInput), utils.pr.bests.cancel()]);
      const prevRecent = utils.pr.recent.getData(recentInput);
      const prevBests = utils.pr.bests.getData();
      if (prevRecent) utils.pr.recent.setData(recentInput, prevRecent.filter((p) => p.id !== id));
      if (prevBests) utils.pr.bests.setData(undefined, prevBests.filter((p) => p.id !== id));
      return { prevRecent, prevBests, recentInput };
    },
    onError: (_err, _vars, context) => {
      if (!context) return;
      if (context.prevRecent) utils.pr.recent.setData(context.recentInput, context.prevRecent);
      if (context.prevBests) utils.pr.bests.setData(undefined, context.prevBests);
    },
    onSettled: () => utils.pr.invalidate(),
  });

  if (isLoading) return <Spinner />;

  // Los ejercicios sin peso registran el récord en repeticiones
  const formNoWeight = catalog?.find((ex) => ex.id === form.exerciseId)?.noWeight ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Récords personales</h1>
        <Button title="Registrar PR" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Registrar PR</span>
        </Button>
      </div>

      {bests?.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="Aún no tienes récords"
          subtitle="Regístralos a mano o entrena y los detectaremos automáticamente"
        />
      ) : (
        <>
          <section>
            <h2 className="mb-3 font-semibold">Mejores marcas</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {bests?.map((pr) => (
                <button
                  key={pr.id}
                  onClick={() => setSelectedExercise(pr.exerciseId)}
                  className="text-left"
                >
                  <Card className="transition hover:border-accent/40">
                    <p className="text-sm text-muted">{pr.exercise.name}</p>
                    <p className="text-2xl font-bold text-accent">
                      {pr.exercise.noWeight ? `${pr.reps} reps` : `${pr.weight} kg`}
                    </p>
                    <p className="text-xs text-muted">
                      {pr.exercise.noWeight ? "" : `× ${pr.reps} · `}
                      {format(pr.date, "d MMM yyyy", { locale: es })}
                    </p>
                  </Card>
                </button>
              ))}
            </div>
          </section>

          {selectedExercise && (history?.length ?? 0) > 1 && (
            <Card>
              <h2 className="mb-3 font-semibold">
                Evolución · {history?.[0]?.exercise.name}
              </h2>
              <PrHistoryChart
                data={(history ?? []).map((h) => ({
                  fecha: format(h.date, "d MMM", { locale: es }),
                  peso: h.exercise.noWeight ? h.reps : h.weight,
                }))}
              />
            </Card>
          )}

          <section>
            <h2 className="mb-3 font-semibold">Historial reciente</h2>
            <div className="space-y-2">
              {recent?.map((pr) => (
                <Card key={pr.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-4 w-4 text-gold" />
                    <div>
                      <p className="text-sm font-medium">
                        {pr.exercise.name} ·{" "}
                        {pr.exercise.noWeight ? `${pr.reps} reps` : `${pr.weight} kg × ${pr.reps}`}
                      </p>
                      <p className="text-xs text-muted">
                        {format(pr.date, "d MMM yyyy", { locale: es })}
                        {pr.isAuto && " · detectado automáticamente"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{MUSCLE_LABELS[pr.exercise.muscleGroup]}</Badge>
                    <Button
                      size="sm" variant="ghost" className="text-red-400"
                      onClick={() => remove.mutate({ id: pr.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Registrar PR">
        <div className="space-y-4">
          <div>
            <Label>Ejercicio</Label>
            <select
              value={form.exerciseId}
              onChange={(e) => setForm((f) => ({ ...f, exerciseId: e.target.value }))}
              className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm"
            >
              <option value="">Selecciona…</option>
              {catalog?.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}{ex.noWeight ? " (sin peso)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className={formNoWeight ? "" : "grid grid-cols-2 gap-3"}>
            {!formNoWeight && (
              <div>
                <Label>Peso (kg)</Label>
                <Input type="number" min={0} step="0.5" value={form.weight}
                  onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
              </div>
            )}
            <div>
              <Label>Repeticiones</Label>
              <Input type="number" min={1} value={form.reps}
                onChange={(e) => setForm((f) => ({ ...f, reps: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Comentarios</Label>
            <Input value={form.notes} placeholder="Opcional"
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button
            size="lg" className="w-full"
            disabled={!form.exerciseId || (formNoWeight ? !form.reps : !form.weight)}
            loading={create.isLoading}
            onClick={() =>
              create.mutate({
                exerciseId: form.exerciseId,
                weight: formNoWeight ? 0 : +form.weight,
                reps: +form.reps || 1,
                notes: form.notes || undefined,
              })
            }
          >
            Guardar PR
          </Button>
        </div>
      </Modal>
    </div>
  );
}
