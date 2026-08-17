import { z } from "zod";
import { hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { startOfISOWeek, endOfISOWeek } from "date-fns";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/api/trpc";
import { effectiveWeekStreak, streaksForUsers } from "@/server/services/streak";
import { trainingProfiles, affinityBetween, affinityDetail } from "@/server/services/affinity";
import { sendPushToUsers } from "@/server/services/push";
import {
  RESET_TTL_MINUTES,
  consumeResetToken,
  createResetToken,
  resetRequestsExceeded,
  resetTokenIsValid,
} from "@/server/services/password-reset";

export const userRouter = createTRPCRouter({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50),
        email: z.string().email(),
        password: z.string().min(8),
        inviteCode: z.string(),
        gymStartDate: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.inviteCode !== process.env.INVITE_CODE) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Código de invitación incorrecto" });
      }
      const email = input.email.toLowerCase().trim();
      const existing = await ctx.db.user.findUnique({ where: { email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cuenta con ese email" });
      }
      const isFirst = (await ctx.db.user.count()) === 0;
      const user = await ctx.db.user.create({
        data: {
          email,
          name: input.name.trim(),
          passwordHash: await hash(input.password, 12),
          gymStartDate: input.gymStartDate,
          role: isFirst ? "ADMIN" : "USER", // el primer usuario es admin
        },
      });
      return { id: user.id };
    }),

  me: protectedProcedure.query(({ ctx }) =>
    ctx.db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: {
        id: true, email: true, name: true, avatarUrl: true, gymStartDate: true,
        role: true, currentStreak: true, bestStreak: true, createdAt: true, notifyPrefs: true,
        weeklyTargetDays: true, investmentEnabled: true, onboardingDone: true,
      },
    }),
  ),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50).optional(),
        avatarUrl: z
          .string()
          .max(300_000)
          .refine(
            (v) => /^https?:\/\//.test(v) || v.startsWith("data:image/"),
            "Debe ser una URL o una imagen subida",
          )
          .nullable()
          .optional(),
        gymStartDate: z.date().nullable().optional(),
        investmentEnabled: z.boolean().optional(),
        notifyPrefs: z.record(z.boolean()).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.user.update({ where: { id: ctx.session.user.id }, data: input }),
    ),

  completeOnboarding: protectedProcedure.mutation(({ ctx }) =>
    ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { onboardingDone: true },
    }),
  ),

  changePassword: protectedProcedure
    .input(z.object({ current: z.string(), next: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const { compare } = await import("bcryptjs");
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.session.user.id } });
      if (!(await compare(input.current, user.passwordHash))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "La contraseña actual no es correcta" });
      }
      await ctx.db.user.update({
        where: { id: user.id },
        data: { passwordHash: await hash(input.next, 12) },
      });
      return { ok: true };
    }),

  /**
   * Resetea el perfil: borra TODOS los registros de actividad del usuario.
   * Conserva la cuenta, las rutinas y los ejercicios personalizados.
   */
  resetData: protectedProcedure
    .input(z.object({ confirmation: z.literal("RESET") }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      await ctx.db.$transaction([
        ctx.db.pointEvent.deleteMany({ where: { userId } }),
        ctx.db.notification.deleteMany({ where: { userId } }),
        ctx.db.feedComment.deleteMany({ where: { userId } }),
        ctx.db.feedLike.deleteMany({ where: { userId } }),
        ctx.db.feedItem.deleteMany({ where: { userId } }),
        ctx.db.personalRecord.deleteMany({ where: { userId } }),
        ctx.db.bodyMetric.deleteMany({ where: { userId } }),
        ctx.db.attendance.deleteMany({ where: { userId } }),
        ctx.db.workout.deleteMany({ where: { userId } }),
        ctx.db.userAchievement.deleteMany({ where: { userId } }),
        ctx.db.user.update({
          where: { id: userId },
          data: {
            currentStreak: 0,
            bestStreak: 0,
            lastAttendanceDate: null,
            lastCompletedWeek: null,
            streakWarnedWeek: null,
            streakLostWeek: null,
            planPosition: 0,
          },
        }),
      ]);
      return { ok: true };
    }),

  // Perfil público: solo datos visibles para el grupo. Nunca métricas corporales.
  /**
   * Historial de puntos agrupado por día, del más reciente al más antiguo.
   *
   * Sirve tanto para el panel propio como para el perfil de cualquier miembro:
   * el desglose por categoría dice EN QUÉ se ganaron los puntos, pero no
   * CUÁNDO, que es justo lo que hace falta para entender una subida o un
   * parón en el ranking.
   */
  pointsHistory: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(), // por defecto, uno mismo
        days: z.number().int().min(1).max(365).default(90),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = input.userId ?? ctx.session.user.id;
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - input.days);

      const events = await ctx.db.pointEvent.findMany({
        where: { userId, date: { gte: from } },
        select: { id: true, type: true, points: true, date: true },
        orderBy: { date: "desc" },
      });

      // Se agrupa por día natural conservando el orden descendente de la query
      const byDay = new Map<string, { date: Date; total: number; items: typeof events }>();
      for (const e of events) {
        const key = e.date.toISOString().slice(0, 10);
        const day = byDay.get(key) ?? { date: e.date, total: 0, items: [] };
        day.total += e.points;
        day.items.push(e);
        byDay.set(key, day);
      }

      const days = Array.from(byDay.entries()).map(([key, d]) => ({ key, ...d }));
      return {
        days,
        total: events.reduce((acc, e) => acc + e.points, 0),
        sinceDays: input.days,
      };
    }),

  publicProfile: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: {
          id: true, name: true, avatarUrl: true, gymStartDate: true,
          currentStreak: true, bestStreak: true, lastCompletedWeek: true, createdAt: true,
          weeklyTargetDays: true,
        },
      });
      const [attendances, workouts, recentPRs, routines, achievements, points, breakdownRaw, weekCount] =
        await Promise.all([
          ctx.db.attendance.count({ where: { userId: user.id } }),
          ctx.db.workout.count({ where: { userId: user.id, endedAt: { not: null } } }),
          // PRs públicos como evento, pero SIN el peso alcanzado (privado)
          ctx.db.personalRecord.findMany({
            where: { userId: user.id },
            orderBy: { date: "desc" },
            take: 5,
            select: { id: true, date: true, exercise: { select: { name: true } } },
          }),
          // Rutinas públicas: ejercicios, series y repeticiones. Los pesos NUNCA se exponen.
          ctx.db.routine.findMany({
            where: { userId: user.id },
            select: {
              id: true, name: true, description: true, color: true, emoji: true,
              recommendedDays: true, estimatedMinutes: true, isShared: true,
              exercises: {
                orderBy: { order: "asc" },
                select: {
                  id: true, sets: true, reps: true, order: true,
                  exercise: { select: { name: true, muscleGroup: true } },
                },
              },
            },
            orderBy: { updatedAt: "desc" },
          }),
          ctx.db.userAchievement.findMany({
            where: { userId: user.id },
            include: { achievement: true },
            orderBy: { earnedAt: "desc" },
          }),
          ctx.db.pointEvent.aggregate({ where: { userId: user.id }, _sum: { points: true } }),
          ctx.db.pointEvent.groupBy({
            by: ["type"],
            where: { userId: user.id },
            _sum: { points: true },
            _count: true,
          }),
          ctx.db.attendance.count({
            where: {
              userId: input.userId,
              date: { gte: startOfISOWeek(new Date()), lte: endOfISOWeek(new Date()) },
            },
          }),
        ]);
      // Afinidad de entrenamiento con quien está mirando el perfil
      const profiles = await trainingProfiles(ctx.db);
      const myProfile = profiles.get(ctx.session.user.id);
      const theirProfile = profiles.get(input.userId);
      const isSelf = input.userId === ctx.session.user.id;

      const { lastCompletedWeek, weeklyTargetDays, ...publicUser } = user;
      return {
        affinity: isSelf ? null : affinityBetween(myProfile, theirProfile),
        affinityDetail: isSelf ? null : affinityDetail(myProfile, theirProfile),
        myProfileEmpty: !myProfile || myProfile.routines === 0,
        theirProfileEmpty: !theirProfile || theirProfile.routines === 0,
        user: {
          ...publicUser,
          currentStreak: effectiveWeekStreak({
            currentStreak: user.currentStreak,
            lastCompletedWeek,
            weeklyTargetDays,
            weekCount,
          }),
        },
        attendances, workouts, recentPRs, routines, achievements,
        totalPoints: points._sum.points ?? 0,
        pointsBreakdown: breakdownRaw.map((g) => ({ type: g.type, points: g._sum.points ?? 0, count: g._count })),
      };
    }),

  // Calendario de asistencias de un miembro del grupo (solo fechas)
  memberCalendar: protectedProcedure
    .input(z.object({ userId: z.string(), year: z.number().int(), month: z.number().int().min(0).max(11) }))
    .query(async ({ ctx, input }) => {
      const from = new Date(input.year, input.month, 1);
      const to = new Date(input.year, input.month + 1, 0, 23, 59, 59);
      const attendances = await ctx.db.attendance.findMany({
        where: { userId: input.userId, date: { gte: from, lte: to } },
        select: { date: true },
        orderBy: { date: "asc" },
      });
      return attendances.map((a) => a.date);
    }),

  // Listado ligero del grupo. El detalle de cada miembro (incluida la afinidad
  // de entrenamiento) se resuelve en su perfil, no aquí.
  list: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.user.id;
    const users = await ctx.db.user.findMany({
      select: {
        id: true, name: true, avatarUrl: true,
        currentStreak: true, lastCompletedWeek: true, weeklyTargetDays: true,
      },
      orderBy: { name: "asc" },
    });
    const streaks = await streaksForUsers(ctx.db, users);
    return users.map(({ lastCompletedWeek, weeklyTargetDays, ...u }) => ({
      ...u,
      currentStreak: streaks.get(u.id) ?? 0,
      isMe: u.id === me,
    }));
  }),

  // ---------- Recuperación de contraseña ----------

  /**
   * Pide un enlace de recuperación. Se envía por push a los dispositivos donde
   * la cuenta ya tiene sesión abierta.
   *
   * La respuesta es siempre la misma pase lo que pase: si distinguiera entre
   * "no existe esa cuenta" y "te lo he enviado", cualquiera podría averiguar
   * qué emails están registrados probando uno a uno.
   */
  requestReset: publicProcedure
    // El teclado del móvil cuela espacios y mayúsculas al autocompletar: se
    // limpian antes de validar, o el email quedaría rechazado por un espacio.
    .input(z.object({ email: z.string().trim().toLowerCase().email() }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email;
      const user = await ctx.db.user.findUnique({
        where: { email },
        select: { id: true, _count: { select: { pushSubscriptions: true } } },
      });
      if (!user || user._count.pushSubscriptions === 0) return { ok: true };
      if (await resetRequestsExceeded(ctx.db, user.id)) return { ok: true };

      const token = await createResetToken(ctx.db, user.id);
      await sendPushToUsers(ctx.db, [user.id], {
        title: "Restablecer tu contraseña",
        body: `Toca para elegir una nueva. El enlace caduca en ${RESET_TTL_MINUTES} minutos.`,
        url: `/recuperar/${token}`,
      });
      return { ok: true };
    }),

  /** ¿Merece la pena enseñar el formulario o el enlace ya no sirve? */
  checkResetToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(({ ctx, input }) => resetTokenIsValid(ctx.db, input.token)),

  resetPassword: publicProcedure
    .input(z.object({ token: z.string(), password: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const result = await consumeResetToken(ctx.db, input.token, input.password);
      if (!result.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Este enlace ya se ha usado o ha caducado. Pide uno nuevo.",
        });
      }
      // El email vuelve para poder iniciar sesión sin pedirlo de nuevo: quien
      // llega aquí ya ha demostrado tener el token de esa cuenta.
      return { ok: true, email: result.email };
    }),
});
