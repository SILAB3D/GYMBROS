import { z } from "zod";
import {
  startOfDay, startOfMonth, endOfMonth, startOfYear,
  startOfISOWeek, endOfISOWeek, subWeeks, isSameDay, format,
} from "date-fns";
import type { PointType } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { awardPoints, addFeed, notify, checkAchievements } from "@/server/services/gamification";
import { effectiveWeekStreak } from "@/server/services/streak";

/** Nivel de recompensa según las semanas consecutivas cumplidas. */
function streakLevel(weeks: number): { type: PointType; title: string } {
  if (weeks === 1) return { type: "STREAK_WEEK1", title: "¡Racha de 1 semana! 🔥" };
  if (weeks === 2) return { type: "STREAK_WEEK2", title: "¡Racha de 2 semanas! 🔥" };
  if (weeks === 3) return { type: "STREAK_WEEK3", title: "¡Racha de 3 semanas! 🔥" };
  if (weeks === 4) return { type: "STREAK_MONTH", title: "¡Racha de 1 mes! 🔥🔥" };
  return { type: "STREAK_CRACK", title: `¡CRACK! ${weeks} semanas seguidas 💎` };
}

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
      if (existing) return { attendance: existing, alreadyRegistered: true, weekStreak: null as number | null };

      const attendance = await ctx.db.attendance.create({
        data: { userId, date, gymName: input?.gymName, notes: input?.notes },
      });

      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId } });
      await ctx.db.user.update({ where: { id: userId }, data: { lastAttendanceDate: date } });

      // Puntos por día entrenado
      await awardPoints(ctx.db, userId, "ATTENDANCE", { date: date.toISOString() });

      // --- Racha semanal: se cumple la semana al alcanzar los días planificados ---
      let weekStreak: number | null = null;
      if (user.weeklyTargetDays > 0) {
        const weekStart = startOfISOWeek(date);
        const alreadyCounted =
          user.lastCompletedWeek && isSameDay(startOfISOWeek(user.lastCompletedWeek), weekStart);

        if (!alreadyCounted) {
          const weekCount = await ctx.db.attendance.count({
            where: { userId, date: { gte: weekStart, lte: endOfISOWeek(date) } },
          });
          if (weekCount >= user.weeklyTargetDays) {
            // ¿Continúa la racha (la semana anterior también se cumplió) o se reinicia?
            const previousWeek = subWeeks(weekStart, 1);
            const continues =
              user.lastCompletedWeek &&
              isSameDay(startOfISOWeek(user.lastCompletedWeek), previousWeek);
            weekStreak = continues ? user.currentStreak + 1 : 1;

            const level = streakLevel(weekStreak);
            const points = await awardPoints(ctx.db, userId, level.type, {
              week: format(weekStart, "yyyy-MM-dd"),
              streak: weekStreak,
            });

            await ctx.db.user.update({
              where: { id: userId },
              data: {
                currentStreak: weekStreak,
                bestStreak: Math.max(user.bestStreak, weekStreak),
                lastCompletedWeek: weekStart,
              },
            });

            await notify(
              ctx.db, userId, "STREAK", level.title,
              points > 0
                ? `+${points} puntos por cumplir tus ${user.weeklyTargetDays} días esta semana`
                : `Has cumplido tus ${user.weeklyTargetDays} días esta semana`,
            );
            if (weekStreak >= 4) {
              await addFeed(ctx.db, userId, "STREAK", `${user.name} lleva ${weekStreak} semanas cumpliendo su plan 💎`);
            } else {
              await addFeed(ctx.db, userId, "STREAK", `${user.name} cumplió su semana de entreno (racha de ${weekStreak}) ✅`);
            }
          }
        }
      }

      await checkAchievements(ctx.db, userId);
      return { attendance, alreadyRegistered: false, weekStreak };
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
