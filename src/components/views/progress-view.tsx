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
    card: "border-red-500/40 bg-red-500/10",
    text: "text-red-400",
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

/** Mini gráfica de barras del volumen de las últimas sesiones. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length === 0) return <div className="h-8" />;
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-8 items-end gap-[3px]">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-full rounded-sm bg-current opacity-70", className)}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

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
          <span className="text-red-400">rojo</span> si te estancas o bajas.
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {routine.exercises.map((ex) => {
            const style = STYLES[ex.direction as Direction];
            const Icon = style.icon;
            const pct = ex.changePct;
            return (
              <div
                key={ex.id}
                className={cn("space-y-2 rounded-2xl border p-3", style.card)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold" title={ex.name}>
                    {ex.name}
                  </p>
                  <span className={cn("flex shrink-0 items-center gap-1 text-xs font-bold", style.text)}>
                    <Icon className="h-3.5 w-3.5" />
                    {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}
                  </span>
                </div>

                <div className={style.text}>
                  <Sparkline values={ex.spark} />
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn("truncate text-base font-bold", style.text)}>
                      {ex.last === null
                        ? "sin sesiones"
                        : `${nf.format(ex.last)} ${ex.unit === "kg" ? "kg" : "reps"}`}
                    </p>
                    <p className="text-[11px] text-muted">
                      {style.label}
                      {ex.sessions > 0 && ` · ${ex.sessions} ${ex.sessions === 1 ? "sesión" : "sesiones"}`}
                    </p>
                  </div>
                  {ex.lastDate && (
                    <p className="shrink-0 text-[11px] text-muted">
                      {format(ex.lastDate, "d MMM", { locale: es })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card className="py-3 text-xs text-muted">
        El volumen de una sesión son los kg levantados (peso × repeticiones de las series
        completadas). En los ejercicios marcados como «sin peso» se cuentan las repeticiones
        totales. Hacen falta al menos 2 sesiones para calcular una tendencia.
      </Card>
    </div>
  );
}
