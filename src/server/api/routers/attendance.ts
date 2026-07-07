import { z } from "zod";
import {
  startOfMonth, endOfMonth, startOfYear, startOfISOWeek, endOfISOWeek,
} from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { registerAttendance } from "@/server/services/attendance-service";
import { effectiveWeekStreak } from "@/server/services/streak";

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
    .mutation(({ ctx, input }) =>
      registerAttendance(ctx.db, ctx.session.user.id, input?.date ?? new Date(), {
        gymName: input?.gymName,
        notes: input?.notes,
      }),
    ),

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
    const [user, thisWeek, thisMonth, thisYear, total, first] = await Promise.all([
      ctx.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { currentStreak: true, bestStreak: true, lastCompletedWeek: true, weeklyTargetDays: true },
      }),
      ctx.db.attendance.count({
        where: { userId, date: { gte: startOfISOWeek(now), lte: endOfISOWeek(now) } },
      }),
      ctx.db.attendance.count({
        where: { userId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      }),
      ctx.db.attendance.count({ where: { userId, date: { gte: startOfYear(now) } } }),
      ctx.db.attendance.count({ where: { userId } }),
      ctx.db.attendance.findFirst({ where: { userId }, orderBy: { date: "asc" } }),
    ]);

    let weeklyAvg = 0;
    let monthlyAvg = 0;
    if (first) {
      const days = Math.max(1, Math.ceil((now.getTime() - first.date.getTime()) / 86400000));
      weeklyAvg = Math.round((total / days) * 7 * 10) / 10;
      monthlyAvg = Math.round((total / days) * 30 * 10) / 10;
    }

    return {
      currentStreak: effectiveWeekStreak(user.currentStreak, user.lastCompletedWeek),
      bestStreak: user.bestStreak,
      weeklyTargetDays: user.weeklyTargetDays,
      thisWeek, thisMonth, thisYear, total, weeklyAvg, monthlyAvg,
    };
  }),
});
