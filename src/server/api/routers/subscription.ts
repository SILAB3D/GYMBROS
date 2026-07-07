import { z } from "zod";
import { addMonths, startOfMonth, subMonths, format, startOfDay } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/**
 * Calculadora de inversión: cuánto cuesta cada sesión de gimnasio
 * según la suscripción configurada y las asistencias reales.
 */
export const subscriptionRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const sub = await ctx.db.gymSubscription.findUnique({ where: { userId } });
    if (!sub) return { sub: null, stats: null };

    const now = new Date();
    const start = startOfDay(sub.startDate);

    // Pagos realizados hasta hoy y fecha del próximo
    let payments = 0;
    let cursor = start;
    while (cursor <= now) {
      payments += 1;
      cursor = addMonths(cursor, sub.periodMonths);
    }
    const nextPayment = cursor;
    const totalPaid = payments * sub.price;
    const monthlyCost = sub.price / sub.periodMonths;

    // Asistencias desde el inicio de la suscripción
    const attendances = await ctx.db.attendance.findMany({
      where: { userId, date: { gte: start } },
      select: { date: true },
    });
    const totalSessions = attendances.length;

    // Desglose de los últimos 12 meses (sin ir antes del inicio)
    const firstMonth = startOfMonth(start);
    const windowStart = startOfMonth(subMonths(now, 11));
    const from = firstMonth > windowStart ? firstMonth : windowStart;
    const months: Array<{ month: string; sessions: number; costPerSession: number | null }> = [];
    for (let m = startOfMonth(now); m >= from; m = subMonths(m, 1)) {
      const key = format(m, "yyyy-MM");
      const sessions = attendances.filter((a) => format(a.date, "yyyy-MM") === key).length;
      months.push({
        month: key,
        sessions,
        costPerSession: sessions > 0 ? Math.round((monthlyCost / sessions) * 100) / 100 : null,
      });
    }

    return {
      sub,
      stats: {
        payments,
        totalPaid: Math.round(totalPaid * 100) / 100,
        nextPayment,
        monthlyCost: Math.round(monthlyCost * 100) / 100,
        totalSessions,
        costPerSessionTotal:
          totalSessions > 0 ? Math.round((totalPaid / totalSessions) * 100) / 100 : null,
        months,
      },
    };
  }),

  set: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        periodMonths: z.number().int().min(1).max(24),
        price: z.number().min(0.01).max(10000),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.gymSubscription.upsert({
        where: { userId: ctx.session.user.id },
        update: input,
        create: { userId: ctx.session.user.id, ...input },
      }),
    ),

  remove: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.gymSubscription.deleteMany({ where: { userId: ctx.session.user.id } });
    return { ok: true };
  }),
});
