"use client";

import { RoutinesView } from "@/components/views/routines-view";
import { PlanView } from "@/components/views/plan-view";

/**
 * Pestaña única de Entrenamiento: las rutinas arriba y, debajo, el plan que
 * define en qué orden se van encadenando.
 */
export function RoutinesPlanView() {
  return (
    <div className="space-y-8">
      <RoutinesView />
      <hr className="border-border" />
      <PlanView />
    </div>
  );
}
