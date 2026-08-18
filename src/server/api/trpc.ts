import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getServerAuthSession } from "@/server/auth";
import { db } from "@/lib/db";
import { isGroupAdmin, resolveActiveGroupId } from "@/server/services/group";

export const createTRPCContext = async () => {
  const session = await getServerAuthSession();
  return { db, session };
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/**
 * Todo procedimiento autenticado sabe en qué grupo está el usuario.
 *
 * `groupId` es null mientras no pertenezca a ninguno (cuentas recién migradas o
 * que acaban de salirse del último). Lo social debe pasarlo por `requireGroup`;
 * lo personal —rutinas, entrenos, medidas— no lo necesita.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const groupId = await resolveActiveGroupId(ctx.db, ctx.session.user.id);
  return next({
    ctx: { ...ctx, session: { ...ctx.session, user: ctx.session.user }, groupId },
  });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores" });
  }
  return next({ ctx });
});

/**
 * Manda en el grupo activo: quien lo creó o a quien hayan ascendido. El
 * administrador de la aplicación pasa siempre, esté donde esté.
 */
export const groupAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role === "ADMIN") return next({ ctx });
  if (!(await isGroupAdmin(ctx.db, ctx.groupId, ctx.session.user.id))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo los administradores del grupo" });
  }
  return next({ ctx });
});
