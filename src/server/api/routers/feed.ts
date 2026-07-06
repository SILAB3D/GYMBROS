import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const feedRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.feedItem.findMany({
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
