"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { api } from "@/trpc/react";
import type { AppRouter } from "@/server/api/root";
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

/** Variación (en %) que llena por completo media barra. */
const SCALE_PCT = 50;
/** Margen que se considera estancamiento, a juego con el cálculo del servidor. */
const FLAT_PCT = 5;

/**
 * Barra divergente de progreso: el 0% está en el centro, el avance crece hacia
 * la derecha y el retroceso hacia la izquierda. El color ya distingue el
 * estancamiento, así que la barra no dibuja ninguna franja extra.
 */
function TrendBar({ changePct, className }: { changePct: number | null; className?: string }) {
  const pct = changePct ?? 0;
  const half = (Math.min(Math.abs(pct), SCALE_PCT) / SCALE_PCT) * 50;
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full bg-black/30"
      title={
        changePct === null
          ? "Sin datos suficientes para calcular la tendencia"
          : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}% de volumen (escala ±${SCALE_PCT}%)`
      }
    >
      {/* Marca del 0%, desde donde arranca la barra a un lado o al otro */}
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/50" />
      {changePct !== null && (
        <span
          className={cn("absolute inset-y-0 rounded-full bg-current", className)}
          style={pct >= 0 ? { left: "50%", width: `${half}%` } : { right: "50%", width: `${half}%` }}
        />
      )}
    </div>
  );
}

type RoutineTrend = inferRouterOutputs<AppRouter>["stats"]["routineTrends"][number];

/**
 * Tendencia de la rutina completa: la suma del volumen de todas sus sesiones.
 * Es el titular que faltaba, porque una rutina puede ir hacia arriba aunque un
 * par de ejercicios sueltos estén estancados (y al revés).
 */
function RoutineOverall({ routine }: { routine: RoutineTrend }) {
  const o = routine.overall;
  const style = STYLES[o.direction as Direction];
  const Icon = style.icon;
  const pct = o.changePct;

  return (
    <div className={cn("space-y-3 rounded-2xl border p-4", style.card)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">Rutina completa</p>
          <p className="truncate text-lg font-bold">
            {routine.emoji} {routine.name}
          </p>
        </div>
        <span className={cn("flex shrink-0 items-center gap-1 text-lg font-bold", style.text)}>
          <Icon className="h-5 w-5" />
          {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}
        </span>
      </div>

      <TrendBar changePct={pct} className={style.text} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
        <span className={cn("font-semibold", style.text)}>{style.label}</span>
        <span className="text-muted">
          {o.sessions === 0
            ? "Sin sesiones registradas"
            : `${o.sessions} ${o.sessions === 1 ? "sesión" : "sesiones"}`}
          {o.last !== null && ` · última ${nf.format(o.last)} ${o.unit === "kg" ? "kg" : "reps"}`}
          {o.best !== null && ` · mejor ${nf.format(o.best)}`}
          {o.lastDate && ` · ${format(o.lastDate, "d MMM yyyy", { locale: es })}`}
        </span>
      </div>
    </div>
  );
}

/**
 * Progreso de entrenamiento: primero la rutina completa y después un cuadro
 * compacto por cada ejercicio, con la tendencia de su volumen a lo largo del
 * tiempo (media de las 3 últimas sesiones frente a las 3 anteriores).
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
        <h1 className="text-2xl font-bold">Progreso</h1>
        <p className="text-sm text-muted">
          Volumen de las 3 últimas sesiones frente a las 3 anteriores.{" "}
          <span className="text-accent">Verde</span> si subes más de un 5%,{" "}
          <span className="text-amber-400">ámbar</span> si te mantienes dentro de ±5%,{" "}
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

      {/* Progreso de la rutina entera, antes del detalle ejercicio a ejercicio */}
      <RoutineOverall routine={routine} />

      <h2 className="pt-1 text-sm font-semibold uppercase tracking-wide text-muted">
        Por ejercicio
      </h2>

      {routine.exercises.length === 0 ? (
        <EmptyState icon="🗒️" title="Esta rutina no tiene ejercicios" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {routine.exercises.map((ex) => {
            const style = STYLES[ex.direction as Direction];
            const Icon = style.icon;
            const pct = ex.changePct;
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

                <TrendBar changePct={pct} className={style.text} />

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
        totales. El de la rutina completa suma el de todos sus ejercicios en cada sesión, así que
        puede avanzar aunque algún ejercicio suelto se estanque. En la barra, el 0% está en el
        centro: el avance crece hacia la derecha y el
        retroceso hacia la izquierda, con la escala llena a ±{SCALE_PCT}%. Por debajo de ±
        {FLAT_PCT}% se considera estancamiento. Hacen falta al menos 2 sesiones para calcular una
        tendencia.
      </Card>
    </div>
  );
}
