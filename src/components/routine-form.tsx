"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, Search, Globe, Lock } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Modal } from "@/components/ui";
import { MUSCLE_LABELS, cn } from "@/lib/utils";
import { matchesExercise } from "@/lib/exercise-search";
import type { MuscleGroup } from "@prisma/client";

const COLORS = ["#22c55e", "#3b82f6", "#a855f7", "#ef4444", "#f59e0b", "#ec4899", "#14b8a6"];
const EMOJIS = ["💪", "🏋️", "🦵", "🔥", "⚡", "🐻", "🦍", "🚀"];

export type RoutineFormExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  targetWeight: number | null;
  restSeconds: number | null;
  notes: string | null;
};

export type RoutineFormValue = {
  name: string;
  description: string;
  color: string;
  emoji: string;
  recommendedDays: number[];
  timesPerWeek: number;
  estimatedMinutes: number | null;
  exercises: RoutineFormExercise[];
};

export function RoutineForm({
  initial,
  routineId,
}: {
  initial?: RoutineFormValue;
  routineId?: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const { data: catalog } = api.exercise.list.useQuery();

  const [form, setForm] = useState<RoutineFormValue>(
    initial ?? {
      name: "", description: "", color: "#22c55e", emoji: "💪",
      recommendedDays: [], timesPerWeek: 1, estimatedMinutes: 60, exercises: [],
    },
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const draftKey = `gymbros-routine-draft-${routineId ?? "nueva"}`;
  const draftLoaded = useRef(false);

  // Recuperar el borrador si se cerró la app o se cambió de apartado a mitad
  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as RoutineFormValue;
        if (draft && typeof draft.name === "string" && Array.isArray(draft.exercises)) {
          setForm(draft);
          setDraftRestored(true);
        }
      }
    } catch {
      /* borrador ilegible: se ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autoguardado del borrador con cada cambio
  useEffect(() => {
    if (!draftLoaded.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form));
      } catch {
        /* almacenamiento lleno: se ignora */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form, draftKey]);

  function discardDraft() {
    localStorage.removeItem(draftKey);
    setForm(
      initial ?? {
        name: "", description: "", color: "#22c55e", emoji: "💪",
        recommendedDays: [], timesPerWeek: 1, estimatedMinutes: 60, exercises: [],
      },
    );
    setDraftRestored(false);
  }

  const [newExercise, setNewExercise] = useState({ name: "", muscleGroup: "PECHO" as MuscleGroup });

  const onSuccess = async () => {
    localStorage.removeItem(draftKey);
    await Promise.all([
      utils.routine.invalidate(),
      utils.plan.get.invalidate(),
      utils.dashboard.summary.invalidate(),
      utils.user.me.invalidate(),
    ]);
    router.push("/rutinas");
  };
  const create = api.routine.create.useMutation({ onSuccess });
  const update = api.routine.update.useMutation({ onSuccess });
  const createExercise = api.exercise.create.useMutation({
    onSuccess: async (created) => {
      await utils.exercise.list.invalidate();
      addExercise(created.id, created.name);
      setNewExercise({ name: "", muscleGroup: "PECHO" });
    },
  });

  function addExercise(exerciseId: string, name: string) {
    setForm((f) => ({
      ...f,
      exercises: [
        ...f.exercises,
        { exerciseId, name, sets: 3, reps: 10, targetWeight: null, restSeconds: 90, notes: null },
      ],
    }));
    setPickerOpen(false);
  }

  function updateExercise(index: number, patch: Partial<RoutineFormExercise>) {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));
  }

  function submit() {
    const payload = {
      name: form.name,
      description: form.description || null,
      color: form.color,
      emoji: form.emoji,
      recommendedDays: form.recommendedDays,
      timesPerWeek: form.timesPerWeek,
      estimatedMinutes: form.estimatedMinutes,
      exercises: form.exercises.map((e) => ({
        exerciseId: e.exerciseId, sets: e.sets, reps: e.reps,
        targetWeight: e.targetWeight, restSeconds: e.restSeconds, notes: e.notes,
      })),
    };
    if (routineId) update.mutate({ id: routineId, ...payload });
    else create.mutate(payload);
  }

  const filteredCatalog = (catalog ?? []).filter((e) => matchesExercise(e.name, search));
  const grouped = filteredCatalog.reduce<Record<string, typeof catalog>>((acc, e) => {
    (acc[e.muscleGroup] ??= [] as NonNullable<typeof catalog>).push(e);
    return acc;
  }, {});

  // Qué falta para poder guardar la rutina
  const missing: string[] = [];
  if (form.name.trim().length < 2) missing.push("el nombre de la rutina (mínimo 2 caracteres)");
  if (form.exercises.length === 0) missing.push("añadir al menos un ejercicio");
  const mutationError = create.error ?? update.error;

  return (
    <div className="space-y-5">
      {draftRestored && (
        <Card className="flex items-center justify-between gap-3 border-amber-400/40 bg-amber-400/5 py-3">
          <p className="text-sm">Se recuperó un borrador sin guardar.</p>
          <Button size="sm" variant="ghost" onClick={discardDraft}>
            Descartar borrador
          </Button>
        </Card>
      )}

      {/* Transparencia: qué ve el grupo y qué no */}
      <Card className="flex flex-col gap-1.5 border-accent/20 bg-accent/5 py-3 text-xs">
        <p className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span><strong>Público:</strong> ejercicios, series y repeticiones.</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span><strong>Privado:</strong> pesos, notas y volumen.</span>
        </p>
      </Card>

      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Nombre</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Push día 1, Pierna, Full body…"
            />
          </div>
          <div>
            <Label>Duración estimada (min)</Label>
            <Input
              type="number"
              min={5}
              value={form.estimatedMinutes ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, estimatedMinutes: e.target.value ? +e.target.value : null }))
              }
            />
          </div>
          <div>
            <Label>Veces por semana</Label>
            <select
              value={form.timesPerWeek}
              onChange={(e) => setForm((f) => ({ ...f, timesPerWeek: +e.target.value }))}
              className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "No cuenta para el plan" : `${n} ${n === 1 ? "día" : "días"} / semana`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              Se añade a tu plan automáticamente; ordénala en Entrenamiento → Plan.
            </p>
          </div>
        </div>
        <div>
          <Label>Descripción</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Opcional"
          />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <Label>Color</Label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={cn("h-7 w-7 rounded-full transition", form.color === c && "ring-2 ring-fg ring-offset-2 ring-offset-surface")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label>Icono</Label>
            <div className="flex gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  className={cn("rounded-lg p-1.5 text-xl transition", form.emoji === e ? "bg-accent/20" : "hover:bg-surface-2")}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ejercicios ({form.exercises.length})</h2>
          <Button variant="secondary" size="sm" onClick={() => { setSearch(""); setPickerOpen(true); }}>
            <Plus className="h-4 w-4" /> Añadir ejercicio
          </Button>
        </div>

        {form.exercises.map((e, i) => (
          <Card key={`${e.exerciseId}-${i}`} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <GripVertical className="h-4 w-4 text-muted" /> {e.name}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400"
                onClick={() =>
                  setForm((f) => ({ ...f, exercises: f.exercises.filter((_, j) => j !== i) }))
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label>Series</Label>
                <Input type="number" min={1} value={e.sets}
                  onChange={(ev) => updateExercise(i, { sets: +ev.target.value || 1 })} />
              </div>
              <div>
                <Label>Reps</Label>
                <Input type="number" min={1} value={e.reps}
                  onChange={(ev) => updateExercise(i, { reps: +ev.target.value || 1 })} />
              </div>
              <div>
                <Label>Peso (kg) — opcional</Label>
                <Input type="number" min={0} step="0.5" value={e.targetWeight ?? ""}
                  placeholder="—"
                  onChange={(ev) => updateExercise(i, { targetWeight: ev.target.value ? +ev.target.value : null })} />
              </div>
              <div>
                <Label>Descanso (s) — opcional</Label>
                <Input type="number" min={0} step={15} value={e.restSeconds ?? ""}
                  placeholder="—"
                  onChange={(ev) => updateExercise(i, { restSeconds: ev.target.value ? +ev.target.value : null })} />
              </div>
            </div>
            <Input
              value={e.notes ?? ""}
              placeholder="Notas (opcional)"
              onChange={(ev) => updateExercise(i, { notes: ev.target.value || null })}
            />
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        {missing.length > 0 && (
          <p className="text-sm text-amber-400">
            Para {routineId ? "guardar" : "crear"} la rutina falta: {missing.join(" y ")}.
          </p>
        )}
        {mutationError && (
          <p className="text-sm text-red-400">Error al guardar: {mutationError.message}</p>
        )}
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={missing.length > 0}
          loading={create.isLoading || update.isLoading}
          onClick={submit}
        >
          {routineId ? "Guardar cambios" : "Crear rutina"}
        </Button>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Añadir ejercicio">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              autoFocus
              value={search}
              placeholder="Buscar en español o inglés: banca, squat, curl…"
              className="pl-9"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {filteredCatalog.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">
                Sin resultados para «{search}». Puedes crearlo abajo. 👇
              </p>
            )}
            {Object.entries(grouped).map(([group, exercises]) => (
              <div key={group}>
                <p className="mb-1 text-xs font-semibold uppercase text-muted">
                  {MUSCLE_LABELS[group] ?? group}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {exercises?.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(ex.id, ex.name)}
                      className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm hover:bg-accent/20"
                    >
                      {ex.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-sm font-medium">¿No está en la lista? Créalo:</p>
            <div className="flex gap-2">
              <Input
                value={newExercise.name}
                placeholder="Nombre del ejercicio"
                onChange={(e) => setNewExercise((n) => ({ ...n, name: e.target.value }))}
              />
              <select
                value={newExercise.muscleGroup}
                onChange={(e) => setNewExercise((n) => ({ ...n, muscleGroup: e.target.value as MuscleGroup }))}
                className="h-10 rounded-xl border border-border bg-surface-2 px-2 text-sm"
              >
                {Object.entries(MUSCLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <Button
                size="md"
                disabled={newExercise.name.length < 2}
                loading={createExercise.isLoading}
                onClick={() => createExercise.mutate(newExercise)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
