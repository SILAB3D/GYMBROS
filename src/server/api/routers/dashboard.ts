import { startOfDay, startOfISOWeek, endOfISOWeek, startOfMonth, endOfMonth } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const dashboardRouter = createTRPCRouter({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const now = new Date();
    const today = startOfDay(now);
    const weekday = now.getDay();

    const [
      user,
      todayAttendance,
      lastAttendance,
      activeWorkout,
      todayRoutines,
      weekAttendances,
      monthAttendances,
      recentPRs,
      weekPoints,
      unreadNotifications,
      activeGoals,
      totalWorkouts,
      totalVolume,
    ] = await Promise.all([
      ctx.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, avatarUrl: true, currentStreak: true, bestStreak: true },
      }),
      ctx.db.attendance.findUnique({ where: { userId_date: { userId, date: today } } }),
      ctx.db.attendance.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
      ctx.db.workout.findFirst({ where: { userId, endedAt: null }, include: { routine: true } }),
      ctx.db.routine.findMany({
        where: { userId, recommendedDays: { has: weekday } },
        include: { _count: { select: { exercises: true } } },
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
      ctx.db.goal.findMany({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 3,
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

    return {
      user,
      todayAttendance,
      lastAttendance,
      activeWorkout,
      todayRoutines,
      weekAttendances,
      monthAttendanceDates: monthAttendances.map((a) => a.date),
      recentPRs,
      rankingPosition: myIndex >= 0 ? myIndex + 1 : null,
      totalGroupWeekPoints: weekPoints._sum.points ?? 0,
      myWeekPoints,
      unreadNotifications,
      activeGoals,
      totalWorkouts,
      totalVolume: totalVolume._sum.totalVolume ?? 0,
    };
  }),
});
