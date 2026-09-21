import type { PrismaClient } from "@prisma/client";
import { startOfDay, addDays } from "date-fns";
import { awardPoints } from "./gamification";
import { MAX_INCIDENT_CHANGES } from "@/lib/utils";

/**
 * Incidencias: corregir valores de una sesión YA guardada.
 *
 * Un peso mal tecleado no se queda quieto: infla el volumen, se cuela como PR,
 * reparte puntos y sube en el ranking. Por eso corregir una serie no es un
 * simple UPDATE, hay que rehacer todo lo que aquel número generó.
 *
 * El tope de valores por incidencia (MAX_INCIDENT_CHANGES) lo marca lib/utils.
 */

export { MAX_INCIDENT_CHANGES };

export type IncidentChange = { setId: string; reps?: number; weight?: number };

/** Deshace un PR automático y devuelve los puntos que hay que retirar con él. */
async function removeAutoPR(
  db: PrismaClient,
  userId: string,
  pr: { id: string; exerciseId: string; weight: number; date: Date },
): Promise<number> {
  // Los puntos se buscan igual que al borrar un día: por ejercicio y peso,
  // dentro de la ventana del PR (un entreno de madrugada puede registrarlos
  // ya en la fecha siguiente).
  const events = await db.pointEvent.findMany({
    where: {
      userId,
      type: "NEW_PR",
      date: { gte: startOfDay(pr.date), lte: addDays(pr.date, 1) },
      AND: [
        { meta: { path: ["exerciseId"], equals: pr.exerciseId } },
        { meta: { path: ["weight"], equals: pr.weight } },
      ],
    },
    select: { id: true, points: true },
  });
  await db.pointEvent.deleteMany({ where: { id: { in: events.map((e) => e.id) } } });
  await db.personalRecord.delete({ where: { id: pr.id } });
  return events.reduce((acc, e) => acc + e.points, 0);
}

/**
 * Rehace los PRs automáticos de un ejercicio desde una fecha en adelante.
 *
 * Se recorren las sesiones en orden, como si se estuvieran terminando otra vez:
 * así un 180 que en realidad era 80 deja de tapar los PRs que vinieron después.
 * No se publica nada en el feed ni se avisa al grupo (la sesión es vieja y el
 * grupo ya recibió su aviso en su día); lo que sí se ajusta son los puntos.
 */
async function recomputeAutoPRs(
  db: PrismaClient,
  userId: string,
  exerciseId: string,
  since: Date,
): Promise<{ delta: number; created: string[]; removed: number }> {
  const from = startOfDay(since);
  const exercise = await db.exercise.findUniqueOrThrow({
    where: { id: exerciseId },
    select: { name: true, noWeight: true },
  });

  const stale = await db.personalRecord.findMany({
    where: { userId, exerciseId, isAuto: true, date: { gte: from } },
    select: { id: true, exerciseId: true, weight: true, date: true },
  });
  let delta = 0;
  for (const pr of stale) delta -= await removeAutoPR(db, userId, pr);

  // Punto de partida: la mejor marca anterior a la sesión corregida, sea
  // automática o puesta a mano. Si no hay ninguna, el primer entreno del tramo
  // vuelve a ser la "marca inicial" silenciosa, sin puntos, igual que en su día.
  const previous = await db.personalRecord.findMany({
    where: { userId, exerciseId, date: { lt: from } },
    select: { weight: true, reps: true },
  });
  let best =
    previous.length === 0
      ? null
      : previous.reduce(
          (acc, p) => ({ weight: Math.max(acc.weight, p.weight), reps: Math.max(acc.reps, p.reps) }),
          { weight: 0, reps: 0 },
        );

  const sessions = await db.workoutExercise.findMany({
    where: {
      exerciseId,
      workout: { userId, endedAt: { not: null }, startedAt: { gte: from } },
    },
    orderBy: { workout: { startedAt: "asc" } },
    select: {
      workout: { select: { startedAt: true } },
      sets: { select: { reps: true, weight: true, completed: true } },
    },
  });

  const created: string[] = [];
  for (const we of sessions) {
    const done = we.sets.filter((s) => s.completed && (exercise.noWeight ? s.reps > 0 : s.weight > 0));
    const top = exercise.noWeight
      ? done.sort((a, b) => b.reps - a.reps)[0]
      : done.sort((a, b) => b.weight - a.weight)[0];
    if (!top) continue;

    if (!best) {
      await db.personalRecord.create({
        data: {
          userId, exerciseId, weight: top.weight, reps: top.reps, date: we.workout.startedAt,
          isAuto: true, notes: "Marca inicial (primera sesión con este ejercicio)",
        },
      });
      best = { weight: top.weight, reps: top.reps };
      continue;
    }

    const isBetter = exercise.noWeight ? top.reps > best.reps : top.weight > best.weight;
    if (!isBetter) continue;

    await db.personalRecord.create({
      data: {
        userId, exerciseId, weight: top.weight, reps: top.reps, date: we.workout.startedAt,
        isAuto: true, notes: "Recalculado tras corregir una incidencia",
      },
    });
    delta += await awardPoints(db, userId, "NEW_PR", { exerciseId, weight: top.weight });
    created.push(`${exercise.name}: ${exercise.noWeight ? `${top.reps} reps` : `${top.weight} kg`}`);
    best = { weight: Math.max(best.weight, top.weight), reps: Math.max(best.reps, top.reps) };
  }

  return { delta, created, removed: stale.length };
}

