import { z } from "zod";
import {
  startOfISOWeek, endOfISOWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, subYears,
} from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

type Period = "week" | "month" | "year";

function periodRange(period: Period, offset = 0): { from: Date; to: Date } {
  const now = new Date();
  if (period === "week") {
    const ref = subWeeks(now, offset);
    return { from: startOfISOWeek(ref), to: endOfISOWeek(ref) };
  }
  if (period === "month") {
    const ref = subMonths(now, offset);
    return { from: startOfMonth(ref), to: endOfMonth(ref) };
  }
  const ref = subYears(now, offset);
  return { from: startOfYear(ref), to: endOfYear(ref) };
}

async function computeRanking(
  db: typeof import("@/lib/db").db,
  from: Date,
  to: Date,
): Promise<Array<{ userId: string; points: number }>> {
  const grouped = await db.pointEvent.groupBy({
    by: ["userId"],
    where: { date: { gte: from, lte: to } },
    _sum: { points: true },
  });
  return grouped
    .map((g) => ({ userId: g.userId, points: g._sum.points ?? 0 }))
    .sort((a, b) => b.points - a.points);
}

export const rankingRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ period: z.enum(["week", "month", "year"]).default("week") }))
    .query(async ({ ctx, input }) => {
      const current = periodRange(input.period);
      const previous = periodRange(input.period, 1);

      const [users, currentRanking, previousRanking] = await Promise.all([
        ctx.db.user.findMany({ select: { id: true, name: true, avatarUrl: true, currentStreak: true } }),
        computeRanking(ctx.db, current.from, current.to),
        computeRanking(ctx.db, previous.from, previous.to),
      ]);

      const prevPos = new Map(previousRanking.map((r, i) => [r.userId, i + 1]));
      const pointsByUser = new Map(currentRanking.map((r) => [r.userId, r.points]));

      // Incluir a todos los usuarios aunque tengan 0 puntos
      const rows = users
        .map((u) => ({ user: u, points: pointsByUser.get(u.id) ?? 0 }))
        .sort((a, b) => b.points - a.points)
        .map((row, i) => {
          const position = i + 1;
          const prev = prevPos.get(row.user.id) ?? null;
          return {
            ...row,
            position,
            previousPosition: prev,
            delta: prev === null ? null : prev - position, // positivo = ha subido
            medal: position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : null,
          };
        });

      const myPosition = rows.find((r) => r.user.id === ctx.session.user.id)?.position ?? null;
      return { rows, myPosition, from: current.from, to: current.to };
    }),

  // Desglose de puntos del usuario en el periodo (transparencia del sistema)
  myBreakdown: protectedProcedure
    .input(z.object({ period: z.enum(["week", "month", "year"]).default("week") }))
    .query(async ({ ctx, input }) => {
      const { from, to } = periodRange(input.period);
      const grouped = await ctx.db.pointEvent.groupBy({
        by: ["type"],
        where: { userId: ctx.session.user.id, date: { gte: from, lte: to } },
        _sum: { points: true },
        _count: true,
      });
      return grouped.map((g) => ({ type: g.type, points: g._sum.points ?? 0, count: g._count }));
    }),
});
