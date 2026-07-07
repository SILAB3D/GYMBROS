import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { MuscleGroup } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { awardPoints, addFeed, checkAchievements } from "@/server/services/gamification";

const routineExerciseInput = z.object({
  exerciseId: z.string(),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100),
  targetWeight: z.number().min(0).nullable().optional(),
  restSeconds: z.number().int().min(0).max(600).nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
});

const routineInput = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(300).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#22c55e"),
  emoji: z.string().max(4).default("💪"),
  recommendedDays: z.array(z.number().int().min(0).max(6)).default([]),
  estimatedMinutes: z.number().int().min(5).max(300).nullable().optional(),
  exercises: z.array(routineExerciseInput).default([]),
});

async function assertOwner(db: typeof import("@/lib/db").db, routineId: string, userId: string) {
  const routine = await db.routine.findUnique({ where: { id: routineId } });
  if (!routine) throw new TRPCError({ code: "NOT_FOUND" });
  if (routine.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" });
  return routine;
}

export const routineRouter = createTRPCRouter({
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db.routine.findMany({
      where: { userId: ctx.session.user.id },
      include: { exercises: { include: { exercise: true }, orderBy: { order: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
  ),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const routine = await ctx.db.routine.findUnique({
      where: { id: input.id },
      include: {
        exercises: { include: { exercise: true }, orderBy: { order: "asc" } },
        user: { select: { id: true, name: true } },
      },
    });
    if (!routine) throw new TRPCError({ code: "NOT_FOUND" });
    if (routine.userId !== ctx.session.user.id && !routine.isShared) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    // Los pesos son privados: se ocultan si la rutina no es tuya
    if (routine.userId !== ctx.session.user.id) {
      return {
        ...routine,
        exercises: routine.exercises.map((e) => ({ ...e, targetWeight: null, notes: null })),
      };
    }
    return routine;
  }),

  create: protectedProcedure.input(routineInput).mutation(({ ctx, input }) =>
    ctx.db.routine.create({
      data: {
        userId: ctx.session.user.id,
        name: input.name,
        description: input.description,
        color: input.color,
        emoji: input.emoji,
        recommendedDays: input.recommendedDays,
        estimatedMinutes: input.estimatedMinutes,
        exercises: {
          create: input.exercises.map((e, i) => ({ ...e, order: i })),
        },
      },
    }),
  ),

  update: protectedProcedure
    .input(routineInput.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwner(ctx.db, input.id, ctx.session.user.id);
      const { id, exercises, ...data } = input;
      return ctx.db.routine.update({
        where: { id },
        data: {
          ...data,
          exercises: {
            deleteMany: {},
            create: exercises.map((e, i) => ({ ...e, order: i })),
          },
        },
      });
    }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await assertOwner(ctx.db, input.id, ctx.session.user.id);
    await ctx.db.routine.delete({ where: { id: input.id } });
    return { ok: true };
  }),

  duplicate: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const original = await assertOwner(ctx.db, input.id, ctx.session.user.id);
    const exercises = await ctx.db.routineExercise.findMany({ where: { routineId: input.id } });
    return ctx.db.routine.create({
      data: {
        userId: ctx.session.user.id,
        name: `${original.name} (copia)`,
        description: original.description,
        color: original.color,
        emoji: original.emoji,
        recommendedDays: original.recommendedDays,
        estimatedMinutes: original.estimatedMinutes,
        exercises: {
          create: exercises.map((e) => ({
            exerciseId: e.exerciseId, order: e.order, sets: e.sets, reps: e.reps,
            targetWeight: e.targetWeight, restSeconds: e.restSeconds, notes: e.notes,
          })),
        },
      },
    });
  }),

  toggleShare: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const routine = await assertOwner(ctx.db, input.id, ctx.session.user.id);
    const updated = await ctx.db.routine.update({
      where: { id: input.id },
      data: { isShared: !routine.isShared },
    });
    if (updated.isShared && !routine.isShared) {
      await awardPoints(ctx.db, ctx.session.user.id, "ROUTINE_SHARED", { routineId: routine.id });
      const user = await ctx.db.user.findUnique({ where: { id: ctx.session.user.id }, select: { name: true } });
      await addFeed(ctx.db, ctx.session.user.id, "ROUTINE_SHARED", `${user?.name} compartió la rutina ${updated.emoji} ${updated.name}`);
      await checkAchievements(ctx.db, ctx.session.user.id);
    }
    return updated;
  }),

  // Importar una rutina desde un archivo JSON exportado
  importRoutine: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(60),
        description: z.string().max(300).nullable().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#22c55e"),
        emoji: z.string().max(4).default("💪"),
        recommendedDays: z.array(z.number().int().min(0).max(6)).default([]),
        estimatedMinutes: z.number().int().min(5).max(300).nullable().optional(),
        exercises: z
          .array(
            z.object({
              name: z.string().min(2).max(60),
              muscleGroup: z.nativeEnum(MuscleGroup).default("OTRO"),
              sets: z.number().int().min(1).max(20).default(3),
              reps: z.number().int().min(1).max(100).default(10),
              targetWeight: z.number().min(0).nullable().optional(),
              restSeconds: z.number().int().min(0).max(600).nullable().optional(),
              notes: z.string().max(200).nullable().optional(),
            }),
          )
          .min(1)
          .max(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // Resolver cada ejercicio por nombre (catálogo o propios); si no existe, se crea
      const exerciseIds: string[] = [];
      for (const e of input.exercises) {
        let exercise = await ctx.db.exercise.findFirst({
          where: {
            name: { equals: e.name, mode: "insensitive" },
            OR: [{ createdById: null }, { createdById: userId }],
          },
        });
        exercise ??= await ctx.db.exercise.create({
          data: { name: e.name, muscleGroup: e.muscleGroup, createdById: userId },
        });
        exerciseIds.push(exercise.id);
      }
      return ctx.db.routine.create({
        data: {
          userId,
          name: input.name,
          description: input.description,
          color: input.color,
          emoji: input.emoji,
          recommendedDays: input.recommendedDays,
          estimatedMinutes: input.estimatedMinutes,
          exercises: {
            create: input.exercises.map((e, i) => ({
              exerciseId: exerciseIds[i]!,
              order: i,
              sets: e.sets,
              reps: e.reps,
              targetWeight: e.targetWeight,
              restSeconds: e.restSeconds,
              notes: e.notes,
            })),
          },
        },
      });
    }),

  // Rutinas compartidas por el resto del grupo (sin pesos: son privados)
  shared: protectedProcedure.query(async ({ ctx }) => {
    const routines = await ctx.db.routine.findMany({
      where: { isShared: true, userId: { not: ctx.session.user.id } },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        exercises: { include: { exercise: true }, orderBy: { order: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return routines.map((r) => ({
      ...r,
      exercises: r.exercises.map((e) => ({ ...e, targetWeight: null, notes: null })),
    }));
  }),

  // Clonar la rutina compartida de otro usuario
  clone: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const original = await ctx.db.routine.findUnique({
      where: { id: input.id },
      include: { exercises: true, user: { select: { name: true } } },
    });
    if (!original || (!original.isShared && original.userId !== ctx.session.user.id)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Esta rutina no está compartida" });
    }
    return ctx.db.routine.create({
      data: {
        userId: ctx.session.user.id,
        name: original.name,
        description: `Clonada de ${original.user.name}`,
        color: original.color,
        emoji: original.emoji,
        recommendedDays: original.recommendedDays,
        estimatedMinutes: original.estimatedMinutes,
        clonedFromId: original.id,
        exercises: {
          create: original.exercises.map((e) => ({
            exerciseId: e.exerciseId, order: e.order, sets: e.sets, reps: e.reps,
            // Los pesos del dueño original son privados: el clon empieza sin pesos
            targetWeight: null, restSeconds: e.restSeconds, notes: null,
          })),
        },
      },
    });
  }),
});
