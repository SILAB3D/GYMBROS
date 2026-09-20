import type { PrismaClient } from "@prisma/client";
import { syncWeeklyTarget } from "./weekly-target";

type PlannedRoutine = { id: string; timesPerWeek: number; inPlan: boolean; order: number };

/**
 * Secuencia del plan a partir del ORDEN de las rutinas: cada rutina aparece
 * tantas veces como sus «veces por semana», repartidas en vueltas sucesivas
 * para que no se repita la misma dos días seguidos siempre que se pueda.
 *
 * Con A×3, B×2 y C×1 en ese orden sale A · B · C · A · B · A.
 */
export function planSequence(routines: PlannedRoutine[]): string[] {
  // Llegan ya ordenadas; el orden entre iguales lo decide quien las consulta.
  const remaining = routines
    .filter((r) => r.inPlan && r.timesPerWeek > 0)
    .map((r) => ({ id: r.id, left: r.timesPerWeek }));

  const sequence: string[] = [];
  let placed = true;
  while (placed) {
    placed = false;
    for (const r of remaining) {
      if (r.left <= 0) continue;
      sequence.push(r.id);
      r.left -= 1;
      placed = true;
    }
  }
  return sequence;
}

/**
 * Reconcilia el plan con las rutinas: la secuencia de slots tiene que ser
 * exactamente la que dictan el orden y las «veces por semana» de las rutinas.
 * Se ejecuta en cada lectura del plan (pestaña Entrenamiento y panel) para que
 * nunca se desincronicen.
 */
export async function reconcilePlan(db: PrismaClient, userId: string): Promise<boolean> {
  // El orden de la consulta importa: con varias rutinas en la misma posición
  // (por ejemplo, todas a 0 tras la actualización) el desempate tiene que ser
  // siempre el mismo o el plan se reescribiría en cada lectura.
  const routines = await db.routine.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, timesPerWeek: true, inPlan: true, order: true },
  });
  const desired = planSequence(routines);
  const current = await db.planSlot.findMany({ where: { userId }, orderBy: { order: "asc" } });

  const inSync =
    current.length === desired.length &&
    current.every((s, i) => s.routineId === desired[i] && s.order === i);

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { planPosition: true, weeklyTargetDays: true },
  });
  const target = Math.min(7, routines.reduce((acc, r) => acc + (r.inPlan ? r.timesPerWeek : 0), 0));

  // Camino rápido: el plan ya está como debe y no se escribe nada
  if (inSync) {
    if (user.weeklyTargetDays !== target) await syncWeeklyTarget(db, userId);
    if (desired.length > 0 && user.planPosition >= desired.length) {
      await db.user.update({ where: { id: userId }, data: { planPosition: 0 } });
    }
    return false;
  }

  // La rutina que tocaba sigue tocando: se busca su primera aparición en la
  // nueva secuencia para no perder por dónde iba el usuario.
  const pending = current.length > 0 ? current[user.planPosition % current.length]?.routineId : null;
  const recovered = pending ? desired.indexOf(pending) : -1;

  await db.planSlot.deleteMany({ where: { userId } });
  if (desired.length > 0) {
    await db.planSlot.createMany({
      data: desired.map((routineId, order) => ({ userId, routineId, order })),
    });
  }
  await db.user.update({
    where: { id: userId },
    data: { planPosition: recovered > 0 ? recovered : 0 },
  });
  await syncWeeklyTarget(db, userId);
  return true;
}
