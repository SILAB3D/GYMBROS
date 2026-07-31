import type { PrismaClient } from "@prisma/client";
import { syncWeeklyTarget } from "./weekly-target";

/**
 * Reconcilia el plan con las rutinas: cada rutina habilitada aparece
 * EXACTAMENTE «timesPerWeek» veces. Se ejecuta en cada lectura del plan
 * (pestaña Plan y panel principal) para que nunca se desincronicen.
 */
export async function reconcilePlan(db: PrismaClient, userId: string): Promise<boolean> {
  const routines = await db.routine.findMany({
    where: { userId },
    select: { id: true, timesPerWeek: true, inPlan: true },
  });
  const desired = new Map(routines.map((r) => [r.id, r.inPlan ? r.timesPerWeek : 0]));
  const current = await db.planSlot.findMany({ where: { userId }, orderBy: { order: "asc" } });

  const seen = new Map<string, number>();
  const toDelete: string[] = [];
  for (const slot of current) {
    const count = (seen.get(slot.routineId ?? "") ?? 0) + 1;
    seen.set(slot.routineId ?? "", count);
    if (count > (desired.get(slot.routineId ?? "") ?? 0)) toDelete.push(slot.id);
  }
  const additions: string[] = [];
  for (const r of routines) {
    const want = r.inPlan ? r.timesPerWeek : 0;
    for (let i = seen.get(r.id) ?? 0; i < want; i++) additions.push(r.id);
  }

  const changed = toDelete.length > 0 || additions.length > 0;

  // Camino rápido: si el plan ya está sincronizado, no se escribe nada
  if (!changed) {
    const restDays = current.some((s) => s.routineId === null);
    if (!restDays) {
      const user = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { planPosition: true, planNeedsReview: true, weeklyTargetDays: true },
      });
      const target = Math.min(7, routines.reduce((a, r) => a + (r.inPlan ? r.timesPerWeek : 0), 0));
      const positionOk = current.length === 0 || user.planPosition < current.length;
      const orderOk = current.every((s, i) => s.order === i);
      if (user.weeklyTargetDays === target && positionOk && orderOk) {
        return user.planNeedsReview;
      }
    }
  }

  // Camino completo: hay cambios que aplicar
  await db.planSlot.deleteMany({ where: { userId, routineId: null } });
  await syncWeeklyTarget(db, userId);
  if (toDelete.length > 0) {
    await db.planSlot.deleteMany({ where: { id: { in: toDelete } } });
  }
  if (additions.length > 0) {
    const last = await db.planSlot.findFirst({ where: { userId }, orderBy: { order: "desc" } });
    let next = (last?.order ?? -1) + 1;
    await db.planSlot.createMany({
      data: additions.map((routineId) => ({ userId, routineId, order: next++ })),
    });
  }

  // Reindexar SIEMPRE (los borrados en cascada dejan huecos) y acotar la posición
  const slots = await db.planSlot.findMany({ where: { userId }, orderBy: { order: "asc" } });
  await Promise.all(
    slots.map((s, i) =>
      s.order === i ? null : db.planSlot.update({ where: { id: s.id }, data: { order: i } }),
    ),
  );
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { planPosition: true, planNeedsReview: true },
  });
  if (slots.length > 0 && user.planPosition >= slots.length) {
    await db.user.update({ where: { id: userId }, data: { planPosition: 0 } });
  }
  // Avisar de que conviene revisar el orden tras un cambio automático
  if (changed && !user.planNeedsReview) {
    await db.user.update({ where: { id: userId }, data: { planNeedsReview: true } });
  }
  return changed || user.planNeedsReview;
}
