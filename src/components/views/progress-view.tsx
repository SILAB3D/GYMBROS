"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import { api } from "@/trpc/react";
import { Card, Spinner, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

type Direction = "up" | "flat" | "down" | "unknown";

const STYLES: Record<Direction, { card: string; text: string; label: string; icon: typeof TrendingUp }> = {
  up: {
    card: "border-accent/50 bg-accent/10",
    text: "text-accent",
    label: "Progresando",
    icon: TrendingUp,
  },
  flat: {
    card: "border-amber-400/50 bg-amber-400/10",
    text: "text-amber-400",
    label: "Estancado",
    icon: Minus,
  },
  down: {
    card: "border-red-500/50 bg-red-500/15",
    text: "text-red-400",
    label: "Retrocediendo",
    icon: TrendingDown,
  },
  unknown: {
    card: "border-border bg-surface",
    text: "text-muted",
    label: "Sin datos",
    icon: HelpCircle,
  },
};

const nf = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

/**
 * Progreso por ejercicio: un cuadro compacto por ejercicio de la rutina con la
 * tendencia de su volumen de entrenamiento a lo largo del tiempo (media de las
 * 3 últimas sesiones frente a las 3 anteriores).
 */
export function ProgressView() {
  const { data: routines, isLoading } = api.stats.routineTrends.useQuery();
  const [selected, setSelected] = useState<string | null>(null);

  if (isLoading) return <Spinner />;

  if (!routines || routines.length === 0) {
    return (
      <EmptyState
        icon="📈"
        title="Todavía no hay nada que analizar"
        subtitle="Crea una rutina y entrena un par de veces para ver la tendencia de cada ejercicio"
      />
    );
  }

  const routine = routines.find((r) => r.id === selected) ?? routines[0]!;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Progreso por ejercicio</h1>
        <p className="text-sm text-muted">
          Volumen de las 3 últimas sesiones frente a las 3 anteriores.{" "}
          <span className="text-accent">Verde</span> si subes,{" "}
          <span className="text-amber-400">ámbar</span> si te estancas,{" "}
          <span className="text-red-400">rojo</span> si retrocedes.
        </p>
      </div>

      {/* Selector de rutina */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {routines.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm transition",
              r.id === routine.id
                ? "border-accent bg-accent/15 font-medium text-accent"
                : "border-border bg-surface text-muted hover:text-fg",
            )}
          >
            {r.emoji} {r.name}
          </button>
        ))}
      </div>

      {routine.exercises.length === 0 ? (
        <EmptyState icon="🗒️" title="Esta rutina no tiene ejercicios" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {routine.exercises.map((ex) => {
            const style = STYLES[ex.direction as Direction];
            const Icon = style.icon;
            const pct = ex.changePct;
            // Una sola barra fina: cuánto queda del récord de volumen de este
            // ejercicio. Ocupa 4 px y dice de un vistazo si la última sesión
            // anda cerca de tu mejor marca o muy por debajo.
            const ofBest = ex.last !== null && ex.best ? Math.min(100, (ex.last / ex.best) * 100) : 0;
            return (
              <div
                key={ex.id}
                className={cn("space-y-1.5 rounded-xl border p-2.5", style.card)}
                title={
                  ex.lastDate
                    ? `${ex.name} · ${style.label} · última sesión el ${format(ex.lastDate, "d MMM yyyy", { locale: es })}`
                    : `${ex.name} · ${style.label}`
                }
              >
                <p className="truncate text-xs font-semibold leading-tight">{ex.name}</p>

                <div className="flex items-baseline justify-between gap-1">
                  <span className={cn("truncate text-sm font-bold", style.text)}>
                    {ex.last === null
                      ? "—"
                      : `${nf.format(ex.last)} ${ex.unit === "kg" ? "kg" : "reps"}`}
                  </span>
                  <span className={cn("flex shrink-0 items-center gap-0.5 text-[11px] font-bold", style.text)}>
                    <Icon className="h-3 w-3" />
                    {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}
                  </span>
                </div>

                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-black/25"
                  title={
                    ex.best
                      ? `${ofBest.toFixed(0)}% de tu récord (${nf.format(ex.best)} ${ex.unit === "kg" ? "kg" : "reps"})`
                      : undefined
                  }
                >
                  <div
                    className={cn("h-full rounded-full bg-current", style.text)}
                    style={{ width: `${ofBest}%` }}
                  />
                </div>

                <p className="truncate text-[10px] text-muted">
                  {style.label}
                  {ex.sessions > 0 && ` · ${ex.sessions} ${ex.sessions === 1 ? "sesión" : "sesiones"}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <Card className="py-3 text-xs text-muted">
        El volumen de una sesión son los kg levantados (peso × repeticiones de las series
        completadas). En los ejercicios marcados como «sin peso» se cuentan las repeticiones
        totales. La barra fina indica cuánto se acerca la última sesión a tu récord de volumen
        en ese ejercicio. Hacen falta al menos 2 sesiones para calcular una tendencia.
      </Card>
    </div>
  );
}
