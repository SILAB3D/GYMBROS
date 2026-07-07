import type { PrismaClient } from "@prisma/client";
import { awardPoints, addFeed, notify, notifyOthers, checkAchievements } from "./gamification";
import { registerAttendance } from "./attendance-service";

/** Tiempo máximo de una sesión: si se supera, se cierra sola. */
export const MAX_WORKOUT_MS = 3 * 60 * 60 * 1000; // 3 horas

/**
 * Finaliza un entrenamiento: calcula totales, detecta PRs, otorga puntos.
 * Usado por el botón "Finalizar" y por el autocierre a las 3 horas.
 */
export async function finishWorkout(
  db: PrismaClient,
  workoutId: string,
  opts: { notes?: string; auto?: boolean } = {},
): Promise<{ workoutId: string; newPRs: string[] }> {
  const workout = await db.workout.findUnique({
    where: { id: workoutId },
    include: {
      routine: true,
      exercises: { include: { exercise: true, sets: true } },
    },
  });
  if (!workout || workout.endedAt) return { workoutId, newPRs: [] };

  const userId = workout.userId;
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  for (const we of workout.exercises) {
    for (const s of we.sets) {
      if (!s.completed) continue;
      totalVolume += s.weight * s.reps;
      totalSets += 1;
      totalReps += s.reps;
    }
  }

  // Si es autocierre, la hora de fin es inicio + 3h (no la hora actual)
  const endedAt = opts.auto
    ? new Date(workout.startedAt.getTime() + MAX_WORKOUT_MS)
    : new Date();

  await db.workout.update({
    where: { id: workout.id },
    data: { endedAt, totalVolume, totalSets, totalReps, notes: opts.notes },
  });

  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });

  // Asistencia automática del día del entrenamiento (con puntos y racha si aplica)
  await registerAttendance(db, userId, workout.startedAt);

  // --- Detección automática de PRs (una consulta agregada para toda la sesión) ---
  const exerciseIds = workout.exercises.map((we) => we.exerciseId);
  const historicBests = await db.personalRecord.groupBy({
    by: ["exerciseId"],
    where: { userId, exerciseId: { in: exerciseIds } },
    _max: { weight: true },
  });
  const bestByExercise = new Map(historicBests.map((b) => [b.exerciseId, b._max.weight ?? 0]));

  const newPRs: string[] = [];
  const prSideEffects: Promise<unknown>[] = [];
  for (const we of workout.exercises) {
    const best = we.sets
      .filter((s) => s.completed && s.weight > 0)
      .sort((a, b) => b.weight - a.weight)[0];
    if (!best) continue;
    if (best.weight > (bestByExercise.get(we.exerciseId) ?? 0)) {
      newPRs.push(`${we.exercise.name}: ${best.weight} kg`); // solo lo ve el propio usuario
      prSideEffects.push(
        db.personalRecord.create({
          data: {
            userId, exerciseId: we.exerciseId, weight: best.weight, reps: best.reps,
            isAuto: true, notes: "Detectado automáticamente al finalizar el entrenamiento",
          },
        }),
        awardPoints(db, userId, "NEW_PR", { exerciseId: we.exerciseId, weight: best.weight }),
        // Público: el evento del PR. Privado: el peso alcanzado.
        addFeed(db, userId, "PR", `${user.name} consiguió un nuevo PR en ${we.exercise.name} 🎉`),
        notifyOthers(db, userId, "FRIEND_PR", `${user.name} hizo un nuevo PR`, we.exercise.name),
      );
    }
  }
  await Promise.all(prSideEffects);

  await Promise.all([
    awardPoints(db, userId, "WORKOUT_COMPLETED", { workoutId: workout.id }),
    // El volumen levantado es privado: no se publica en el feed
    addFeed(db, userId, "WORKOUT", `${user.name} completó ${workout.routine ? `la rutina ${workout.routine.emoji} ${workout.routine.name}` : "un entrenamiento"} ✅`),
  ]);
  if (opts.auto) {
    await notify(
      db, userId, "SYSTEM",
      "Entrenamiento cerrado automáticamente ⏱️",
      "Pasaron 3 horas sin pulsar Finalizar, así que lo guardamos por ti.",
    );
  }
  await checkAchievements(db, userId);

  // Avanzar el plan de entrenamiento si se completó la rutina que tocaba
  if (workout.routineId) {
    const slots = await db.planSlot.findMany({ where: { userId }, orderBy: { order: "asc" } });
    if (slots.length > 0) {
      const { planPosition } = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { planPosition: true },
      });
      const current = slots[planPosition % slots.length];
      if (current?.routineId === workout.routineId) {
        await db.user.update({
          where: { id: userId },
          data: { planPosition: (planPosition + 1) % slots.length },
        });
      }
    }
  }

  return { workoutId: workout.id, newPRs };
}

/** Cierra los entrenamientos del usuario que lleven más de 3 horas abiertos. */
export async function autoCloseStaleWorkouts(db: PrismaClient, userId: string): Promise<number> {
  const stale = await db.workout.findMany({
    where: { userId, endedAt: null, startedAt: { lt: new Date(Date.now() - MAX_WORKOUT_MS) } },
    select: { id: true },
  });
  for (const w of stale) {
    await finishWorkout(db, w.id, { auto: true, notes: "Cerrado automáticamente a las 3 horas" });
  }
  return stale.length;
}
