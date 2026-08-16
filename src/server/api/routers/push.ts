import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { sendPushToUsers } from "@/server/services/push";

export const pushRouter = createTRPCRouter({
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(1000),
        p256dh: z.string().max(500),
        auth: z.string().max(500),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        update: { userId: ctx.session.user.id, p256dh: input.p256dh, auth: input.auth },
        create: { userId: ctx.session.user.id, ...input },
      }),
    ),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: ctx.session.user.id },
      });
      return { ok: true };
    }),

  /**
   * Notificación de prueba al propio usuario. No pasa por sus preferencias de
   * categoría ni deja rastro en la campanita: solo comprueba que el permiso
   * del dispositivo está concedido y que el push llega de verdad.
   */
  test: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const devices = await ctx.db.pushSubscription.count({ where: { userId } });
    if (devices === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No hay ningún dispositivo con las notificaciones activadas en tu cuenta",
      });
    }
    const result = await sendPushToUsers(ctx.db, [userId], {
      title: "Notificación de prueba 🔔",
      body: "Si ves esto, tus notificaciones funcionan correctamente.",
      url: "/ajustes",
    });
    if (result.delivered === 0) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          result.expired > 0
            ? "El registro de este dispositivo había caducado. Desactiva y vuelve a activar las notificaciones."
            : "El servicio de push rechazó el envío. Revisa las indicaciones de abajo.",
      });
    }
    return result;
  }),
});
