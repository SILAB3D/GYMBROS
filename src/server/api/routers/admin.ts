import { z } from "zod";
import { Role } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { sendPushToUsers } from "@/server/services/push";
import { usersWithCategory } from "@/server/services/notify-prefs";

export const adminRouter = createTRPCRouter({
  users: adminProcedure.query(({ ctx }) =>
    ctx.db.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, createdAt: true,
        currentStreak: true,
        _count: { select: { workouts: true, attendances: true, personalRecords: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ),

  setRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.nativeEnum(Role) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id && input.role === "USER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes quitarte el rol de admin a ti mismo" });
      }
      return ctx.db.user.update({ where: { id: input.userId }, data: { role: input.role } });
    }),

  deleteUser: adminProcedure.input(z.object({ userId: z.string() })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.session.user.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes eliminarte a ti mismo" });
    }
    await ctx.db.user.delete({ where: { id: input.userId } });
    return { ok: true };
  }),

  // ---------- Sistema de puntos personalizable ----------

  listRules: adminProcedure.query(({ ctx }) =>
    ctx.db.pointRule.findMany({ where: { type: { not: null } }, orderBy: { name: "asc" } }),
  ),

  updateRule: adminProcedure
    .input(
      z.object({
        id: z.string(),
        points: z.number().int().min(0).max(1000).optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.pointRule.update({ where: { id }, data });
    }),

  deleteFeedItem: adminProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.feedItem.delete({ where: { id: input.id } }),
  ),

  // Plantillas de notificación (disparadores fijos, contenido editable)
  notificationTemplates: adminProcedure.query(({ ctx }) =>
    ctx.db.notificationTemplate.findMany({ orderBy: { code: "asc" } }),
  ),

  updateTemplate: adminProcedure
    .input(
      z.object({
        code: z.string(),
        title: z.string().min(2).max(160).optional(),
        body: z.string().max(400).nullable().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { code, ...data } = input;
      return ctx.db.notificationTemplate.update({ where: { code }, data });
    }),

  // Notificación de prueba: se envía solo al admin que la lanza
  testNotification: adminProcedure
    .input(
      z.object({
        code: z.string().optional(), // plantilla concreta
        title: z.string().max(160).optional(),
        body: z.string().max(400).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      let title = input.title ?? "Notificación de prueba 🔔";
      let body = input.body ?? "Si ves esto, las notificaciones funcionan correctamente.";
      if (input.code) {
        const t = await ctx.db.notificationTemplate.findUnique({ where: { code: input.code } });
        if (t) {
          // Rellena los comodines con datos de ejemplo
          const vars: Record<string, string> = {
            name: ctx.session.user.name ?? "Alguien",
            count: "2 nuevos",
            exercises: "Press banca, Sentadilla",
            routine: "💪 Push",
            days: "3",
            target: "4",
          };
          const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
          title = `[PRUEBA] ${fill(t.title)}`;
          body = t.body ? fill(t.body) : "";
        }
      }
      // Se salta las preferencias: es una prueba explícita del admin
      await ctx.db.notification.create({ data: { userId, type: "SYSTEM", title, body } });
      const { sendPushToUsers } = await import("@/server/services/push");
      await sendPushToUsers(ctx.db, [userId], { title, body });
      return { ok: true };
    }),

  broadcast: adminProcedure
    .input(z.object({ title: z.string().min(1).max(120), body: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const users = await ctx.db.user.findMany({ select: { id: true } });
      // Se respeta la preferencia de cada usuario: los avisos del admin tienen
      // su propia categoría para poder silenciarlos sin perder el resto.
      const recipients = await usersWithCategory(
        ctx.db,
        users.map((u) => u.id),
        "announcements",
      );
      if (recipients.length === 0) return { sent: 0, skipped: users.length };
      await ctx.db.notification.createMany({
        data: recipients.map((id) => ({ userId: id, type: "SYSTEM" as const, title: input.title, body: input.body })),
      });
      await sendPushToUsers(ctx.db, recipients, { title: input.title, body: input.body });
      return { sent: recipients.length, skipped: users.length - recipients.length };
    }),
});
