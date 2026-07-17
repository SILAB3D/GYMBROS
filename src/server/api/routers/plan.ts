import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { reconcilePlan } from "@/server/services/plan-service";

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

export const planRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    // Sincronización: el nº de apariciones de cada rutina = sus «veces por semana»
    const needsReview = await reconcilePlan(ctx.db, userId);
    const [slots, user] = await Promise.all([
      getOrderedSlots(ctx.db, userId),
      ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { planPosition: true } }),
    ]);
    const weeklyTarget = await ctx.db.user
      .findUniqueOrThrow({ where: { id: userId }, select: { weeklyTargetDays: true } })
      .then((u) => u.weeklyTargetDays);
    const position = slots.length > 0 ? user.planPosition % slots.length : 0;
    return { slots, position, weeklyTarget, needsReview };
  }),

  // El usuario ya revisó el plan tras un cambio automático
  dismissReview: protectedProcedure.mutation(({ ctx }) =>
    ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { planNeedsReview: false },
    }),
  ),

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
    await ctx.db.user.update({
      where: { id: userId },
      data: { planPosition: 0, planNeedsReview: false },
    });
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
