import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  startOfMonth, endOfMonth, startOfYear, startOfISOWeek, endOfISOWeek, startOfDay, endOfDay,
  differenceInMinutes, format,
} from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { registerAttendance, deleteTrainingDay } from "@/server/services/attendance-service";
import { weekStreakState } from "@/server/services/streak";

const DEFAULT_ESTIMATED_MIN = 60;

export const attendanceRouter = createTRPCRouter({
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

  // Detalle de un día: asistencia y entrenos registrados (para el historial)
  day: protectedProcedure
    .input(z.object({ date: z.date() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const date = startOfDay(input.date);
      const [attendance, workouts] = await Promise.all([
        ctx.db.attendance.findUnique({ where: { userId_date: { userId, date } } }),
        ctx.db.workout.findMany({
          where: { userId, startedAt: { gte: date, lte: endOfDay(input.date) } },
          include: {
            routine: true,
            exercises: {
              orderBy: { order: "asc" },
              include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
            },
          },
          orderBy: { startedAt: "asc" },
        }),
      ]);
      return { date, attendance, workouts };
    }),

  // Borrar un día entrenado: elimina el entreno y todo lo que generó
  // (puntos, PRs automáticos y feed) y recalcula la racha.
  deleteDay: protectedProcedure
    .input(z.object({ date: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const date = startOfDay(input.date);
      const [attendance, workoutCount] = await Promise.all([
        ctx.db.attendance.findUnique({ where: { userId_date: { userId, date } } }),
        ctx.db.workout.count({
          where: { userId, startedAt: { gte: date, lte: endOfDay(input.date) } },
        }),
      ]);
      if (!attendance && workoutCount === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return deleteTrainingDay(ctx.db, userId, input.date);
    }),

  // Días del mes del propio usuario, con marca de "entreno corto" (<50% de lo estimado)
  month: protectedProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(0).max(11) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const start = startOfMonth(new Date(input.year, input.month, 1));
      const end = endOfMonth(start);
      const [attendances, workouts] = await Promise.all([
        ctx.db.attendance.findMany({
          where: { userId, date: { gte: start, lte: end } },
          orderBy: { date: "asc" },
        }),
        ctx.db.workout.findMany({
          where: { userId, endedAt: { not: null }, startedAt: { gte: start, lte: end } },
          select: { startedAt: true, endedAt: true, routine: { select: { estimatedMinutes: true } } },
        }),
      ]);
      // Días cuyo entreno duró menos del 50% de la duración estimada
      const shortDays = new Set<string>();
      for (const w of workouts) {
        if (!w.endedAt) continue;
        const dur = differenceInMinutes(w.endedAt, w.startedAt);
        const estimated = w.routine?.estimatedMinutes ?? DEFAULT_ESTIMATED_MIN;
        if (dur < estimated * 0.5) shortDays.add(format(startOfDay(w.startedAt), "yyyy-MM-dd"));
      }
      return {
        attendances,
        shortDates: attendances
          .filter((a) => shortDays.has(format(startOfDay(a.date), "yyyy-MM-dd")))
          .map((a) => a.date),
      };
    }),

  // Calendario de la comunidad: quién entrenó cada día del mes
  communityMonth: protectedProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(0).max(11) }))
    .query(async ({ ctx, input }) => {
      const start = startOfMonth(new Date(input.year, input.month, 1));
      const attendances = await ctx.db.attendance.findMany({
        where: { date: { gte: start, lte: endOfMonth(start) } },
        select: { date: true, user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { date: "asc" },
      });
      // Agrupar por día
      const byDay: Record<string, Array<{ id: string; name: string; avatarUrl: string | null }>> = {};
      for (const a of attendances) {
        const key = format(startOfDay(a.date), "yyyy-MM-dd");
        (byDay[key] ??= []).push(a.user);
      }
      return byDay;
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const now = new Date();
    const [user, thisWeek, thisMonth, thisYear, total, first] = await Promise.all([
      ctx.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { currentStreak: true, bestStreak: true, lastCompletedWeek: true, weeklyTargetDays: true },
      }),
      ctx.db.attendance.count({ where: { userId, date: { gte: startOfISOWeek(now), lte: endOfISOWeek(now) } } }),
      ctx.db.attendance.count({ where: { userId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } } }),
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

    const streak = weekStreakState({
      currentStreak: user.currentStreak,
      lastCompletedWeek: user.lastCompletedWeek,
      weeklyTargetDays: user.weeklyTargetDays,
      weekCount: thisWeek,
      now,
    });

    return {
      currentStreak: streak.streak,
      streakAtRisk: streak.atRisk,
      streakMissing: streak.missing,
      streakDaysLeft: streak.daysLeft,
      bestStreak: user.bestStreak,
      weeklyTargetDays: user.weeklyTargetDays,
      thisWeek, thisMonth, thisYear, total, weeklyAvg, monthlyAvg,
    };
  }),
});
