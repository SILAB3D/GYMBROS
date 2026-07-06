import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const notificationRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        onlyUnread: z.boolean().default(false),
        type: z.nativeEnum(NotificationType).optional(),
        limit: z.number().int().min(1).max(100).default(30),
      }).optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.notification.findMany({
        where: {
          userId: ctx.session.user.id,
          ...(input?.onlyUnread ? { read: false } : {}),
          ...(input?.type ? { type: input.type } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 30,
      }),
    ),

  unreadCount: protectedProcedure.query(({ ctx }) =>
    ctx.db.notification.count({ where: { userId: ctx.session.user.id, read: false } }),
  ),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().optional() })) // sin id = marcar todas
    .mutation(({ ctx, input }) =>
      ctx.db.notification.updateMany({
        where: { userId: ctx.session.user.id, ...(input.id ? { id: input.id } : {}) },
        data: { read: true },
      }),
    ),
});
