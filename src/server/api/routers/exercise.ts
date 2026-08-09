import { z } from "zod";
import { MuscleGroup } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const exerciseRouter = createTRPCRouter({
  // Catálogo global + ejercicios propios del usuario
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.exercise.findMany({
      where: { OR: [{ createdById: null }, { createdById: ctx.session.user.id }] },
      orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
    }),
  ),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(60),
        muscleGroup: z.nativeEnum(MuscleGroup),
        // Ejercicios sin carga externa: dominadas, plancha, cardio…
        noWeight: z.boolean().default(false),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.exercise.create({
        data: { ...input, createdById: ctx.session.user.id },
      }),
    ),

  // Marcar/desmarcar un ejercicio como "sin peso". Los del catálogo global solo
  // los puede cambiar un admin, porque afectan a todo el grupo.
  setNoWeight: protectedProcedure
    .input(z.object({ id: z.string(), noWeight: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const exercise = await ctx.db.exercise.findUnique({ where: { id: input.id } });
      if (!exercise) throw new TRPCError({ code: "NOT_FOUND" });
      const isOwn = exercise.createdById === ctx.session.user.id;
      const isGlobal = exercise.createdById === null;
      if (!isOwn && !(isGlobal && ctx.session.user.role === "ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo un admin puede cambiar los ejercicios del catálogo general",
        });
      }
      return ctx.db.exercise.update({
        where: { id: input.id },
        data: { noWeight: input.noWeight },
      });
    }),
});
