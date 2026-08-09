import type { PrismaClient } from "@prisma/client";
import { awardPoints, addFeed, notify, checkAchievements } from "./gamification";
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
    _max: { weight: true, reps: true },
  });
  // En los ejercicios sin peso el récord son las repeticiones de una serie
  const bestByExercise = new Map(
    historicBests.map((b) => [b.exerciseId, { weight: b._max.weight ?? 0, reps: b._max.reps ?? 0 }]),
  );

  const newPRs: string[] = [];
  const prExerciseNames: string[] = [];
  const prSideEffects: Promise<unknown>[] = [];
  for (const we of workout.exercises) {
    const noWeight = we.exercise.noWeight;
    const done = we.sets.filter((s) => s.completed && (noWeight ? s.reps > 0 : s.weight > 0));
    const best = noWeight
      ? done.sort((a, b) => b.reps - a.reps)[0]
      : done.sort((a, b) => b.weight - a.weight)[0];
    if (!best) continue;
    const previous = bestByExercise.get(we.exerciseId);
    const isBetter = previous
      ? noWeight
        ? best.reps > previous.reps
        : best.weight > previous.weight
      : false;

    if (!previous) {
      // Primera vez con este ejercicio: se guarda como marca inicial SILENCIOSA
      // (sin puntos, sin feed, sin avisos). Los PRs empiezan a contar desde aquí.
      prSideEffects.push(
        db.personalRecord.create({
          data: {
            userId, exerciseId: we.exerciseId, weight: best.weight, reps: best.reps,
            isAuto: true, notes: "Marca inicial (primera sesión con este ejercicio)",
          },
        }),
      );
    } else if (isBetter) {
      // solo lo ve el propio usuario
      newPRs.push(`${we.exercise.name}: ${noWeight ? `${best.reps} reps` : `${best.weight} kg`}`);
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
      );
      prExerciseNames.push(we.exercise.name);
    }
  }
  await Promise.all(prSideEffects);

  // Un único aviso al grupo, con nombre y número de ejercicios (sin pesos)
  if (prExerciseNames.length > 0) {
    const { notifyGroupFromTemplate } = await import("./notify-templates");
    await notifyGroupFromTemplate(db, userId, "FRIEND_PR", "prs", {
      name: user.name,
      count: prExerciseNames.length === 1 ? "1 nuevo" : `${prExerciseNames.length} nuevos`,
      exercises: prExerciseNames.join(", "),
    }, "FRIEND_PR");
  }

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
  // Comprobación barata: la inmensa mayoría de las cargas no tienen nada que cerrar
  const stale = await db.workout.findMany({
    where: { userId, endedAt: null, startedAt: { lt: new Date(Date.now() - MAX_WORKOUT_MS) } },
    select: { id: true },
  });
  for (const w of stale) {
    await finishWorkout(db, w.id, { auto: true, notes: "Cerrado automáticamente a las 3 horas" });
  }
  return stale.length;
}

/**
 * Avisa al grupo cuando un entreno lleva más de 20 minutos activo (una sola vez).
 * Se dispara desde la consulta del entreno activo del propio usuario.
 */
export async function notifyWorkoutStartedIfDue(db: PrismaClient, userId: string): Promise<void> {
  const workout = await db.workout.findFirst({
    where: { userId, endedAt: null, startNotified: false, startedAt: { lt: new Date(Date.now() - 20 * 60 * 1000) } },
    include: { routine: { select: { name: true, emoji: true } } },
  });
  if (!workout) return;
  await db.workout.update({ where: { id: workout.id }, data: { startNotified: true } });
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
  const { notifyGroupFromTemplate } = await import("./notify-templates");
  await notifyGroupFromTemplate(db, userId, "FRIEND_WORKOUT_START", "workouts", {
    name: user.name,
    routine: workout.routine ? `${workout.routine.emoji} ${workout.routine.name}` : "un entrenamiento",
  });
}
