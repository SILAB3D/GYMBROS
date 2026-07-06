import { z } from "zod";
import { FeedbackStatus } from "@prisma/client";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/api/trpc";

export const feedbackRouter = createTRPCRouter({
  // Cualquier usuario puede enviar sugerencias o reportar bugs
  create: protectedProcedure
    .input(z.object({ text: z.string().min(5, "Cuéntanos un poco más (mínimo 5 caracteres)").max(1000) }))
    .mutation(({ ctx, input }) =>
      ctx.db.feedback.create({ data: { userId: ctx.session.user.id, text: input.text } }),
    ),

  listAll: adminProcedure.query(({ ctx }) =>
    ctx.db.feedback.findMany({
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ),

  setStatus: adminProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(FeedbackStatus) }))
    .mutation(({ ctx, input }) =>
      ctx.db.feedback.update({ where: { id: input.id }, data: { status: input.status } }),
    ),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.feedback.delete({ where: { id: input.id } }),
  ),
});
