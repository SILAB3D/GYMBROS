"use client";

import { RoutinesView } from "@/components/views/routines-view";
import { WorkoutHistoryView } from "@/components/views/workout-history-view";

/**
 * Pestaña «Mi plan de entrenamiento»: arriba las rutinas en el orden en que se
 * encadenan y, al final, el historial de lo que ya se ha entrenado.
 */
export function RoutinesPlanView() {
  return (
    <div className="space-y-8">
      <RoutinesView />
      <hr className="border-border" />
      <WorkoutHistoryView />
    </div>
  );
}
