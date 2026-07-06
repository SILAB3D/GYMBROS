"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Trophy, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Modal, Spinner, EmptyState, Badge } from "@/components/ui";
import { MUSCLE_LABELS } from "@/lib/utils";

export default function PRsPage() {
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
  const remove = api.pr.delete.useMutation({ onSuccess: () => utils.pr.invalidate() });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Récords personales</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Registrar PR
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
                    <p className="text-2xl font-bold text-accent">{pr.weight} kg</p>
                    <p className="text-xs text-muted">
                      × {pr.reps} · {format(pr.date, "d MMM yyyy", { locale: es })}
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
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(history ?? []).map((h) => ({
                    fecha: format(h.date, "d MMM", { locale: es }),
                    peso: h.weight,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="fecha" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} unit=" kg" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: 12 }}
                    />
                    <Line type="monotone" dataKey="peso" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
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
                        {pr.exercise.name} · {pr.weight} kg × {pr.reps}
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
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Peso (kg)</Label>
              <Input type="number" min={0} step="0.5" value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
            </div>
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
            disabled={!form.exerciseId || !form.weight}
            loading={create.isLoading}
            onClick={() =>
              create.mutate({
                exerciseId: form.exerciseId,
                weight: +form.weight,
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
