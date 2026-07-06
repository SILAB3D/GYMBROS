import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/**
 * Métricas corporales: SIEMPRE limitadas al usuario de la sesión.
 * Ningún procedimiento acepta un userId externo — es imposible
 * consultar las métricas de otra persona a través de esta API.
 */
export const metricsRouter = createTRPCRouter({
  add: protectedProcedure
    .input(
      z.object({
        date: z.date().optional(),
        weightKg: z.number().min(20).max(400).nullable().optional(),
        bodyFatPct: z.number().min(1).max(80).nullable().optional(),
        muscleMassKg: z.number().min(5).max(200).nullable().optional(),
        heightCm: z.number().min(100).max(250).nullable().optional(),
        waistCm: z.number().min(30).max(250).nullable().optional(),
        chestCm: z.number().min(30).max(250).nullable().optional(),
        armCm: z.number().min(10).max(100).nullable().optional(),
        legCm: z.number().min(20).max(150).nullable().optional(),
        neckCm: z.number().min(15).max(100).nullable().optional(),
        hipCm: z.number().min(30).max(250).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { heightCm, ...rest } = input;
      const bmi =
        input.weightKg && heightCm
          ? Math.round((input.weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10
          : undefined;
      return ctx.db.bodyMetric.create({
        data: { userId: ctx.session.user.id, ...rest, date: input.date ?? new Date(), bmi },
      });
    }),

  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.bodyMetric.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { date: "asc" },
    }),
  ),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const metric = await ctx.db.bodyMetric.findUnique({ where: { id: input.id } });
    if (!metric || metric.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    await ctx.db.bodyMetric.delete({ where: { id: input.id } });
    return { ok: true };
  }),
});
