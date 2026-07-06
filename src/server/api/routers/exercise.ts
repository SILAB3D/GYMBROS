import { z } from "zod";
import { MuscleGroup } from "@prisma/client";
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
    .input(z.object({ name: z.string().min(2).max(60), muscleGroup: z.nativeEnum(MuscleGroup) }))
    .mutation(({ ctx, input }) =>
      ctx.db.exercise.create({
        data: { ...input, createdById: ctx.session.user.id },
      }),
    ),
});
