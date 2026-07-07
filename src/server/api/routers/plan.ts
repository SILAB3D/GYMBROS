import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { syncWeeklyTarget } from "@/server/services/weekly-target";

/**
 * Plan de entrenamiento: secuencia ordenada de rutinas y días de descanso.
 * La posición avanza automáticamente al completar la rutina que toca,
 * o manualmente ("Saltar" / "Descanso completado").
 */

const slotInclude = {
  routine: {
    select: {
      id: true, name: true, emoji: true, color: true, estimatedMinutes: true,
      _count: { select: { exercises: true } },
    },
  },
} as const;

async function getOrderedSlots(db: typeof import("@/lib/db").db, userId: string) {
  return db.planSlot.findMany({
    where: { userId },
    include: slotInclude,
    orderBy: { order: "asc" },
  });
}

/** Reindexa los slots 0..n-1 para que el orden quede compacto. */
async function reindex(db: typeof import("@/lib/db").db, userId: string) {
  const slots = await db.planSlot.findMany({ where: { userId }, orderBy: { order: "asc" } });
  await Promise.all(
    slots.map((s, i) => (s.order === i ? null : db.planSlot.update({ where: { id: s.id }, data: { order: i } }))),
  );
  return slots.length;
}

export const planRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    // Migración suave: los antiguos slots de descanso manuales desaparecen
    await ctx.db.planSlot.deleteMany({ where: { userId, routineId: null } });
    // Mantener el recuento de días de entreno/descanso siempre al día
    const weeklyTarget = await syncWeeklyTarget(ctx.db, userId);

    // Reconciliar: cada rutina aparece en el plan exactamente «timesPerWeek» veces.
    // Los cambios de frecuencia se reflejan al instante; el usuario solo ordena.
    const routines = await ctx.db.routine.findMany({
      where: { userId },
      select: { id: true, timesPerWeek: true, inPlan: true },
    });
    const desired = new Map(routines.map((r) => [r.id, r.inPlan ? r.timesPerWeek : 0]));
    const current = await ctx.db.planSlot.findMany({ where: { userId }, orderBy: { order: "asc" } });
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
    if (toDelete.length > 0) {
      await ctx.db.planSlot.deleteMany({ where: { id: { in: toDelete } } });
    }
    if (additions.length > 0) {
      const last = await ctx.db.planSlot.findFirst({ where: { userId }, orderBy: { order: "desc" } });
      let next = (last?.order ?? -1) + 1;
      await ctx.db.planSlot.createMany({
        data: additions.map((routineId) => ({ userId, routineId, order: next++ })),
      });
    }
    // Reindexar SIEMPRE: los borrados en cascada (p. ej. al eliminar una rutina)
    // dejan huecos en el orden y la posición podría quedar fuera de rango
    const count = await reindex(ctx.db, userId);
    const u = await ctx.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { planPosition: true },
    });
    if (count > 0 && u.planPosition >= count) {
      await ctx.db.user.update({ where: { id: userId }, data: { planPosition: 0 } });
    }
    const [slots, user] = await Promise.all([
      getOrderedSlots(ctx.db, userId),
      ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { planPosition: true } }),
    ]);
    const position = slots.length > 0 ? user.planPosition % slots.length : 0;
    return { slots, position, weeklyTarget };
  }),

  /**
   * Genera el orden automáticamente a partir de las «veces por semana»:
   * cada rutina aparece tantas veces como su frecuencia, intercaladas para
   * que ninguna se repita en días consecutivos (si es posible).
   */
  generate: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const routines = await ctx.db.routine.findMany({
      where: { userId, inPlan: true, timesPerWeek: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, timesPerWeek: true },
    });
    const remaining = routines.map((r) => ({ id: r.id, left: r.timesPerWeek }));
    const total = remaining.reduce((acc, r) => acc + r.left, 0);

    const order: string[] = [];
    let prev: string | null = null;
    for (let i = 0; i < total; i++) {
      const candidates = remaining.filter((r) => r.left > 0).sort((a, b) => b.left - a.left);
      const pick = candidates.find((c) => c.id !== prev) ?? candidates[0];
      if (!pick) break;
      order.push(pick.id);
      pick.left -= 1;
      prev = pick.id;
    }

    await ctx.db.planSlot.deleteMany({ where: { userId } });
    if (order.length > 0) {
      await ctx.db.planSlot.createMany({
        data: order.map((routineId, i) => ({ userId, routineId, order: i })),
      });
    }
    await ctx.db.user.update({ where: { id: userId }, data: { planPosition: 0 } });
    return { slots: order.length };
  }),

  move: protectedProcedure
    .input(z.object({ id: z.string(), direction: z.enum(["up", "down"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const slots = await ctx.db.planSlot.findMany({
        where: { userId },
        orderBy: [{ order: "asc" }, { id: "asc" }],
      });
      const index = slots.findIndex((s) => s.id === input.id);
      if (index === -1) throw new TRPCError({ code: "NOT_FOUND" });
      const target = input.direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= slots.length) return { ok: true }; // ya está en el extremo

      // Reordenar por índice y reescribir 0..n-1: inmune a huecos o duplicados
      const ids = slots.map((s) => s.id);
      const moved = ids.splice(index, 1)[0]!;
      ids.splice(target, 0, moved);
      await ctx.db.$transaction(
        ids.map((id, i) => ctx.db.planSlot.update({ where: { id }, data: { order: i } })),
      );

      // Si se movió el slot marcado como "siguiente", la posición lo sigue
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { planPosition: true },
      });
      const pos = slots.length > 0 ? user.planPosition % slots.length : 0;
      let newPos = pos;
      if (pos === index) newPos = target;
      else if (index < pos && target >= pos) newPos = pos - 1;
      else if (index > pos && target <= pos) newPos = pos + 1;
      if (newPos !== pos) {
        await ctx.db.user.update({ where: { id: userId }, data: { planPosition: newPos } });
      }
      return { ok: true };
    }),

  // Marcar un slot como "el siguiente que toca"
  setNext: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const slot = await ctx.db.planSlot.findUnique({ where: { id: input.id } });
    if (!slot || slot.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    await ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { planPosition: slot.order },
    });
    return { ok: true };
  }),

  // Avanzar manualmente (saltar rutina o dar el descanso por cumplido)
  advance: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const count = await ctx.db.planSlot.count({ where: { userId } });
    if (count === 0) return { ok: true };
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { planPosition: true } });
    await ctx.db.user.update({
      where: { id: userId },
      data: { planPosition: (user.planPosition + 1) % count },
    });
    return { ok: true };
  }),
});
