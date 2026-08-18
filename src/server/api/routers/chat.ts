import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { subYears } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { isGroupAdmin, requireGroup } from "@/server/services/group";

export const chatRouter = createTRPCRouter({
  // Últimos 100 mensajes, en orden cronológico.
  // No incluye avatares: la vista los resuelve con user.list (mucho más ligero).
  list: protectedProcedure.query(async ({ ctx }) => {
    // Los mensajes con más de 1 año se eliminan automáticamente
    await ctx.db.chatMessage.deleteMany({
      where: { createdAt: { lt: subYears(new Date(), 1) } },
    });
    if (!ctx.groupId) return [];
    const messages = await ctx.db.chatMessage.findMany({
      where: { groupId: ctx.groupId },
      include: {
        user: { select: { id: true, name: true } },
        reactions: { select: { userId: true, emoji: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    // Abrir el chat marca todo como leído
    await ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { lastChatReadAt: new Date() },
    });
    return messages.reverse();
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const me = await ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: { lastChatReadAt: true },
    });
    if (!ctx.groupId) return 0;
    return ctx.db.chatMessage.count({
      where: {
        groupId: ctx.groupId,
        userId: { not: ctx.session.user.id },
        createdAt: { gt: me.lastChatReadAt ?? new Date(0) },
      },
    });
  }),

  toggleReaction: protectedProcedure
    .input(z.object({ messageId: z.string(), emoji: z.enum(["👍", "💪", "🔥"]) }))
    .mutation(async ({ ctx, input }) => {
      const key = { messageId: input.messageId, userId: ctx.session.user.id, emoji: input.emoji };
      const existing = await ctx.db.chatReaction.findUnique({
        where: { messageId_userId_emoji: key },
      });
      if (existing) {
        await ctx.db.chatReaction.delete({ where: { messageId_userId_emoji: key } });
        return { reacted: false };
      }
      await ctx.db.chatReaction.create({ data: key });
      return { reacted: true };
    }),

  send: protectedProcedure
    .input(z.object({ text: z.string().trim().min(1).max(1000) }))
    .mutation(({ ctx, input }) =>
      ctx.db.chatMessage.create({
        data: { userId: ctx.session.user.id, text: input.text, groupId: requireGroup(ctx.groupId) },
      }),
    ),

  // Cada uno puede borrar sus mensajes; el admin del grupo, cualquiera
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const message = await ctx.db.chatMessage.findUnique({ where: { id: input.id } });
    if (!message || message.groupId !== ctx.groupId) throw new TRPCError({ code: "NOT_FOUND" });
    const isAdmin =
      ctx.session.user.role === "ADMIN" ||
      (await isGroupAdmin(ctx.db, ctx.groupId, ctx.session.user.id));
    if (message.userId !== ctx.session.user.id && !isAdmin) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    await ctx.db.chatMessage.delete({ where: { id: input.id } });
    return { ok: true };
  }),
});
