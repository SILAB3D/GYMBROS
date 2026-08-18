import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { groupMemberIds } from "@/server/services/group";

export const feedRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
    // Las publicaciones son del usuario (se generan con sus PRs, rachas…) y
    // se ven en todos sus grupos: aquí se filtra por quién está en este.
    .query(async ({ ctx, input }) =>
      ctx.db.feedItem.findMany({
        where: { userId: { in: await groupMemberIds(ctx.db, ctx.groupId) } },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          likes: { select: { userId: true } },
          comments: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 30,
      }),
    ),

  toggleLike: protectedProcedure
    .input(z.object({ feedItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const key = { userId: ctx.session.user.id, feedItemId: input.feedItemId };
      const existing = await ctx.db.feedLike.findUnique({ where: { userId_feedItemId: key } });
      if (existing) {
        await ctx.db.feedLike.delete({ where: { userId_feedItemId: key } });
        return { liked: false };
      }
      await ctx.db.feedLike.create({ data: key });
      return { liked: true };
    }),

  comment: protectedProcedure
    .input(z.object({ feedItemId: z.string(), text: z.string().min(1).max(300) }))
    .mutation(({ ctx, input }) =>
      ctx.db.feedComment.create({
        data: { userId: ctx.session.user.id, ...input },
      }),
    ),
});
