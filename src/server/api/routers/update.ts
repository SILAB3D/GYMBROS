import { z } from "zod";
import { UpdateReaction } from "@prisma/client";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/api/trpc";
import { APP_UPDATES, nextUpdateFor } from "@/lib/updates";

/**
 * Novedades de la app. El catálogo vive en src/lib/updates.ts; la base de
 * datos solo guarda quién ha visto cada una y con qué reacción.
 */
export const updateRouter = createTRPCRouter({
  // La novedad pendiente de ver, o null si está todo al día
  pending: protectedProcedure.query(async ({ ctx }) => {
    const seen = await ctx.db.updateSeen.findMany({
      where: { userId: ctx.session.user.id },
      select: { updateId: true },
    });
    return nextUpdateFor(seen.map((s) => s.updateId));
  }),

  // Marcar como vista con la reacción elegida. Idempotente: si ya estaba
  // marcada, se conserva la primera reacción.
  ack: protectedProcedure
    .input(z.object({ updateId: z.string(), reaction: z.nativeEnum(UpdateReaction) }))
    .mutation(async ({ ctx, input }) => {
      if (!APP_UPDATES.some((u) => u.id === input.updateId)) return { ok: false };
      await ctx.db.updateSeen.upsert({
        where: { userId_updateId: { userId: ctx.session.user.id, updateId: input.updateId } },
        update: {},
        create: { userId: ctx.session.user.id, ...input },
      });
      return { ok: true };
    }),

  /**
   * Cómo ha sentado cada novedad. Es ANÓNIMO a propósito: solo se devuelven
   * recuentos agregados, nunca quién ha votado qué.
   */
  reactions: adminProcedure.query(async ({ ctx }) => {
    const [grouped, totalUsers] = await Promise.all([
      ctx.db.updateSeen.groupBy({ by: ["updateId", "reaction"], _count: { _all: true } }),
      ctx.db.user.count(),
    ]);
    return APP_UPDATES.map((u) => {
      const like = grouped.find((g) => g.updateId === u.id && g.reaction === "LIKE")?._count._all ?? 0;
      const meh = grouped.find((g) => g.updateId === u.id && g.reaction === "MEH")?._count._all ?? 0;
      const seen = like + meh;
      return {
        id: u.id,
        title: u.title,
        emoji: u.emoji,
        date: u.date,
        like,
        meh,
        seen,
        pending: Math.max(0, totalUsers - seen),
        likePct: seen > 0 ? Math.round((like / seen) * 100) : null,
      };
    });
  }),
});
