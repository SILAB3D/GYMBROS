import type { PrismaClient } from "@prisma/client";

/**
 * Objetivo semanal = suma de las «veces por semana» de las rutinas (máx. 7).
 * Se recalcula tras cambiar rutinas y al consultar el plan, para que el
 * recuento de días de entreno vs descanso nunca quede desactualizado.
 */
export async function syncWeeklyTarget(db: PrismaClient, userId: string): Promise<number> {
  const agg = await db.routine.aggregate({
    where: { userId, inPlan: true },
    _sum: { timesPerWeek: true },
  });
  const target = Math.min(7, agg._sum.timesPerWeek ?? 0);
  await db.user.update({ where: { id: userId }, data: { weeklyTargetDays: target } });
  return target;
}
