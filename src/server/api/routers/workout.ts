import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { awardPoints, addFeed, notifyOthers, checkAchievements } from "@/server/services/gamification";

export const workoutRouter = createTRPCRouter({
  // Iniciar sesión de entrenamiento (opcionalmente desde una rutina)
  start: protectedProcedure
    .input(z.object({ routineId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const active = await ctx.db.workout.findFirst({
        where: { userId: ctx.session.user.id, endedAt: null },
      });
      if (active) return active; // ya hay una sesión en curso

      let exercisesData: { exerciseId: string; order: number; sets: { setNumber: number; reps: number; weight: number }[] }[] = [];
      if (input.routineId) {
        const routine = await ctx.db.routine.findUnique({
          where: { id: input.routineId },
          include: { exercises: { orderBy: { order: "asc" } } },
        });
        if (!routine) throw new TRPCError({ code: "NOT_FOUND" });
        if (routine.userId !== ctx.session.user.id && !routine.isShared) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        exercisesData = routine.exercises.map((re) => ({
          exerciseId: re.exerciseId,
          order: re.order,
          sets: Array.from({ length: re.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: re.reps,
            weight: re.targetWeight ?? 0,
          })),
        }));
      }

      return ctx.db.workout.create({
        data: {
          userId: ctx.session.user.id,
          routineId: input.routineId,
          exercises: {
            create: exercisesData.map((e) => ({
              exerciseId: e.exerciseId,
              order: e.order,
              sets: { create: e.sets },
            })),
          },
        },
      });
    }),

  active: protectedProcedure.query(({ ctx }) =>
    ctx.db.workout.findFirst({
      where: { userId: ctx.session.user.id, endedAt: null },
      include: {
        routine: true,
        exercises: {
          orderBy: { order: "asc" },
          include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
        },
      },
    }),
  ),

  updateSet: protectedProcedure
    .input(
      z.object({
        setId: z.string(),
        reps: z.number().int().min(0).max(200).optional(),
        weight: z.number().min(0).max(1000).optional(),
        completed: z.boolean().optional(),
        notes: z.string().max(200).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const set = await ctx.db.workoutSet.findUnique({
        where: { id: input.setId },
        include: { workoutExercise: { include: { workout: true } } },
      });
      if (!set || set.workoutExercise.workout.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { setId, ...data } = input;
      return ctx.db.workoutSet.update({ where: { id: setId }, data });
    }),

  addSet: protectedProcedure
    .input(z.object({ workoutExerciseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const we = await ctx.db.workoutExercise.findUnique({
        where: { id: input.workoutExerciseId },
        include: { workout: true, sets: { orderBy: { setNumber: "desc" }, take: 1 } },
      });
      if (!we || we.workout.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const last = we.sets[0];
      return ctx.db.workoutSet.create({
        data: {
          workoutExerciseId: we.id,
          setNumber: (last?.setNumber ?? 0) + 1,
          reps: last?.reps ?? 10,
          weight: last?.weight ?? 0,
        },
      });
    }),

  addExercise: protectedProcedure
    .input(z.object({ workoutId: z.string(), exerciseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const workout = await ctx.db.workout.findUnique({
        where: { id: input.workoutId },
        include: { exercises: { orderBy: { order: "desc" }, take: 1 } },
      });
      if (!workout || workout.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.db.workoutExercise.create({
        data: {
          workoutId: workout.id,
          exerciseId: input.exerciseId,
          order: (workout.exercises[0]?.order ?? -1) + 1,
          sets: { create: [{ setNumber: 1, reps: 10, weight: 0 }] },
        },
      });
    }),

  cancel: protectedProcedure.input(z.object({ workoutId: z.string() })).mutation(async ({ ctx, input }) => {
    const workout = await ctx.db.workout.findUnique({ where: { id: input.workoutId } });
    if (!workout || workout.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
    await ctx.db.workout.delete({ where: { id: input.workoutId } });
    return { ok: true };
  }),

  // Finalizar: calcula totales, detecta PRs automáticamente y otorga puntos
  finish: protectedProcedure
    .input(z.object({ workoutId: z.string(), notes: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const workout = await ctx.db.workout.findUnique({
        where: { id: input.workoutId },
        include: {
          routine: true,
          exercises: { include: { exercise: true, sets: true } },
        },
      });
      if (!workout || workout.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (workout.endedAt) return { workoutId: workout.id, newPRs: [] as string[] };

      let totalVolume = 0;
      let totalSets = 0;
      let totalReps = 0;
      for (const we of workout.exercises) {
        for (const s of we.sets) {
          if (!s.completed) continue;
          totalVolume += s.weight * s.reps;
          totalSets += 1;
          totalReps += s.reps;
        }
      }

      await ctx.db.workout.update({
        where: { id: workout.id },
        data: { endedAt: new Date(), totalVolume, totalSets, totalReps, notes: input.notes },
      });

      const userId = ctx.session.user.id;
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });

      // --- Detección automática de PRs (mejor peso por ejercicio) ---
      const newPRs: string[] = [];
      for (const we of workout.exercises) {
        const best = we.sets
          .filter((s) => s.completed && s.weight > 0)
          .sort((a, b) => b.weight - a.weight)[0];
        if (!best) continue;
        const currentPR = await ctx.db.personalRecord.findFirst({
          where: { userId, exerciseId: we.exerciseId },
          orderBy: { weight: "desc" },
        });
        if (!currentPR || best.weight > currentPR.weight) {
          await ctx.db.personalRecord.create({
            data: {
              userId, exerciseId: we.exerciseId, weight: best.weight, reps: best.reps,
              isAuto: true, notes: "Detectado automáticamente al finalizar el entrenamiento",
            },
          });
          await awardPoints(ctx.db, userId, "NEW_PR", { exerciseId: we.exerciseId, weight: best.weight });
          newPRs.push(`${we.exercise.name}: ${best.weight} kg`);
          await addFeed(ctx.db, userId, "PR", `${user.name} consiguió un nuevo PR en ${we.exercise.name}: ${best.weight} kg 🎉`);
          await notifyOthers(ctx.db, userId, "FRIEND_PR", `${user.name} hizo un nuevo PR`, `${we.exercise.name}: ${best.weight} kg × ${best.reps}`);
        }
      }

      await awardPoints(ctx.db, userId, "WORKOUT_COMPLETED", { workoutId: workout.id });
      await addFeed(ctx.db, userId, "WORKOUT", `${user.name} completó ${workout.routine ? `la rutina ${workout.routine.emoji} ${workout.routine.name}` : "un entrenamiento"} (${Math.round(totalVolume)} kg de volumen)`);
      await checkAchievements(ctx.db, userId);

      return { workoutId: workout.id, newPRs };
    }),

  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.workout.findMany({
        where: { userId: ctx.session.user.id, endedAt: { not: null } },
        include: { routine: true, exercises: { include: { exercise: true } } },
        orderBy: { startedAt: "desc" },
        take: input?.limit ?? 20,
      }),
    ),
});
