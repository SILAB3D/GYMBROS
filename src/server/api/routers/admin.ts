import { z } from "zod";
import { PointType, Role } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";

export const adminRouter = createTRPCRouter({
  users: adminProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, createdAt: true,
        currentStreak: true,
        _count: { select: { workouts: true, attendances: true, personalRecords: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ),

  setRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.nativeEnum(Role) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id && input.role === "USER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes quitarte el rol de admin a ti mismo" });
      }
      return ctx.db.user.update({ where: { id: input.userId }, data: { role: input.role } });
    }),

  deleteUser: adminProcedure.input(z.object({ userId: z.string() })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.session.user.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes eliminarte a ti mismo" });
    }
    await ctx.db.user.delete({ where: { id: input.userId } });
    return { ok: true };
  }),

  pointsConfig: adminProcedure.query(({ ctx }) => ctx.db.pointsConfig.findMany()),

  setPoints: adminProcedure
    .input(z.object({ type: z.nativeEnum(PointType), points: z.number().int().min(0).max(1000) }))
    .mutation(({ ctx, input }) =>
      ctx.db.pointsConfig.upsert({
        where: { type: input.type },
        update: { points: input.points },
        create: input,
      }),
    ),

  deleteFeedItem: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.feedItem.delete({ where: { id: input.id } }),
  ),

  broadcast: adminProcedure
    .input(z.object({ title: z.string().min(1).max(120), body: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const users = await ctx.db.user.findMany({ select: { id: true } });
      await ctx.db.notification.createMany({
        data: users.map((u) => ({ userId: u.id, type: "SYSTEM" as const, title: input.title, body: input.body })),
      });
      return { sent: users.length };
    }),
});
