import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

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
    // (los descansos ahora se derivan de los días semanales configurados)
    await ctx.db.planSlot.deleteMany({ where: { userId, routineId: null } });
    const [slots, user] = await Promise.all([
      getOrderedSlots(ctx.db, userId),
      ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { planPosition: true } }),
    ]);
    const position = slots.length > 0 ? user.planPosition % slots.length : 0;
    return { slots, position };
  }),

  addSlot: protectedProcedure
    .input(z.object({ routineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const routine = await ctx.db.routine.findUnique({ where: { id: input.routineId } });
      if (!routine || routine.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
      const last = await ctx.db.planSlot.findFirst({ where: { userId }, orderBy: { order: "desc" } });
      return ctx.db.planSlot.create({
        data: { userId, routineId: input.routineId, order: (last?.order ?? -1) + 1 },
      });
    }),

  removeSlot: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const slot = await ctx.db.planSlot.findUnique({ where: { id: input.id } });
    if (!slot || slot.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    await ctx.db.planSlot.delete({ where: { id: input.id } });
    const len = await reindex(ctx.db, ctx.session.user.id);
    // Mantener la posición dentro del rango
    const user = await ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: { planPosition: true },
    });
    if (len > 0 && user.planPosition >= len) {
      await ctx.db.user.update({ where: { id: ctx.session.user.id }, data: { planPosition: 0 } });
    }
    return { ok: true };
  }),

  move: protectedProcedure
    .input(z.object({ id: z.string(), direction: z.enum(["up", "down"]) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const slots = await ctx.db.planSlot.findMany({ where: { userId }, orderBy: { order: "asc" } });
      const index = slots.findIndex((s) => s.id === input.id);
      if (index === -1) throw new TRPCError({ code: "NOT_FOUND" });
      const target = input.direction === "up" ? index - 1 : index + 1;
      const other = slots[target];
      const current = slots[index];
      if (!other || !current) return { ok: true }; // ya está en el extremo
      await ctx.db.$transaction([
        ctx.db.planSlot.update({ where: { id: current.id }, data: { order: other.order } }),
        ctx.db.planSlot.update({ where: { id: other.id }, data: { order: current.order } }),
      ]);
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
