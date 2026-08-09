import { subMonths, startOfMonth, format } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/** Sesiones que se comparan a cada lado para calcular la tendencia. */
const WINDOW = 3;
/** Umbral (en %) por debajo del cual se considera que el volumen se mantiene. */
const FLAT_PCT = 3;

export type TrendDirection = "up" | "flat" | "down" | "unknown";

/**
 * Tendencia de un ejercicio: media de volumen de las últimas sesiones frente a
 * la de las anteriores. Con pocos datos la ventana se encoge, y con menos de
 * dos sesiones no hay nada que comparar.
 */
function computeTrend(volumes: number[]): { direction: TrendDirection; changePct: number | null } {
  if (volumes.length < 2) return { direction: "unknown", changePct: null };
  const k = Math.min(WINDOW, Math.floor(volumes.length / 2));
  const recent = volumes.slice(-k);
  const previous = volumes.slice(-2 * k, -k);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const before = avg(previous);
  const after = avg(recent);
  if (before <= 0) return { direction: after > 0 ? "up" : "unknown", changePct: null };
  const changePct = ((after - before) / before) * 100;
  const direction: TrendDirection =
    changePct > FLAT_PCT ? "up" : changePct < -FLAT_PCT ? "down" : "flat";
  return { direction, changePct };
}

export const statsRouter = createTRPCRouter({
  /**
   * Tendencia del volumen de entrenamiento de cada ejercicio de una rutina.
   * El volumen de una sesión son los kg levantados (peso × reps de las series
   * completadas); en los ejercicios sin peso son las repeticiones totales.
   */
  routineTrends: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [routines, workoutExercises] = await Promise.all([
      ctx.db.routine.findMany({
        where: { userId },
        select: {
          id: true, name: true, emoji: true, color: true,
          exercises: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              exercise: { select: { id: true, name: true, muscleGroup: true, noWeight: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      ctx.db.workoutExercise.findMany({
        where: { workout: { userId, endedAt: { not: null } } },
        select: {
          exerciseId: true,
          workout: { select: { startedAt: true } },
          sets: { select: { reps: true, weight: true, completed: true } },
        },
        orderBy: { workout: { startedAt: "asc" } },
      }),
    ]);

    // Historial por ejercicio, una entrada por sesión (kg levantados y reps)
    const history = new Map<string, Array<{ date: Date; kg: number; reps: number }>>();
    for (const we of workoutExercises) {
      let kg = 0;
      let reps = 0;
      for (const s of we.sets) {
        if (!s.completed) continue;
        kg += s.weight * s.reps;
        reps += s.reps;
      }
      if (reps === 0) continue; // sesión sin nada completado de este ejercicio
      const list = history.get(we.exerciseId) ?? [];
      list.push({ date: we.workout.startedAt, kg, reps });
      history.set(we.exerciseId, list);
    }

    return routines.map((routine) => ({
      id: routine.id,
      name: routine.name,
      emoji: routine.emoji,
      color: routine.color,
      exercises: routine.exercises.map((re) => {
        const noWeight = re.exercise.noWeight;
        const sessions = history.get(re.exercise.id) ?? [];
        // Sin peso el progreso se mide en repeticiones totales; con peso, en kg
        const volumes = sessions.map((s) => (noWeight ? s.reps : s.kg));
        const { direction, changePct } = computeTrend(volumes);
        return {
          id: re.id,
          exerciseId: re.exercise.id,
          name: re.exercise.name,
          muscleGroup: re.exercise.muscleGroup,
          unit: noWeight ? ("reps" as const) : ("kg" as const),
          sessions: sessions.length,
          last: volumes.at(-1) ?? null,
          best: volumes.length > 0 ? Math.max(...volumes) : null,
          lastDate: sessions.at(-1)?.date ?? null,
          // Solo se dibujan las últimas 10 sesiones en la mini gráfica
          spark: volumes.slice(-10),
          direction,
          changePct,
        };
      }),
    }));
  }),

  // Series mensuales de los últimos 12 meses para las gráficas
  monthly: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const from = startOfMonth(subMonths(new Date(), 11));

    const [attendances, workouts, prs] = await Promise.all([
      ctx.db.attendance.findMany({ where: { userId, date: { gte: from } }, select: { date: true } }),
      ctx.db.workout.findMany({
        where: { userId, endedAt: { not: null }, startedAt: { gte: from } },
        select: { startedAt: true, totalVolume: true },
      }),
      ctx.db.personalRecord.findMany({ where: { userId, date: { gte: from } }, select: { date: true } }),
    ]);

    const months: Record<string, { month: string; asistencias: number; entrenos: number; volumen: number; prs: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const key = format(subMonths(new Date(), i), "yyyy-MM");
      months[key] = { month: key, asistencias: 0, entrenos: 0, volumen: 0, prs: 0 };
    }
    for (const a of attendances) {
      const key = format(a.date, "yyyy-MM");
      if (months[key]) months[key].asistencias++;
    }
    for (const w of workouts) {
      const key = format(w.startedAt, "yyyy-MM");
      if (months[key]) {
        months[key].entrenos++;
        months[key].volumen += w.totalVolume;
      }
    }
    for (const p of prs) {
      const key = format(p.date, "yyyy-MM");
      if (months[key]) months[key].prs++;
    }
    return Object.values(months);
  }),
});
