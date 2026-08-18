import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { finishWorkout, autoCloseStaleWorkouts, notifyWorkoutStartedIfDue } from "@/server/services/workout-service";

/** Cuántas sesiones anteriores se promedian para proponer peso y reps. */
const SUGGESTION_SAMPLE = 5;

/**
 * Media de las últimas sesiones de un ejercicio, serie a serie.
 *
 * Fijarse solo en el último entreno hacía que un mal día (o uno especialmente
 * bueno) marcara el siguiente. Con la media de las últimas cinco sesiones la
 * sugerencia refleja por dónde anda uno de verdad. Siempre en unidades enteras:
 * nadie pone 42,5 reps ni busca discos de 0,3 kg.
 */
function averageSets(
  history: Array<{ sets: Array<{ setNumber: number; reps: number; weight: number }> }>,
): Map<number, { reps: number; weight: number }> {
  const totals = new Map<number, { reps: number; weight: number; count: number }>();
  for (const we of history) {
    for (const set of we.sets) {
      const acc = totals.get(set.setNumber) ?? { reps: 0, weight: 0, count: 0 };
      acc.reps += set.reps;
      acc.weight += set.weight;
      acc.count += 1;
      totals.set(set.setNumber, acc);
    }
  }
  const averages = new Map<number, { reps: number; weight: number }>();
  totals.forEach((acc, setNumber) => {
    averages.set(setNumber, {
      reps: Math.round(acc.reps / acc.count),
      weight: Math.round(acc.weight / acc.count),
    });
  });
  return averages;
}

export const workoutRouter = createTRPCRouter({
  // Iniciar sesión de entrenamiento (opcionalmente desde una rutina)
  start: protectedProcedure
    .input(z.object({ routineId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await autoCloseStaleWorkouts(ctx.db, ctx.session.user.id);
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
        // Precargar pesos y reps con la MEDIA de las últimas cinco sesiones de
        // cada ejercicio (si no hay historial, se usa el objetivo de la
        // rutina). touched=false hasta que se editen.
        exercisesData = await Promise.all(
          routine.exercises.map(async (re) => {
            const history = await ctx.db.workoutExercise.findMany({
              where: {
                exerciseId: re.exerciseId,
                workout: { userId: ctx.session.user.id, endedAt: { not: null } },
              },
              orderBy: { workout: { startedAt: "desc" } },
              take: SUGGESTION_SAMPLE,
              select: { sets: { select: { setNumber: true, reps: true, weight: true } } },
            });
            const averages = averageSets(history);
            return {
              exerciseId: re.exerciseId,
              order: re.order,
              sets: Array.from({ length: re.sets }, (_, i) => {
                const avg = averages.get(i + 1);
                return {
                  setNumber: i + 1,
                  reps: avg?.reps ?? re.reps,
                  weight: avg?.weight ?? re.targetWeight ?? 0,
                };
              }),
            };
          }),
        );
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

  active: protectedProcedure.query(async ({ ctx }) => {
    // Autocierre: si hay una sesión con más de 3 horas, se finaliza sola
    await autoCloseStaleWorkouts(ctx.db, ctx.session.user.id);
    // Aviso al grupo si el entreno lleva más de 20 min
    await notifyWorkoutStartedIfDue(ctx.db, ctx.session.user.id);
    return ctx.db.workout.findFirst({
      where: { userId: ctx.session.user.id, endedAt: null },
      include: {
        routine: true,
        exercises: {
          orderBy: { order: "asc" },
          include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
        },
      },
    });
  }),

  /**
   * Versión ligera de `active` para el botón flotante, que se consulta en
   * TODAS las pantallas: devuelve solo lo que se pinta y no arrastra las series
   * ni dispara los efectos de autocierre.
   */
  activeBadge: protectedProcedure.query(async ({ ctx }) => {
    const workout = await ctx.db.workout.findFirst({
      where: { userId: ctx.session.user.id, endedAt: null },
      select: {
        id: true,
        startedAt: true,
        routine: { select: { name: true, emoji: true } },
      },
    });
    if (!workout) return null;

    const [totalSets, doneSets] = await Promise.all([
      ctx.db.workoutSet.count({ where: { workoutExercise: { workoutId: workout.id } } }),
      ctx.db.workoutSet.count({
        where: { workoutExercise: { workoutId: workout.id }, completed: true },
      }),
    ]);
    return { ...workout, totalSets, doneSets };
  }),

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
      // Editar o completar una serie la marca como "de esta sesión"
      return ctx.db.workoutSet.update({ where: { id: setId }, data: { ...data, touched: true } });
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

  // Finalizar: calcula totales, detecta PRs y otorga puntos (ver workout-service)
  finish: protectedProcedure
    .input(z.object({ workoutId: z.string(), notes: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const workout = await ctx.db.workout.findUnique({ where: { id: input.workoutId } });
      if (!workout || workout.userId !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return finishWorkout(ctx.db, input.workoutId, { notes: input.notes });
    }),

  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.workout.findMany({
        where: { userId: ctx.session.user.id, endedAt: { not: null } },
        include: {
          routine: true,
          exercises: {
            orderBy: { order: "asc" },
            include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
          },
        },
        orderBy: { startedAt: "desc" },
        take: input?.limit ?? 20,
      }),
    ),
});
