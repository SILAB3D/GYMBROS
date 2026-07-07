"use client";

import Link from "next/link";
import { ArrowUp, ArrowDown, CircleDot, Wand2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, EmptyState, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

export function PlanView() {
  const utils = api.useUtils();
  const { data, isLoading } = api.plan.get.useQuery();
  const { data: routines } = api.routine.mine.useQuery();

  const invalidate = () => {
    utils.plan.get.invalidate();
    utils.dashboard.summary.invalidate();
  };
  const move = api.plan.move.useMutation({ onSuccess: invalidate });
  const setNext = api.plan.setNext.useMutation({ onSuccess: invalidate });
  const generate = api.plan.generate.useMutation({
    onSuccess: () => {
      invalidate();
      utils.user.me.invalidate();
    },
  });

  if (isLoading) return <Spinner />;

  const slots = data?.slots ?? [];
  const position = data?.position ?? 0;
  const totalWeekly = Math.min(
    7,
    (routines ?? []).reduce((acc, r) => acc + (r.inPlan ? r.timesPerWeek : 0), 0),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Mi plan de entrenamiento</h1>
        <p className="text-sm text-muted">
          Tus rutinas aparecen según sus «veces por semana»; tú solo las ordenas.
        </p>
      </div>

      {slots.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="Todavía no hay plan"
          subtitle="Crea rutinas con al menos 1 vez por semana y aparecerán aquí automáticamente."
          action={
            <Link href="/rutinas/nueva">
              <Button>Crear rutina</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Button
            variant="secondary"
            loading={generate.isLoading}
            onClick={() => {
              if (
                confirm(
                  "Se reordenará el plan intercalando las rutinas para no repetir la misma en días seguidos. ¿Continuar?",
                )
              ) {
                generate.mutate();
              }
            }}
          >
            <Wand2 className="h-4 w-4" /> Ordenar automáticamente
          </Button>

          <div className="space-y-2">
            {slots.map((slot, i) => {
              const isNext = i === position;
              return (
                <Card
                  key={slot.id}
                  className={cn("flex items-center gap-3 py-3", isNext && "border-accent/50 bg-accent/5")}
                >
                  <span className="w-6 text-center text-sm font-bold text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {slot.routine ? `${slot.routine.emoji} ${slot.routine.name}` : "😴 Descanso"}
                    </p>
                    <p className="text-xs text-muted">
                      {slot.routine ? `${slot.routine._count.exercises} ejercicios` : "día de recuperación"}
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
                    size="sm" variant="ghost" disabled={i === 0 || move.isLoading}
                    onClick={() => move.mutate({ id: slot.id, direction: "up" })}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" disabled={i === slots.length - 1 || move.isLoading}
                    onClick={() => move.mutate({ id: slot.id, direction: "down" })}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {(routines ?? []).some((r) => r.inPlan && r.timesPerWeek > 0) && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Entrenos planificados por semana</h2>
          <div className="space-y-1.5">
            {(routines ?? [])
              .filter((r) => r.inPlan && r.timesPerWeek > 0)
              .map((r) => (
                <div key={r.id} className="flex justify-between text-sm">
                  <span>{r.emoji} {r.name}</span>
                  <span className="text-muted">×{r.timesPerWeek}/semana</span>
                </div>
              ))}
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Total</span>
              <span className="text-accent">
                {totalWeekly} de entreno · {7 - totalWeekly} de descanso 😴
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
