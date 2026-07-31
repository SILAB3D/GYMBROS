import { startOfDay, startOfISOWeek, endOfISOWeek, startOfMonth, endOfMonth } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { autoCloseStaleWorkouts } from "@/server/services/workout-service";
import { effectiveWeekStreak } from "@/server/services/streak";
import { reconcilePlan } from "@/server/services/plan-service";
import { seasonAt } from "@/server/services/season";

export const dashboardRouter = createTRPCRouter({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await autoCloseStaleWorkouts(ctx.db, userId);
    // El plan del panel siempre refleja las «veces por semana» actuales
    await reconcilePlan(ctx.db, userId);
    const now = new Date();
    const today = startOfDay(now);

    const [
      user,
      todayAttendance,
      lastAttendance,
      activeWorkout,
      planSlots,
      weekAttendances,
      monthAttendances,
      recentPRs,
      weekPoints,
      unreadNotifications,
      totalWorkouts,
      totalVolume,
    ] = await Promise.all([
      ctx.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          name: true, avatarUrl: true, currentStreak: true, bestStreak: true,
          lastCompletedWeek: true, planPosition: true, weeklyTargetDays: true,
        },
      }),
      ctx.db.attendance.findUnique({ where: { userId_date: { userId, date: today } } }),
      ctx.db.attendance.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
      ctx.db.workout.findFirst({ where: { userId, endedAt: null }, include: { routine: true } }),
      ctx.db.planSlot.findMany({
        where: { userId },
        include: {
          routine: {
            select: { id: true, name: true, emoji: true, color: true, _count: { select: { exercises: true } } },
          },
        },
        orderBy: { order: "asc" },
      }),
      ctx.db.attendance.count({
        where: { userId, date: { gte: startOfISOWeek(now), lte: endOfISOWeek(now) } },
      }),
      ctx.db.attendance.findMany({
        where: { userId, date: { gte: startOfMonth(now), lte: endOfMonth(now) } },
        select: { date: true },
      }),
      ctx.db.personalRecord.findMany({
        where: { userId },
        include: { exercise: true },
        orderBy: { date: "desc" },
        take: 3,
      }),
      ctx.db.pointEvent.aggregate({
        where: { date: { gte: startOfISOWeek(now), lte: endOfISOWeek(now) } },
        _sum: { points: true },
      }),
      ctx.db.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      ctx.db.workout.count({ where: { userId, endedAt: { not: null } } }),
      ctx.db.workout.aggregate({ where: { userId }, _sum: { totalVolume: true } }),
    ]);

    // Posición en el ranking semanal
    const grouped = await ctx.db.pointEvent.groupBy({
      by: ["userId"],
      where: { date: { gte: startOfISOWeek(now), lte: endOfISOWeek(now) } },
      _sum: { points: true },
    });
    const sorted = grouped
      .map((g) => ({ userId: g.userId, points: g._sum.points ?? 0 }))
      .sort((a, b) => b.points - a.points);
    const myIndex = sorted.findIndex((r) => r.userId === userId);
    const myWeekPoints = myIndex >= 0 ? sorted[myIndex]?.points ?? 0 : 0;

    // Desglose de puntos del usuario por categoría (histórico)
    const breakdownRaw = await ctx.db.pointEvent.groupBy({
      by: ["type"],
      where: { userId },
      _sum: { points: true },
      _count: true,
    });
    const pointsBreakdown = breakdownRaw.map((g) => ({
      type: g.type,
      points: g._sum.points ?? 0,
      count: g._count,
    }));
    const totalPoints = pointsBreakdown.reduce((acc, b) => acc + b.points, 0);

    // Puntos configurados de las etapas de racha (para la barra de progreso)
    const streakRulesRaw = await ctx.db.pointRule.findMany({
      where: { type: { in: ["STREAK_WEEK1", "STREAK_WEEK2", "STREAK_WEEK3", "STREAK_MONTH", "STREAK_CRACK"] } },
      select: { type: true, points: true, enabled: true },
    });
    const streakRules = streakRulesRaw
      .filter((r): r is typeof r & { type: NonNullable<typeof r.type> } => r.type !== null)
      .map((r) => ({ type: r.type as string, points: r.points, enabled: r.enabled }));

    // Temporada actual + puntos del usuario en ella
    const season = seasonAt(now);
    const seasonPointsAgg = season.started
      ? await ctx.db.pointEvent.aggregate({
          where: { userId, date: { gte: season.from, lte: season.to } },
          _sum: { points: true },
        })
      : null;
    const seasonTopAgg = season.started
      ? await ctx.db.pointEvent.groupBy({
          by: ["userId"],
          where: { date: { gte: season.from, lte: season.to } },
          _sum: { points: true },
        })
      : [];
    const seasonTop = Math.max(1, ...seasonTopAgg.map((g) => g._sum.points ?? 0));

    // Siguiente slot del plan (y el que viene después, como adelanto)
    const plan =
      planSlots.length > 0
        ? (() => {
            const pos = user.planPosition % planSlots.length;
            return {
              length: planSlots.length,
              next: planSlots[pos] ?? null,
              following: planSlots.length > 1 ? planSlots[(pos + 1) % planSlots.length] ?? null : null,
            };
          })()
        : null;

    return {
      user: { ...user, currentStreak: effectiveWeekStreak(user.currentStreak, user.lastCompletedWeek) },
      plan,
      todayAttendance,
      lastAttendance,
      activeWorkout,
      weekAttendances,
      monthAttendanceDates: monthAttendances.map((a) => a.date),
      recentPRs,
      pointsBreakdown,
      totalPoints,
      streakRules,
      season: {
        index: season.index,
        started: season.started,
        daysLeft: season.daysLeft,
        from: season.from,
        to: season.to,
        myPoints: seasonPointsAgg?._sum.points ?? 0,
        topPoints: seasonTop,
      },
      rankingPosition: myIndex >= 0 ? myIndex + 1 : null,
      totalGroupWeekPoints: weekPoints._sum.points ?? 0,
      myWeekPoints,
      unreadNotifications,
      totalWorkouts,
      totalVolume: totalVolume._sum.totalVolume ?? 0,
    };
  }),
});
