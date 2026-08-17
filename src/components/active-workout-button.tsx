"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell } from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

/**
 * Acceso rápido al entrenamiento en curso desde cualquier pantalla.
 *
 * Salir de /entrenar a mirar una rutina o el ranking era un viaje de ida sin
 * vuelta clara; este botón vive en la esquina inferior izquierda mientras haya
 * una sesión abierta y desaparece en cuanto se termina o si ya estás en ella.
 */

/** Cada cuánto se refresca el cronómetro del botón. */
const TICK_MS = 30_000;

function elapsedLabel(from: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - from.getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function ActiveWorkoutButton() {
  const pathname = usePathname();
  const onWorkoutScreen = pathname === "/entrenar";

  // Se refresca sola al volver a la app: si el entreno se cerró en otro
  // dispositivo, el botón no se queda colgado.
  const { data: workout } = api.workout.activeBadge.useQuery(undefined, {
    enabled: !onWorkoutScreen,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!workout) return;
    const id = setInterval(() => forceTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [workout]);

  if (onWorkoutScreen || !workout) return null;

  const pct =
    workout.totalSets > 0 ? Math.round((workout.doneSets / workout.totalSets) * 100) : 0;

  return (
    <Link
      href="/entrenar"
      aria-label="Volver al entrenamiento en curso"
      className={cn(
        "fixed bottom-20 left-4 z-40 flex items-center gap-2.5 rounded-full border border-accent/50 bg-accent/15 py-2 pl-2.5 pr-3.5 shadow-lg backdrop-blur-xl transition",
        "hover:border-accent hover:bg-accent/25 md:bottom-6 md:left-64",
      )}
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/25">
        <Dumbbell className="h-4 w-4 text-accent" />
        {/* Latido que delata que hay algo abierto sin llegar a molestar */}
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
      </span>
      <span className="leading-tight">
        <span className="block text-[11px] text-muted">
          Entreno en curso · {elapsedLabel(workout.startedAt)}
        </span>
        <span className="block max-w-[10rem] truncate text-sm font-semibold text-accent">
          {workout.routine ? `${workout.routine.emoji} ${workout.routine.name}` : "Entreno libre"}
          {workout.totalSets > 0 && (
            <span className="ml-1 font-normal text-muted">{pct}%</span>
          )}
        </span>
      </span>
    </Link>
  );
}
