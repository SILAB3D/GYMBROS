import { z } from "zod";
import { addMonths, startOfMonth, subMonths, format, startOfDay } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/**
 * Calculadora de inversión. Sin renovación automática, la suscripción caduca al
 * final del periodo pagado y hay que confirmar cada renovación a mano.
 */

function coverage(sub: { startDate: Date; periodMonths: number; autoRenew: boolean; confirmedPeriods: number }) {
  const now = new Date();
  const start = startOfDay(sub.startDate);
  // Periodos completos transcurridos desde el inicio
  let elapsed = 0;
  let cursor = addMonths(start, sub.periodMonths);
  while (cursor <= now) {
    elapsed += 1;
    cursor = addMonths(cursor, sub.periodMonths);
  }
  // Pagos: automático = todos los periodos iniciados; manual = solo los confirmados
  const payments = sub.autoRenew ? elapsed + 1 : sub.confirmedPeriods;
  const coverageEnd = addMonths(start, payments * sub.periodMonths);
  const expired = !sub.autoRenew && coverageEnd <= now;
  return { start, payments, coverageEnd, expired, nextPayment: sub.autoRenew ? cursor : coverageEnd };
}

export const subscriptionRouter = createTRPCRouter({
  // Estado ligero para el aviso del menú
  status: protectedProcedure.query(async ({ ctx }) => {
    const [user, sub] = await Promise.all([
      ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { investmentEnabled: true },
      }),
      ctx.db.gymSubscription.findUnique({ where: { userId: ctx.session.user.id } }),
    ]);
    if (!sub) return { enabled: user.investmentEnabled, configured: false, expired: false };
    return { enabled: user.investmentEnabled, configured: true, expired: coverage(sub).expired };
  }),

  get: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const sub = await ctx.db.gymSubscription.findUnique({ where: { userId } });
    if (!sub) return { sub: null, stats: null };

    const now = new Date();
    const { start, payments, coverageEnd, expired, nextPayment } = coverage(sub);
    const totalPaid = payments * sub.price;
    const monthlyCost = sub.price / sub.periodMonths;

    const attendances = await ctx.db.attendance.findMany({
      where: { userId, date: { gte: start } },
      select: { date: true },
    });
    const totalSessions = attendances.length;

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
        coverageEnd,
        expired,
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
        autoRenew: z.boolean().default(false),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.gymSubscription.upsert({
        where: { userId: ctx.session.user.id },
        update: input,
        create: { userId: ctx.session.user.id, ...input },
      }),
    ),

  // Confirmar la renovación: suma un periodo pagado más
  renew: protectedProcedure.mutation(async ({ ctx }) => {
    const sub = await ctx.db.gymSubscription.findUnique({
      where: { userId: ctx.session.user.id },
    });
    if (!sub) return { ok: false };
    await ctx.db.gymSubscription.update({
      where: { userId: ctx.session.user.id },
      data: { confirmedPeriods: sub.confirmedPeriods + 1 },
    });
    return { ok: true };
  }),

  setAutoRenew: protectedProcedure
    .input(z.object({ autoRenew: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.gymSubscription.update({
        where: { userId: ctx.session.user.id },
        data: { autoRenew: input.autoRenew },
      }),
    ),

  remove: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.gymSubscription.deleteMany({ where: { userId: ctx.session.user.id } });
    return { ok: true };
  }),
});
