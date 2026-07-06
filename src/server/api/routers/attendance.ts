import { z } from "zod";
import { startOfDay, subDays, isSameDay, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { awardPoints, addFeed, notify, checkAchievements } from "@/server/services/gamification";

export const attendanceRouter = createTRPCRouter({
  // Registrar asistencia de hoy (o de una fecha pasada)
  checkIn: protectedProcedure
    .input(
      z.object({
        date: z.date().optional(),
        gymName: z.string().max(80).optional(),
        notes: z.string().max(300).optional(),
      }).optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const date = startOfDay(input?.date ?? new Date());

      const existing = await ctx.db.attendance.findUnique({
        where: { userId_date: { userId, date } },
      });
      if (existing) return { attendance: existing, alreadyRegistered: true, streak: null as number | null };

      const attendance = await ctx.db.attendance.create({
        data: { userId, date, gymName: input?.gymName, notes: input?.notes },
      });

      // --- Actualizar racha ---
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId } });
      const yesterday = startOfDay(subDays(date, 1));
      let currentStreak: number;
      if (user.lastAttendanceDate && isSameDay(startOfDay(user.lastAttendanceDate), yesterday)) {
        currentStreak = user.currentStreak + 1;
      } else if (user.lastAttendanceDate && isSameDay(startOfDay(user.lastAttendanceDate), date)) {
        currentStreak = user.currentStreak;
      } else {
        currentStreak = 1;
      }
      const bestStreak = Math.max(user.bestStreak, currentStreak);
      const brokeRecord = currentStreak > user.bestStreak && user.bestStreak > 0;

      await ctx.db.user.update({
        where: { id: userId },
        data: { currentStreak, bestStreak, lastAttendanceDate: date },
      });

      await awardPoints(ctx.db, userId, "ATTENDANCE", { date: date.toISOString() });

      if (currentStreak > 0 && currentStreak % 7 === 0) {
        await awardPoints(ctx.db, userId, "STREAK_7", { streak: currentStreak });
        await notify(ctx.db, userId, "STREAK", `¡Racha de ${currentStreak} días! 🔥`, "+50 puntos por tu constancia");
        await addFeed(ctx.db, userId, "STREAK", `${user.name} lleva una racha de ${currentStreak} días 🔥`);
      }
      if (brokeRecord) {
        await notify(ctx.db, userId, "STREAK", "¡Nuevo récord de racha! 🏆", `${currentStreak} días seguidos, tu mejor marca hasta ahora`);
      }

      await checkAchievements(ctx.db, userId);
      return { attendance, alreadyRegistered: false, streak: currentStreak };
    }),

  checkOut: protectedProcedure
    .input(z.object({ attendanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const attendance = await ctx.db.attendance.findUnique({ where: { id: input.attendanceId } });
      if (!attendance || attendance.userId !== ctx.session.user.id) return null;
      return ctx.db.attendance.update({
        where: { id: input.attendanceId },
        data: { checkOut: new Date() },
      });
    }),

  // Días del mes para el calendario
  month: protectedProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(0).max(11) }))
    .query(async ({ ctx, input }) => {
      const start = new Date(input.year, input.month, 1);
      return ctx.db.attendance.findMany({
        where: {
          userId: ctx.session.user.id,
          date: { gte: startOfMonth(start), lte: endOfMonth(start) },
        },
        orderBy: { date: "asc" },
      });
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const now = new Date();
    const [user, thisMonth, thisYear, total, first] = await Promise.all([
      ctx.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { currentStreak: true, bestStreak: true, lastAttendanceDate: true },
      }),
      ctx.db.attendance.count({
        where: { userId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      }),
      ctx.db.attendance.count({ where: { userId, date: { gte: startOfYear(now) } } }),
      ctx.db.attendance.count({ where: { userId } }),
      ctx.db.attendance.findFirst({ where: { userId }, orderBy: { date: "asc" } }),
    ]);

    // Promedios desde la primera asistencia
    let weeklyAvg = 0;
    let monthlyAvg = 0;
    if (first) {
      const days = Math.max(1, Math.ceil((now.getTime() - first.date.getTime()) / 86400000));
      weeklyAvg = Math.round((total / days) * 7 * 10) / 10;
      monthlyAvg = Math.round((total / days) * 30 * 10) / 10;
    }

    return { ...user, thisMonth, thisYear, total, weeklyAvg, monthlyAvg };
  }),
});
