"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, Trash2, Plus, MoonStar, CircleDot } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, EmptyState, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

export function PlanView() {
  const utils = api.useUtils();
  const { data, isLoading } = api.plan.get.useQuery();
  const { data: routines } = api.routine.mine.useQuery();
  const { data: me } = api.user.me.useQuery();
  const [routineToAdd, setRoutineToAdd] = useState("");

  const updateTarget = api.user.updateProfile.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      utils.dashboard.summary.invalidate();
    },
  });

  const invalidate = () => {
    utils.plan.get.invalidate();
    utils.dashboard.summary.invalidate();
  };
  const addSlot = api.plan.addSlot.useMutation({ onSuccess: invalidate });
  const removeSlot = api.plan.removeSlot.useMutation({ onSuccess: invalidate });
  const move = api.plan.move.useMutation({ onSuccess: invalidate });
  const setNext = api.plan.setNext.useMutation({ onSuccess: invalidate });

  if (isLoading) return <Spinner />;

  const slots = data?.slots ?? [];
  const position = data?.position ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi plan de entrenamiento</h1>
        <p className="text-sm text-muted">
          Define el orden en el que alternas tus rutinas y tus días de descanso. El plan avanza solo
          cuando completas la rutina que toca, y en el panel siempre verás cuál es la siguiente.
        </p>
      </div>

      {slots.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="Todavía no tienes plan"
          subtitle="Añade tus rutinas en el orden que quieras alternarlas e intercala descansos. Ejemplo: Push → Pull → Pierna → Descanso"
        />
      ) : (
        <div className="space-y-2">
          {slots.map((slot, i) => {
            const isNext = i === position;
            return (
              <Card
                key={slot.id}
                className={cn(
                  "flex items-center gap-3 py-3",
                  isNext && "border-accent/50 bg-accent/5",
                )}
              >
                <span className="w-6 text-center text-sm font-bold text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {slot.routine ? `${slot.routine.emoji} ${slot.routine.name}` : "😴 Descanso"}
                  </p>
                  <p className="text-xs text-muted">
                    {slot.routine
                      ? `${slot.routine._count.exercises} ejercicios`
                      : "día de recuperación"}
                    {isNext && <Badge className="ml-2 bg-accent/15 text-accent">siguiente</Badge>}
                  </p>
                </div>
                {!isNext && (
                  <Button
                    size="sm" variant="ghost" title="Marcar como siguiente"
                    onClick={() => setNext.mutate({ id: slot.id })}
                  >
                    <CircleDot className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="sm" variant="ghost" disabled={i === 0}
                  onClick={() => move.mutate({ id: slot.id, direction: "up" })}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm" variant="ghost" disabled={i === slots.length - 1}
                  onClick={() => move.mutate({ id: slot.id, direction: "down" })}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm" variant="ghost" className="text-red-400"
                  onClick={() => removeSlot.mutate({ id: slot.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="space-y-3">
        <div>
          <h2 className="font-semibold">Días de entreno a la semana</h2>
          <p className="text-xs text-muted">
            Cada semana que entrenes al menos estos días mantiene tu racha y suma puntos crecientes:
            15 → 25 → 35 → 45 al mes, y 45 por cada semana extra (nivel crack 💎). Si fallas una
            semana, el contador se reinicia.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              onClick={() => updateTarget.mutate({ weeklyTargetDays: n })}
              className={cn(
                "h-10 w-10 rounded-xl text-sm font-medium transition",
                (me?.weeklyTargetDays ?? 0) === n
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-2 text-muted hover:text-fg",
              )}
              title={n === 0 ? "Sin objetivo" : `${n} días por semana`}
            >
              {n === 0 ? "—" : n}
            </button>
          ))}
        </div>
        {(me?.weeklyTargetDays ?? 0) > 0 && (
          <p className="text-xs text-accent">
            Objetivo actual: {me?.weeklyTargetDays} días por semana
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Añadir al plan</h2>
        {routines?.length === 0 ? (
          <p className="text-sm text-muted">
            Primero necesitas rutinas.{" "}
            <Link href="/rutinas/nueva" className="text-accent hover:underline">
              Crea la primera
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              value={routineToAdd}
              onChange={(e) => setRoutineToAdd(e.target.value)}
              className="h-10 flex-1 rounded-xl border border-border bg-surface-2 px-2 text-sm"
            >
              <option value="">Elige una rutina…</option>
              {routines?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.emoji} {r.name}
                </option>
              ))}
            </select>
            <Button
              disabled={!routineToAdd}
              loading={addSlot.isLoading}
              onClick={() => {
                addSlot.mutate({ routineId: routineToAdd });
                setRoutineToAdd("");
              }}
            >
              <Plus className="h-4 w-4" /> Rutina
            </Button>
            <Button
              variant="secondary"
              loading={addSlot.isLoading}
              onClick={() => addSlot.mutate({ routineId: null })}
            >
              <MoonStar className="h-4 w-4" /> Descanso
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
