import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { reconcilePlan } from "@/server/services/plan-service";

/**
 * Plan de entrenamiento: secuencia ordenada de rutinas que sale del orden y de
 * las «veces por semana» que el usuario fija en sus rutinas. La posición avanza
 * automáticamente al completar la rutina que toca.
 *
 * Ya no hay pantalla propia: el plan se ordena desde «Mi plan de entrenamiento»
 * (la lista de rutinas) y aquí solo se consulta qué toca.
 */

const slotInclude = {
  routine: {
    select: {
      id: true, name: true, emoji: true, color: true, estimatedMinutes: true,
      _count: { select: { exercises: true } },
    },
  },
} as const;

export const planRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    // Sincronización: la secuencia sigue siempre al orden de las rutinas
    await reconcilePlan(ctx.db, userId);
    const [slots, user] = await Promise.all([
      ctx.db.planSlot.findMany({ where: { userId }, include: slotInclude, orderBy: { order: "asc" } }),
      ctx.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { planPosition: true, weeklyTargetDays: true },
      }),
    ]);
    const position = slots.length > 0 ? user.planPosition % slots.length : 0;
    return { slots, position, weeklyTarget: user.weeklyTargetDays };
  }),

  // Avanzar manualmente (saltar la rutina que toca)
  advance: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const count = await ctx.db.planSlot.count({ where: { userId } });
    if (count === 0) return { ok: true };
    const user = await ctx.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { planPosition: true },
    });
    await ctx.db.user.update({
      where: { id: userId },
      data: { planPosition: (user.planPosition + 1) % count },
    });
    return { ok: true };
  }),
});