/**
 * Aplica una incidencia sobre una sesión terminada: corrige hasta cuatro
 * valores, recalcula los totales de la sesión y rehace los PRs y los puntos que
 * dependían de ellos. Devuelve el resumen para contárselo al usuario.
 */
export async function applyWorkoutIncident(
  db: PrismaClient,
  userId: string,
  workoutId: string,
  changes: IncidentChange[],
  reason?: string,
) {
  const workout = await db.workout.findUnique({
    where: { id: workoutId },
    include: { exercises: { include: { exercise: true, sets: true } } },
  });
  if (!workout || workout.userId !== userId) return null;
  if (!workout.endedAt) return null; // el entreno en curso se edita en su propia pantalla

  const setIndex = new Map(
    workout.exercises.flatMap((we) => we.sets.map((s) => [s.id, { set: s, we }] as const)),
  );

  const applied: Array<Record<string, unknown>> = [];
  const touchedExercises = new Set<string>();
  for (const change of changes) {
    const entry = setIndex.get(change.setId);
    if (!entry) continue; // serie de otra sesión: se ignora en vez de tumbar la incidencia
    const { set, we } = entry;
    const reps = change.reps ?? set.reps;
    // En los ejercicios sin peso el kilaje no se toca: no significa nada
    const weight = we.exercise.noWeight ? set.weight : change.weight ?? set.weight;
    if (reps === set.reps && weight === set.weight) continue; // sin cambio real

    await db.workoutSet.update({ where: { id: set.id }, data: { reps, weight, touched: true } });
    applied.push({
      setId: set.id,
      exercise: we.exercise.name,
      setNumber: set.setNumber,
      from: { reps: set.reps, weight: set.weight },
      to: { reps, weight },
    });
    touchedExercises.add(we.exerciseId);
  }

  if (applied.length === 0) return { changed: 0, pointsDelta: 0, newPRs: [], removedPRs: 0 };

  // Totales de la sesión con los valores buenos (solo cuentan las completadas)
  const fresh = await db.workoutExercise.findMany({
    where: { workoutId },
    select: { sets: { select: { reps: true, weight: true, completed: true } } },
  });
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  for (const we of fresh) {
    for (const s of we.sets) {
      if (!s.completed) continue;
      totalVolume += s.weight * s.reps;
      totalSets += 1;
      totalReps += s.reps;
    }
  }
  await db.workout.update({
    where: { id: workoutId },
    data: { totalVolume, totalSets, totalReps },
  });

  let pointsDelta = 0;
  const newPRs: string[] = [];
  let removedPRs = 0;
  for (const exerciseId of Array.from(touchedExercises)) {
    const res = await recomputeAutoPRs(db, userId, exerciseId, workout.startedAt);
    pointsDelta += res.delta;
    newPRs.push(...res.created);
    removedPRs += res.removed;
  }

  await db.workoutIncident.create({
    data: { workoutId, userId, reason, changes: applied as object, pointsDelta },
  });

  return { changed: applied.length, pointsDelta, newPRs, removedPRs };
}
