import { startOfISOWeek, subWeeks } from "date-fns";

/**
 * Racha efectiva en semanas: sigue viva si la última semana cumplida es la
 * actual o la inmediatamente anterior; si no, se muestra 0 (rota).
 * El contador real se reinicia a 1 al volver a cumplir una semana.
 */
export function effectiveWeekStreak(currentStreak: number, lastCompletedWeek: Date | null): number {
  if (!lastCompletedWeek || currentStreak <= 0) return 0;
  const previousWeek = subWeeks(startOfISOWeek(new Date()), 1);
  return startOfISOWeek(lastCompletedWeek).getTime() >= previousWeek.getTime() ? currentStreak : 0;
}
