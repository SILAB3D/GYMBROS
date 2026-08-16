import { z } from "zod";
import { hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { startOfISOWeek, endOfISOWeek } from "date-fns";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import { effectiveWeekStreak, streaksForUsers } from "@/server/services/streak";
import { trainingProfiles, affinityBetween } from "@/server/services/affinity";

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
        weeklyTargetDays: true, investmentEnabled: true, onboardingDone: true,
      },
    }),
  ),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50).optional(),
        avatarUrl: z
          .string()
          .max(300_000)
          .refine(
            (v) => /^https?:\/\//.test(v) || v.startsWith("data:image/"),
            "Debe ser una URL o una imagen subida",
          )
          .nullable()
          .optional(),
        gymStartDate: z.date().nullable().optional(),
        investmentEnabled: z.boolean().optional(),
        notifyPrefs: z.record(z.boolean()).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.user.update({ where: { id: ctx.session.user.id }, data: input }),
    ),

  completeOnboarding: protectedProcedure.mutation(({ ctx }) =>
    ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { onboardingDone: true },
    }),
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

  /**
   * Resetea el perfil: borra TODOS los registros de actividad del usuario.
   * Conserva la cuenta, las rutinas y los ejercicios personalizados.
   */
  resetData: protectedProcedure
    .input(z.object({ confirmation: z.literal("RESET") }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      await ctx.db.$transaction([
        ctx.db.pointEvent.deleteMany({ where: { userId } }),
        ctx.db.notification.deleteMany({ where: { userId } }),
        ctx.db.feedComment.deleteMany({ where: { userId } }),
        ctx.db.feedLike.deleteMany({ where: { userId } }),
        ctx.db.feedItem.deleteMany({ where: { userId } }),
        ctx.db.personalRecord.deleteMany({ where: { userId } }),
        ctx.db.bodyMetric.deleteMany({ where: { userId } }),
        ctx.db.attendance.deleteMany({ where: { userId } }),
        ctx.db.workout.deleteMany({ where: { userId } }),
        ctx.db.userAchievement.deleteMany({ where: { userId } }),
        ctx.db.user.update({
          where: { id: userId },
          data: {
            currentStreak: 0,
            bestStreak: 0,
            lastAttendanceDate: null,
            lastCompletedWeek: null,
            streakWarnedWeek: null,
            streakLostWeek: null,
            planPosition: 0,
          },
        }),
      ]);
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
          currentStreak: true, bestStreak: true, lastCompletedWeek: true, createdAt: true,
          weeklyTargetDays: true,
        },
      });
      const [attendances, workouts, recentPRs, routines, achievements, points, breakdownRaw, weekCount] =
        await Promise.all([
          ctx.db.attendance.count({ where: { userId: user.id } }),
          ctx.db.workout.count({ where: { userId: user.id, endedAt: { not: null } } }),
          // PRs públicos como evento, pero SIN el peso alcanzado (privado)
          ctx.db.personalRecord.findMany({
            where: { userId: user.id },
            orderBy: { date: "desc" },
            take: 5,
            select: { id: true, date: true, exercise: { select: { name: true } } },
          }),
          // Rutinas públicas: ejercicios, series y repeticiones. Los pesos NUNCA se exponen.
          ctx.db.routine.findMany({
            where: { userId: user.id },
            select: {
              id: true, name: true, description: true, color: true, emoji: true,
              recommendedDays: true, estimatedMinutes: true, isShared: true,
              exercises: {
                orderBy: { order: "asc" },
                select: {
                  id: true, sets: true, reps: true, order: true,
                  exercise: { select: { name: true, muscleGroup: true } },
                },
              },
            },
            orderBy: { updatedAt: "desc" },
          }),
          ctx.db.userAchievement.findMany({
            where: { userId: user.id },
            include: { achievement: true },
            orderBy: { earnedAt: "desc" },
          }),
          ctx.db.pointEvent.aggregate({ where: { userId: user.id }, _sum: { points: true } }),
          ctx.db.pointEvent.groupBy({
            by: ["type"],
            where: { userId: user.id },
            _sum: { points: true },
            _count: true,
          }),
          ctx.db.attendance.count({
            where: {
              userId: input.userId,
              date: { gte: startOfISOWeek(new Date()), lte: endOfISOWeek(new Date()) },
            },
          }),
        ]);
      const { lastCompletedWeek, weeklyTargetDays, ...publicUser } = user;
      return {
        user: {
          ...publicUser,
          currentStreak: effectiveWeekStreak({
            currentStreak: user.currentStreak,
            lastCompletedWeek,
            weeklyTargetDays,
            weekCount,
          }),
        },
        attendances, workouts, recentPRs, routines, achievements,
        totalPoints: points._sum.points ?? 0,
        pointsBreakdown: breakdownRaw.map((g) => ({ type: g.type, points: g._sum.points ?? 0, count: g._count })),
      };
    }),

  // Calendario de asistencias de un miembro del grupo (solo fechas)
  memberCalendar: protectedProcedure
    .input(z.object({ userId: z.string(), year: z.number().int(), month: z.number().int().min(0).max(11) }))
    .query(async ({ ctx, input }) => {
      const from = new Date(input.year, input.month, 1);
      const to = new Date(input.year, input.month + 1, 0, 23, 59, 59);
      const attendances = await ctx.db.attendance.findMany({
        where: { userId: input.userId, date: { gte: from, lte: to } },
        select: { date: true },
        orderBy: { date: "asc" },
      });
      return attendances.map((a) => a.date);
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.user.id;
    const [users, profiles] = await Promise.all([
      ctx.db.user.findMany({
        select: {
          id: true, name: true, avatarUrl: true,
          currentStreak: true, lastCompletedWeek: true, weeklyTargetDays: true,
        },
        orderBy: { name: "asc" },
      }),
      trainingProfiles(ctx.db),
    ]);
    const streaks = await streaksForUsers(ctx.db, users);
    const myProfile = profiles.get(me);

    return users.map(({ lastCompletedWeek, weeklyTargetDays, ...u }) => {
      const profile = profiles.get(u.id);
      const affinity = u.id === me ? null : affinityBetween(myProfile, profile);
      return {
        ...u,
        currentStreak: streaks.get(u.id) ?? 0,
        isMe: u.id === me,
        affinity,
        // Datos de su forma de entrenar, para explicar de dónde sale el número
        profile: profile
          ? {
              weekly: profile.weekly,
              avgExercises: Math.round(profile.avgExercises * 10) / 10,
              avgSets: Math.round(profile.avgSets * 10) / 10,
              topMuscle: profile.topMuscle,
              routines: profile.routines,
            }
          : null,
        myProfileEmpty: !myProfile || myProfile.routines === 0,
      };
    });
  }),
});
