import { z } from "zod";
import { FeedbackStatus } from "@prisma/client";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/server/api/trpc";
import { sendPushToUsers } from "@/server/services/push";

/** Lo que se enseña del mensaje en el aviso, para que quepa en una notificación. */
const PREVIEW_CHARS = 120;

export const feedbackRouter = createTRPCRouter({
  // Cualquier usuario puede enviar sugerencias o reportar bugs
  create: protectedProcedure
    .input(z.object({ text: z.string().min(5, "Cuéntanos un poco más (mínimo 5 caracteres)").max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const feedback = await ctx.db.feedback.create({
        data: { userId: ctx.session.user.id, text: input.text },
      });

      // Aviso a los administradores. No pasa por las preferencias de
      // notificación: el feedback hay que atenderlo, no es contenido del grupo.
      const [author, admins] = await Promise.all([
        ctx.db.user.findUniqueOrThrow({
          where: { id: ctx.session.user.id },
          select: { name: true },
        }),
        ctx.db.user.findMany({
          where: { role: "ADMIN", deletionRequestedAt: null },
          select: { id: true },
        }),
      ]);
      const recipients = admins.map((a) => a.id).filter((id) => id !== ctx.session.user.id);
      if (recipients.length > 0) {
        const title = `Nuevo feedback de ${author.name} 💬`;
        const body =
          input.text.length > PREVIEW_CHARS
            ? `${input.text.slice(0, PREVIEW_CHARS).trimEnd()}…`
            : input.text;
        await ctx.db.notification.createMany({
          data: recipients.map((userId) => ({ userId, type: "SYSTEM" as const, title, body })),
        });
        await sendPushToUsers(ctx.db, recipients, { title, body, url: "/ajustes" });
      }

      return feedback;
    }),

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
