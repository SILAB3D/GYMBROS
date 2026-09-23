import type { PrismaClient } from "@prisma/client";
import { awardPoints, addFeed, notify, checkAchievements, workoutPointUnits } from "./gamification";
import { registerAttendance } from "./attendance-service";

/** Tiempo máximo de una sesión: si se supera, se cierra sola. */
export const MAX_WORKOUT_MS = 3 * 60 * 60 * 1000; // 3 horas

export type FinishedWorkout = {
  userId: string;
  routineId: string | null;
  exercises: Array<{
    exerciseId: string;
    exercise: { noWeight: boolean };
    sets: Array<{ reps: number; weight: number; completed: boolean }>;
  }>;
};

/**
 * Vuelca en la rutina lo que se ha anotado a mano en la sesión: series, reps y
 * peso objetivo de cada ejercicio. Así «Mi plan de entrenamiento» refleja
 * siempre lo último que se hizo de verdad y no lo que se planificó el día que
 * se creó la rutina.
 *
 * Criterios:
 * - Solo cuenta la sesión si el ejercicio tiene alguna serie completada: no
 *   marcar una serie es saltársela, no rebajar el plan.
 * - Las series del plan pasan a ser las de la sesión (añadir o quitar series en
 *   el entreno es una decisión explícita del usuario).
 * - Un ejercicio añadido sobre la marcha se suma al final de la rutina.
 * - Una rutina compartida por otro no se toca nunca: no es del usuario.
 */
export async function syncRoutineFromWorkout(
  db: PrismaClient,
  workout: FinishedWorkout,
): Promise<void> {
  if (!workout.routineId) return;
  const routine = await db.routine.findUnique({
    where: { id: workout.routineId },
    include: { exercises: true },
  });
  if (!routine || routine.userId !== workout.userId) return;

  const planned = new Map(routine.exercises.map((re) => [re.exerciseId, re]));
  let lastOrder = routine.exercises.reduce((max, re) => Math.max(max, re.order), -1);

  for (const we of workout.exercises) {
    const done = we.sets.filter((s) => s.completed);
    if (done.length === 0) continue;

    const reps = Math.max(1, Math.round(done.reduce((acc, s) => acc + s.reps, 0) / done.length));
    const withWeight = done.filter((s) => s.weight > 0);
    const avgWeight =
      withWeight.length > 0
        ? Math.round((withWeight.reduce((acc, s) => acc + s.weight, 0) / withWeight.length) * 10) / 10
        : null;
    const sets = Math.max(1, we.sets.length);
    const existing = planned.get(we.exerciseId);

    if (existing) {
      const targetWeight = we.exercise.noWeight ? null : avgWeight ?? existing.targetWeight;
      if (
        existing.sets === sets &&
        existing.reps === reps &&
        existing.targetWeight === targetWeight
      ) {
        continue; // nada que cambiar
      }
      await db.routineExercise.update({
        where: { id: existing.id },
        data: { sets, reps, targetWeight },
      });
    } else {
      lastOrder += 1;
      await db.routineExercise.create({
        data: {
          routineId: routine.id,
          exerciseId: we.exerciseId,
          order: lastOrder,
          sets,
          reps,
          targetWeight: we.exercise.noWeight ? null : avgWeight,
        },
      });
    }
  }
}

/**
 * Finaliza un entrenamiento: calcula totales, detecta PRs, otorga puntos.
 * Usado por el botón "Finalizar" y por el autocierre a las 3 horas.
 */
export async function finishWorkout(
  db: PrismaClient,
  workoutId: string,
  opts: { notes?: string; auto?: boolean } = {},
): Promise<{ workoutId: string; newPRs: string[]; workoutPoints: number }> {
  const workout = await db.workout.findUnique({
    where: { id: workoutId },
    include: {
      routine: true,
      exercises: { include: { exercise: true, sets: true } },
    },
  });
  if (!workout || workout.endedAt) return { workoutId, newPRs: [], workoutPoints: 0 };

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

  // La rutina se pone al día con lo que se acaba de anotar a mano
  await syncRoutineFromWorkout(db, workout);

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

  const [workoutPoints] = await Promise.all([
    // 1 punto (valor de la regla) por serie completada
    awardPoints(db, userId, "WORKOUT_COMPLETED", { workoutId: workout.id }, workoutPointUnits(workout.exercises)),
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

  return { workoutId: workout.id, newPRs, workoutPoints };
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

/** Tiempo sin abrir la app con un entreno en marcha antes de avisar. */
export const IDLE_WORKOUT_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Avisa a quien tiene un entreno activo y lleva más de 30 minutos sin abrir la
 * app (probablemente se le olvidó darle a Finalizar, o se le fue la cabeza con
 * el móvil guardado). Un aviso por cada ausencia: si vuelve a la app y se
 * vuelve a ir, puede recibir otro.
 */
export async function notifyIdleWorkouts(db: PrismaClient, now: Date = new Date()): Promise<number> {
  const idleSince = new Date(now.getTime() - IDLE_WORKOUT_MS);
  const workouts = await db.workout.findMany({
    where: {
      endedAt: null,
      // Los de más de 3 horas se cierran solos: ahí ya no hay nada que avisar
      startedAt: { lt: idleSince, gt: new Date(now.getTime() - MAX_WORKOUT_MS) },
      user: { deletionRequestedAt: null },
    },
    select: {
      id: true,
      startedAt: true,
      idleNotifiedAt: true,
      userId: true,
      user: { select: { lastSeenAt: true, notifyPrefs: true } },
      routine: { select: { name: true, emoji: true } },
    },
  });

  const { categoryEnabled } = await import("./notify-prefs");
  const { sendPushToUsers } = await import("./push");
  let sent = 0;
  for (const w of workouts) {
    // Última señal de vida: el latido de la app o, si no hay, el inicio del entreno
    const lastSeen = [w.user.lastSeenAt, w.startedAt]
      .filter((d): d is Date => Boolean(d))
      .reduce((a, b) => (a > b ? a : b));
    if (lastSeen > idleSince) continue;
    // Ya se avisó de esta ausencia (no ha vuelto a abrir la app desde entonces)
    if (w.idleNotifiedAt && w.idleNotifiedAt >= lastSeen) continue;

    await db.workout.update({ where: { id: w.id }, data: { idleNotifiedAt: now } });
    if (!categoryEnabled(w.user.notifyPrefs, "reminders")) continue;

    const title = "Tienes un entreno en marcha ⏱️";
    const body = `${w.routine ? `${w.routine.emoji} ${w.routine.name} sigue abierto` : "Tu entreno sigue abierto"} y llevas más de 30 minutos sin entrar. Entra para seguir apuntando o darle a Finalizar.`;
    await db.notification.create({ data: { userId: w.userId, type: "SYSTEM", title, body } });
    await sendPushToUsers(db, [w.userId], { title, body, url: "/entrenar" });
    sent++;
  }
  return sent;
}
