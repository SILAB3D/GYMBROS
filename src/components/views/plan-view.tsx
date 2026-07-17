"use client";

import Link from "next/link";
import { ArrowUp, ArrowDown, CircleDot, Wand2, Info } from "lucide-react";
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
  // Reordenación optimista: la lista se mueve al instante y el servidor confirma detrás
  const move = api.plan.move.useMutation({
    onMutate: async ({ id, direction }) => {
      await utils.plan.get.cancel();
      const previous = utils.plan.get.getData();
      if (previous) {
        const nextSlots = [...previous.slots];
        const index = nextSlots.findIndex((s) => s.id === id);
        const target = direction === "up" ? index - 1 : index + 1;
        if (index !== -1 && target >= 0 && target < nextSlots.length) {
          const [moved] = nextSlots.splice(index, 1);
          nextSlots.splice(target, 0, moved!);
          let pos = previous.position;
          if (pos === index) pos = target;
          else if (index < pos && target >= pos) pos -= 1;
          else if (index > pos && target <= pos) pos += 1;
          utils.plan.get.setData(undefined, { ...previous, slots: nextSlots, position: pos });
        }
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.plan.get.setData(undefined, context.previous);
    },
    onSettled: invalidate,
  });
  const setNext = api.plan.setNext.useMutation({
    onMutate: async ({ id }) => {
      await utils.plan.get.cancel();
      const previous = utils.plan.get.getData();
      if (previous) {
        const index = previous.slots.findIndex((s) => s.id === id);
        if (index !== -1) utils.plan.get.setData(undefined, { ...previous, position: index });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.plan.get.setData(undefined, context.previous);
    },
    onSettled: invalidate,
  });
  // Ordenado automático OPTIMISTA: el mismo algoritmo corre en el cliente y
  // el nuevo orden aparece al instante; el servidor confirma detrás.
  const generate = api.plan.generate.useMutation({
    onMutate: async () => {
      await utils.plan.get.cancel();
      const previous = utils.plan.get.getData();
      const mine = utils.routine.mine.getData();
      if (previous && mine) {
        const remaining = mine
          .filter((r) => r.inPlan && r.timesPerWeek > 0)
          .map((r) => ({ r, left: r.timesPerWeek }));
        const total = remaining.reduce((acc, x) => acc + x.left, 0);
        const newSlots: typeof previous.slots = [];
        let prev: string | null = null;
        for (let i = 0; i < total; i++) {
          const candidates = remaining.filter((x) => x.left > 0).sort((a, b) => b.left - a.left);
          const pick = candidates.find((c) => c.r.id !== prev) ?? candidates[0];
          if (!pick) break;
          newSlots.push({
            id: `temp-${i}`,
            userId: "",
            order: i,
            routineId: pick.r.id,
            routine: {
              id: pick.r.id,
              name: pick.r.name,
              emoji: pick.r.emoji,
              color: pick.r.color,
              estimatedMinutes: pick.r.estimatedMinutes,
              _count: { exercises: pick.r.exercises.length },
            },
          } as (typeof previous.slots)[number]);
          pick.left -= 1;
          prev = pick.r.id;
        }
        utils.plan.get.setData(undefined, {
          ...previous,
          slots: newSlots,
          position: 0,
          needsReview: false,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.plan.get.setData(undefined, context.previous);
    },
    onSettled: () => {
      invalidate();
      utils.user.me.invalidate();
    },
  });
  const dismissReview = api.plan.dismissReview.useMutation({
    onMutate: async () => {
      await utils.plan.get.cancel();
      const previous = utils.plan.get.getData();
      if (previous) utils.plan.get.setData(undefined, { ...previous, needsReview: false });
      return { previous };
    },
    onSettled: () => utils.plan.get.invalidate(),
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

      {data?.needsReview && slots.length > 0 && (
        <Card className="flex items-center justify-between gap-3 border-amber-400/40 bg-amber-400/5 py-3">
          <p className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4 shrink-0 text-amber-400" />
            El plan se actualizó con tus cambios de rutinas; revisa el orden por si quieres ajustarlo.
          </p>
          <Button size="sm" variant="ghost" onClick={() => dismissReview.mutate()}>
            Entendido
          </Button>
        </Card>
      )}

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
