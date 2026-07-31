import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/api/trpc";
import { dispatchDuePolls } from "@/server/services/poll-dispatch";

/** Próxima ocurrencia de una hora concreta en España (hoy si aún no pasó, si no mañana). */
function nextMadridHour(hour: number): Date {
  const now = new Date();
  const madridNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const target = new Date(madridNow);
  target.setHours(hour, 0, 0, 0);
  if (target <= madridNow) target.setDate(target.getDate() + 1);
  const offset = now.getTime() - madridNow.getTime();
  return new Date(target.getTime() + offset);
}

export const pollRouter = createTRPCRouter({
  // Crear la encuesta: inmediata o programada (22h / 10h del siguiente día disponible)
  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(2).max(120),
        description: z.string().max(500).optional(),
        options: z.array(z.string().min(1).max(80)).min(2).max(6),
        schedule: z.enum(["now", "h22", "h10"]).default("now"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { schedule, ...data } = input;
      const publishAt =
        schedule === "h22" ? nextMadridHour(22) : schedule === "h10" ? nextMadridHour(10) : new Date();
      const poll = await ctx.db.poll.create({ data: { ...data, publishAt } });
      await dispatchDuePolls(ctx.db); // si es inmediata, avisa ya
      return poll;
    }),

  // Encuestas publicadas y abiertas, con mi estado (voto y aplazamientos).
  // Sin recuentos: los resultados solo los ve el admin.
  listActive: protectedProcedure.query(async ({ ctx }) => {
    await dispatchDuePolls(ctx.db);
    const userId = ctx.session.user.id;
    const polls = await ctx.db.poll.findMany({
      where: { closed: false, publishAt: { lte: new Date() } },
      include: {
        votes: { where: { userId }, select: { optionIndex: true } },
        snoozes: { where: { userId }, select: { count: true, until: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return polls.map((poll) => ({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      options: poll.options,
      myVote: poll.votes[0]?.optionIndex ?? null,
      snoozeCount: poll.snoozes[0]?.count ?? 0,
      snoozedUntil: poll.snoozes[0]?.until ?? null,
    }));
  }),

  vote: protectedProcedure
    .input(z.object({ pollId: z.string(), optionIndex: z.number().int().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const poll = await ctx.db.poll.findUnique({ where: { id: input.pollId } });
      if (!poll || poll.closed) throw new TRPCError({ code: "BAD_REQUEST", message: "La encuesta está cerrada" });
      if (input.optionIndex >= poll.options.length) throw new TRPCError({ code: "BAD_REQUEST" });
      return ctx.db.pollVote.upsert({
        where: { pollId_userId: { pollId: input.pollId, userId: ctx.session.user.id } },
        update: { optionIndex: input.optionIndex },
        create: { pollId: input.pollId, userId: ctx.session.user.id, optionIndex: input.optionIndex },
      });
    }),

  // Posponer 30 minutos (máximo 3 veces)
  snooze: protectedProcedure
    .input(z.object({ pollId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await ctx.db.pollSnooze.findUnique({
        where: { pollId_userId: { pollId: input.pollId, userId } },
      });
      if ((existing?.count ?? 0) >= 3) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ya no se puede posponer más" });
      }
      const until = new Date(Date.now() + 30 * 60 * 1000);
      return ctx.db.pollSnooze.upsert({
        where: { pollId_userId: { pollId: input.pollId, userId } },
        update: { count: { increment: 1 }, until },
        create: { pollId: input.pollId, userId, count: 1, until },
      });
    }),

  // Resultados: SOLO el admin. Incluye quién votó cada opción.
  results: adminProcedure.query(async ({ ctx }) => {
    const polls = await ctx.db.poll.findMany({
      include: {
        votes: {
          select: { optionIndex: true, user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return polls.map((poll) => ({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      options: poll.options,
      closed: poll.closed,
      publishAt: poll.publishAt,
      pending: poll.notifiedAt === null && poll.publishAt > new Date(),
      counts: poll.options.map((_, i) => poll.votes.filter((v) => v.optionIndex === i).length),
      total: poll.votes.length,
      // Votantes agrupados por opción
      votersByOption: poll.options.map((_, i) =>
        poll.votes.filter((v) => v.optionIndex === i).map((v) => v.user),
      ),
    }));
  }),

  setClosed: adminProcedure
    .input(z.object({ id: z.string(), closed: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.poll.update({ where: { id: input.id }, data: { closed: input.closed } }),
    ),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.poll.delete({ where: { id: input.id } }),
  ),
});
