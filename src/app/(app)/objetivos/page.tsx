"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Archive, Pencil } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Input, Label, Modal, ProgressBar, Spinner, EmptyState, Badge } from "@/components/ui";
import type { GoalType } from "@prisma/client";

const TYPE_OPTIONS: Array<{ value: GoalType; label: string; unit: string; auto: boolean }> = [
  { value: "ATTENDANCE_WEEKLY", label: "Ir al gym N veces esta semana", unit: "días", auto: true },
  { value: "ATTENDANCE_MONTHLY", label: "Entrenar N días este mes", unit: "días", auto: true },
  { value: "WORKOUTS_TOTAL", label: "Completar N entrenamientos (histórico)", unit: "entrenos", auto: true },
  { value: "LIFT_WEIGHT", label: "Levantar X kg en un ejercicio", unit: "kg", auto: false },
  { value: "CUSTOM", label: "Personalizado (progreso manual)", unit: "", auto: false },
];

export default function GoalsPage() {
  const utils = api.useUtils();
  const { data: goals, isLoading } = api.goal.list.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", type: "CUSTOM" as GoalType, targetValue: "", unit: "", deadline: "", isPublic: true,
  });

  const create = api.goal.create.useMutation({
    onSuccess: () => {
      utils.goal.list.invalidate();
      setOpen(false);
      setForm({ title: "", type: "CUSTOM", targetValue: "", unit: "", deadline: "", isPublic: true });
    },
  });
  const archive = api.goal.archive.useMutation({ onSuccess: () => utils.goal.list.invalidate() });
  const updateProgress = api.goal.updateProgress.useMutation({ onSuccess: () => utils.goal.list.invalidate() });

  if (isLoading) return <Spinner />;

  const active = goals?.filter((g) => g.status === "ACTIVE") ?? [];
  const completed = goals?.filter((g) => g.status === "COMPLETED") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Objetivos</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nuevo objetivo
        </Button>
      </div>

      {active.length === 0 && completed.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="Sin objetivos"
          subtitle='Ejemplos: "Ir al gym 4 veces por semana", "Levantar 120 kg en banca", "Entrenar 20 días este mes"'
        />
      ) : (
        <>
          <div className="space-y-3">
            {active.map((g) => {
              const pct = Math.min(100, Math.round((g.currentValue / g.targetValue) * 100));
              const manual = g.type === "CUSTOM" || g.type === "LIFT_WEIGHT";
              return (
                <Card key={g.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{g.title}</p>
                      <p className="text-xs text-muted">
                        {g.currentValue} / {g.targetValue} {g.unit ?? ""}
                        {g.deadline && ` · límite ${format(g.deadline, "d MMM yyyy", { locale: es })}`}
                        {!g.isPublic && " · privado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {manual && (
                        <Button
                          size="sm" variant="ghost" title="Actualizar progreso"
                          onClick={() => {
                            const v = prompt(`Progreso actual (${g.unit ?? "valor"}):`, String(g.currentValue));
                            if (v !== null && !isNaN(+v)) updateProgress.mutate({ id: g.id, currentValue: +v });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" title="Archivar" onClick={() => archive.mutate({ id: g.id })}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar value={pct} className="flex-1" />
                    <span className="text-sm font-bold text-accent">{pct}%</span>
                  </div>
                </Card>
              );
            })}
          </div>

          {completed.length > 0 && (
            <section>
              <h2 className="mb-3 font-semibold">Completados ✅</h2>
              <div className="space-y-2">
                {completed.map((g) => (
                  <Card key={g.id} className="flex items-center justify-between py-3">
                    <span className="text-sm">{g.title}</span>
                    <Badge className="bg-accent/15 text-accent">+40 pts</Badge>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo objetivo">
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <select
              value={form.type}
              onChange={(e) => {
                const t = TYPE_OPTIONS.find((o) => o.value === e.target.value);
                setForm((f) => ({ ...f, type: e.target.value as GoalType, unit: t?.unit ?? "" }));
              }}
              className="h-10 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}{o.auto ? " (automático)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={form.title} placeholder="Ej: Ir al gym 4 veces por semana"
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Meta ({form.unit || "valor"})</Label>
              <Input type="number" min={0} step="0.5" value={form.targetValue}
                onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))} />
            </div>
            <div>
              <Label>Fecha límite (opcional)</Label>
              <Input type="date" value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox" checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
              className="h-4 w-4 accent-[hsl(var(--accent))]"
            />
            Visible para el grupo
          </label>
          <Button
            size="lg" className="w-full"
            disabled={form.title.length < 2 || !form.targetValue}
            loading={create.isLoading}
            onClick={() =>
              create.mutate({
                title: form.title,
                type: form.type,
                targetValue: +form.targetValue,
                unit: form.unit || undefined,
                deadline: form.deadline ? new Date(form.deadline) : undefined,
                isPublic: form.isPublic,
              })
            }
          >
            Crear objetivo
          </Button>
        </div>
      </Modal>
    </div>
  );
}
