import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const pushRouter = createTRPCRouter({
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(1000),
        p256dh: z.string().max(500),
        auth: z.string().max(500),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        update: { userId: ctx.session.user.id, p256dh: input.p256dh, auth: input.auth },
        create: { userId: ctx.session.user.id, ...input },
      }),
    ),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: ctx.session.user.id },
      });
      return { ok: true };
    }),
});
