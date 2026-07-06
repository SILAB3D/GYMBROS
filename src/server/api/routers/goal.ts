import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { GoalType } from "@prisma/client";
import { startOfISOWeek, startOfMonth } from "date-fns";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { awardPoints, addFeed, notify } from "@/server/services/gamification";

/** Recalcula el progreso automático de un objetivo según su tipo. */
async function computeProgress(
  db: typeof import("@/lib/db").db,
  userId: string,
  type: GoalType,
  currentValue: number,
): Promise<number> {
  const now = new Date();
  switch (type) {
    case "ATTENDANCE_WEEKLY":
      return db.attendance.count({ where: { userId, date: { gte: startOfISOWeek(now) } } });
    case "ATTENDANCE_MONTHLY":
      return db.attendance.count({ where: { userId, date: { gte: startOfMonth(now) } } });
    case "WORKOUTS_TOTAL":
      return db.workout.count({ where: { userId, endedAt: { not: null } } });
    default:
      return currentValue; // LIFT_WEIGHT y CUSTOM se actualizan a mano
  }
}

export const goalRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(2).max(100),
        description: z.string().max(300).optional(),
        type: z.nativeEnum(GoalType).default("CUSTOM"),
        targetValue: z.number().min(0.1),
        unit: z.string().max(20).optional(),
        deadline: z.date().optional(),
        isPublic: z.boolean().default(true),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.goal.create({ data: { userId: ctx.session.user.id, ...input } }),
    ),

  list: protectedProcedure.query(async ({ ctx }) => {
    const goals = await ctx.db.goal.findMany({
      where: { userId: ctx.session.user.id, status: { in: ["ACTIVE", "COMPLETED"] } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    // Refrescar progreso automático de los activos
    const refreshed = [];
    for (const goal of goals) {
      if (goal.status !== "ACTIVE") {
        refreshed.push(goal);
        continue;
      }
      const value = await computeProgress(ctx.db, ctx.session.user.id, goal.type, goal.currentValue);
      let updated = goal;
      if (value !== goal.currentValue) {
        updated = await ctx.db.goal.update({ where: { id: goal.id }, data: { currentValue: value } });
      }
      if (updated.currentValue >= updated.targetValue && updated.status === "ACTIVE") {
        updated = await ctx.db.goal.update({ where: { id: goal.id }, data: { status: "COMPLETED" } });
        await awardPoints(ctx.db, ctx.session.user.id, "GOAL_COMPLETED", { goalId: goal.id });
        await notify(ctx.db, ctx.session.user.id, "GOAL", "¡Objetivo completado! ✅", updated.title);
        if (updated.isPublic) {
          const user = await ctx.db.user.findUnique({ where: { id: ctx.session.user.id }, select: { name: true } });
          await addFeed(ctx.db, ctx.session.user.id, "GOAL", `${user?.name} completó su objetivo: ${updated.title} ✅`);
        }
      }
      refreshed.push(updated);
    }
    return refreshed;
  }),

  updateProgress: protectedProcedure
    .input(z.object({ id: z.string(), currentValue: z.number().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const goal = await ctx.db.goal.findUnique({ where: { id: input.id } });
      if (!goal || goal.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.db.goal.update({ where: { id: input.id }, data: { currentValue: input.currentValue } });
    }),

  archive: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const goal = await ctx.db.goal.findUnique({ where: { id: input.id } });
    if (!goal || goal.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    return ctx.db.goal.update({ where: { id: input.id }, data: { status: "ARCHIVED" } });
  }),
});
