"use client";

import { CalendarRange, Repeat } from "lucide-react";

/**
 * Lo que de verdad dice si alguien entrena: cuántas veces ha ido en el último
 * año y a cuántas sale al mes. Sin adornos, dos cifras y su contexto.
 */
export function YearSummary({ workouts, monthlyAvg }: { workouts: number; monthlyAvg: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
          <CalendarRange className="h-3.5 w-3.5" /> Último año
        </p>
        <p className="mt-1 text-2xl font-bold">{workouts}</p>
        <p className="text-xs text-muted">
          {workouts === 1 ? "entrenamiento" : "entrenamientos"}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
          <Repeat className="h-3.5 w-3.5" /> Promedio
        </p>
        <p className="mt-1 text-2xl font-bold">
          {monthlyAvg.toLocaleString("es-ES", { maximumFractionDigits: 1 })}
        </p>
        <p className="text-xs text-muted">entrenamientos al mes</p>
      </div>
    </div>
  );
}
