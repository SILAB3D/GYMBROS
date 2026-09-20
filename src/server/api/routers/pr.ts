import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { awardPoints, addFeed, checkAchievements } from "@/server/services/gamification";

export const prRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        exerciseId: z.string(),
        weight: z.number().min(0).max(1000),
        reps: z.number().int().min(1).max(100).default(1),
        date: z.date().optional(),
        notes: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const exercise = await ctx.db.exercise.findUnique({ where: { id: input.exerciseId } });
      if (!exercise) throw new TRPCError({ code: "NOT_FOUND" });

      const pr = await ctx.db.personalRecord.create({
        data: { userId, ...input, date: input.date ?? new Date() },
      });

      const best = await ctx.db.personalRecord.findFirst({
        where: { userId, exerciseId: input.exerciseId, id: { not: pr.id } },
        orderBy: { weight: "desc" },
      });
      const isNewBest = !best || input.weight > best.weight;
      if (isNewBest) {
        await awardPoints(ctx.db, userId, "NEW_PR", { exerciseId: input.exerciseId, weight: input.weight });
        const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
        // Público: el evento del PR. Privado: el peso alcanzado.
        await addFeed(ctx.db, userId, "PR", `${user.name} consiguió un nuevo PR en ${exercise.name} 🎉`);
        const { notifyGroupFromTemplate } = await import("@/server/services/notify-templates");
        await notifyGroupFromTemplate(ctx.db, userId, "FRIEND_PR", "prs", {
          name: user.name, count: "1 nuevo", exercises: exercise.name,
        }, "FRIEND_PR");
        await checkAchievements(ctx.db, userId);
      }
      return { pr, isNewBest };
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const pr = await ctx.db.personalRecord.findUnique({ where: { id: input.id } });
    if (!pr || pr.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    await ctx.db.personalRecord.delete({ where: { id: input.id } });
    return { ok: true };
  }),

  recent: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.personalRecord.findMany({
        where: { userId: ctx.session.user.id },
        include: { exercise: true },
        orderBy: { date: "desc" },
        take: input?.limit ?? 10,
      }),
    ),

  // Mejor marca por ejercicio
  bests: protectedProcedure.query(async ({ ctx }) => {
    const prs = await ctx.db.personalRecord.findMany({
      where: { userId: ctx.session.user.id },
      include: { exercise: true },
      orderBy: [{ weight: "desc" }, { date: "asc" }],
    });
    const seen = new Set<string>();
    return prs.filter((pr) => {
      if (seen.has(pr.exerciseId)) return false;
      seen.add(pr.exerciseId);
      return true;
    });
  }),

  /**
   * Mejores marcas agrupadas por rutina: para cada ejercicio de cada rutina, su
   * récord (peso × reps y fecha). Los ejercicios sin ninguna marca no aparecen,
   * y las marcas de ejercicios que ya no están en ninguna rutina se recogen en
   * un último grupo para que no se pierdan de vista.
   */
  byRoutine: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [routines, prs] = await Promise.all([
      ctx.db.routine.findMany({
        where: { userId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true, name: true, emoji: true, color: true,
          exercises: {
            orderBy: { order: "asc" },
            select: { exercise: { select: { id: true, name: true, noWeight: true } } },
          },
        },
      }),
      ctx.db.personalRecord.findMany({
        where: { userId },
        include: { exercise: { select: { id: true, name: true, noWeight: true } } },
      }),
    ]);

    // Mejor marca por ejercicio: el peso manda, salvo en los ejercicios sin
    // peso, donde el récord son las repeticiones de una serie.
    type Record = { exerciseId: string; name: string; noWeight: boolean; weight: number; reps: number; date: Date };
    const best = new Map<string, Record>();
    for (const pr of prs) {
      const current = best.get(pr.exerciseId);
      const better = !current
        ? true
        : pr.exercise.noWeight
          ? pr.reps > current.reps
          : pr.weight > current.weight || (pr.weight === current.weight && pr.reps > current.reps);
      if (better) {
        best.set(pr.exerciseId, {
          exerciseId: pr.exerciseId,
          name: pr.exercise.name,
          noWeight: pr.exercise.noWeight,
          weight: pr.weight,
          reps: pr.reps,
          date: pr.date,
        });
      }
    }

    const grouped = new Set<string>();
    const groups = routines
      .map((r) => {
        const records = r.exercises
          .map((re) => best.get(re.exercise.id))
          .filter((x): x is Record => x !== undefined);
        records.forEach((x) => grouped.add(x.exerciseId));
        return { id: r.id, name: r.name, emoji: r.emoji, color: r.color, records };
      })
      .filter((g) => g.records.length > 0);

    const orphans = Array.from(best.values()).filter((x) => !grouped.has(x.exerciseId));
    if (orphans.length > 0) {
      groups.push({
        id: "otros",
        name: "Otros ejercicios",
        emoji: "🏋️",
        color: "#64748b",
        records: orphans.sort((a, b) => a.name.localeCompare(b.name, "es")),
      });
    }
    return groups;
  }),

  // Evolución de un ejercicio para la gráfica
  history: protectedProcedure
    .input(z.object({ exerciseId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.personalRecord.findMany({
        where: { userId: ctx.session.user.id, exerciseId: input.exerciseId },
        include: { exercise: true },
        orderBy: { date: "asc" },
      }),
    ),
});
