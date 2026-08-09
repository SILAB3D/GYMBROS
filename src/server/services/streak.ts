import type { PrismaClient } from "@prisma/client";
import { startOfISOWeek, endOfISOWeek, subWeeks, getISODay } from "date-fns";

export type WeekStreakState = {
  /** Racha efectiva en semanas (0 si ya está rota). */
  streak: number;
  /** La semana en curso todavía no está cumplida y aún se puede salvar. */
  atRisk: boolean;
  /** Ya no quedan días suficientes para cumplir la semana: racha perdida. */
  lost: boolean;
  /** Días que faltan para alcanzar el objetivo de esta semana. */
  missing: number;
  /** Días de la semana que quedan por delante, hoy incluido. */
  daysLeft: number;
};

export type StreakInput = {
  currentStreak: number;
  lastCompletedWeek: Date | null;
  weeklyTargetDays: number;
  /** Asistencias registradas en la semana ISO en curso. */
  weekCount: number;
  now?: Date;
};

/**
 * Estado de la racha semanal.
 *
 * La racha se apoya en la última semana cumplida. Si esa semana es la anterior,
 * la actual está "en juego": se mantiene mientras siga siendo posible alcanzar
 * los días planificados, y se pierde en el momento en que ya no dan los días
 * que quedan (no hay que esperar al lunes siguiente para verla caer).
 */
export function weekStreakState({
  currentStreak,
  lastCompletedWeek,
  weeklyTargetDays,
  weekCount,
  now = new Date(),
}: StreakInput): WeekStreakState {
  const missing = Math.max(0, weeklyTargetDays - weekCount);
  const daysLeft = 8 - getISODay(now); // lunes → 7, domingo → 1

  if (weeklyTargetDays <= 0 || currentStreak <= 0 || !lastCompletedWeek) {
    return { streak: 0, atRisk: false, lost: false, missing, daysLeft };
  }

  const weekStart = startOfISOWeek(now);
  const lastWeek = startOfISOWeek(lastCompletedWeek);

  // La semana en curso ya está cumplida: nada que temer
  if (lastWeek.getTime() >= weekStart.getTime()) {
    return { streak: currentStreak, atRisk: false, lost: false, missing: 0, daysLeft };
  }

  // La última cumplida es la anterior: la racha depende de esta semana
  if (lastWeek.getTime() === subWeeks(weekStart, 1).getTime()) {
    if (missing > daysLeft) {
      return { streak: 0, atRisk: false, lost: true, missing, daysLeft };
    }
    return { streak: currentStreak, atRisk: true, lost: false, missing, daysLeft };
  }

  // Se falló alguna semana anterior: racha rota
  return { streak: 0, atRisk: false, lost: true, missing, daysLeft };
}

/** Atajo cuando solo interesa el número que se muestra. */
export function effectiveWeekStreak(input: StreakInput): number {
  return weekStreakState(input).streak;
}

type StreakUser = {
  id: string;
  currentStreak: number;
  lastCompletedWeek: Date | null;
  weeklyTargetDays: number;
};

/**
 * Racha efectiva de varios usuarios (ranking, listados del grupo…). Resuelve
 * las asistencias de la semana en curso de todos ellos con una sola consulta.
 */
export async function streaksForUsers(
  db: PrismaClient,
  users: StreakUser[],
  now: Date = new Date(),
): Promise<Map<string, number>> {
  const ids = users.map((u) => u.id);
  const grouped =
    ids.length > 0
      ? await db.attendance.groupBy({
          by: ["userId"],
          where: { userId: { in: ids }, date: { gte: startOfISOWeek(now), lte: endOfISOWeek(now) } },
          _count: { _all: true },
        })
      : [];
  const counts = new Map(grouped.map((g) => [g.userId, g._count._all]));
  return new Map(
    users.map((u) => [
      u.id,
      effectiveWeekStreak({
        currentStreak: u.currentStreak,
        lastCompletedWeek: u.lastCompletedWeek,
        weeklyTargetDays: u.weeklyTargetDays,
        weekCount: counts.get(u.id) ?? 0,
        now,
      }),
    ]),
  );
}
