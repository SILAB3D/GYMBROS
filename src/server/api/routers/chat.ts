import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { subYears } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const chatRouter = createTRPCRouter({
  // Últimos 100 mensajes, en orden cronológico.
  // No incluye avatares: la vista los resuelve con user.list (mucho más ligero).
  list: protectedProcedure.query(async ({ ctx }) => {
    // Los mensajes con más de 1 año se eliminan automáticamente
    await ctx.db.chatMessage.deleteMany({
      where: { createdAt: { lt: subYears(new Date(), 1) } },
    });
    const messages = await ctx.db.chatMessage.findMany({
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return messages.reverse();
  }),

  send: protectedProcedure
    .input(z.object({ text: z.string().trim().min(1).max(1000) }))
    .mutation(({ ctx, input }) =>
      ctx.db.chatMessage.create({ data: { userId: ctx.session.user.id, text: input.text } }),
    ),

  // Cada uno puede borrar sus mensajes; el admin, cualquiera
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const message = await ctx.db.chatMessage.findUnique({ where: { id: input.id } });
    if (!message) throw new TRPCError({ code: "NOT_FOUND" });
    if (message.userId !== ctx.session.user.id && ctx.session.user.role !== "ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    await ctx.db.chatMessage.delete({ where: { id: input.id } });
    return { ok: true };
  }),
});
