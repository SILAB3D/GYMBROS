import { z } from "zod";
import { hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/api/trpc";

export const userRouter = createTRPCRouter({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50),
        email: z.string().email(),
        password: z.string().min(8),
        inviteCode: z.string(),
        gymStartDate: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.inviteCode !== process.env.INVITE_CODE) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Código de invitación incorrecto" });
      }
      const email = input.email.toLowerCase().trim();
      const existing = await ctx.db.user.findUnique({ where: { email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cuenta con ese email" });
      }
      const isFirst = (await ctx.db.user.count()) === 0;
      const user = await ctx.db.user.create({
        data: {
          email,
          name: input.name.trim(),
          passwordHash: await hash(input.password, 12),
          gymStartDate: input.gymStartDate,
          role: isFirst ? "ADMIN" : "USER", // el primer usuario es admin
        },
      });
      return { id: user.id };
    }),

  me: protectedProcedure.query(({ ctx }) =>
    ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: {
        id: true, email: true, name: true, avatarUrl: true, gymStartDate: true,
        role: true, currentStreak: true, bestStreak: true, createdAt: true, notifyPrefs: true,
      },
    }),
  ),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50).optional(),
        avatarUrl: z.string().url().nullable().optional(),
        gymStartDate: z.date().nullable().optional(),
        notifyPrefs: z.record(z.boolean()).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.user.update({ where: { id: ctx.session.user.id }, data: input }),
    ),

  changePassword: protectedProcedure
    .input(z.object({ current: z.string(), next: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const { compare } = await import("bcryptjs");
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.session.user.id } });
      if (!(await compare(input.current, user.passwordHash))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La contraseña actual no es correcta" });
      }
      await ctx.db.user.update({
        where: { id: user.id },
        data: { passwordHash: await hash(input.next, 12) },
      });
      return { ok: true };
    }),

  // Perfil público: solo datos visibles para el grupo. Nunca métricas corporales.
  publicProfile: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: {
          id: true, name: true, avatarUrl: true, gymStartDate: true,
          currentStreak: true, bestStreak: true, createdAt: true,
        },
      });
      const [attendances, workouts, recentPRs, publicGoals, sharedRoutines, achievements, points] =
        await Promise.all([
          ctx.db.attendance.count({ where: { userId: user.id } }),
          ctx.db.workout.count({ where: { userId: user.id, endedAt: { not: null } } }),
          ctx.db.personalRecord.findMany({
            where: { userId: user.id },
            orderBy: { date: "desc" },
            take: 5,
            include: { exercise: true },
          }),
          ctx.db.goal.findMany({
            where: { userId: user.id, isPublic: true, status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
          ctx.db.routine.findMany({
            where: { userId: user.id, isShared: true },
            include: { _count: { select: { exercises: true } } },
          }),
          ctx.db.userAchievement.findMany({
            where: { userId: user.id },
            include: { achievement: true },
            orderBy: { earnedAt: "desc" },
          }),
          ctx.db.pointEvent.aggregate({ where: { userId: user.id }, _sum: { points: true } }),
        ]);
      return {
        user, attendances, workouts, recentPRs, publicGoals, sharedRoutines, achievements,
        totalPoints: points._sum.points ?? 0,
      };
    }),

  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({
      select: { id: true, name: true, avatarUrl: true, currentStreak: true },
      orderBy: { name: "asc" },
    }),
  ),
});
