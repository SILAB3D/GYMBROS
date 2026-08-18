import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { MASTER_KEY, normalizeCode, requireGroup } from "@/server/services/group";

export const groupRouter = createTRPCRouter({
  /** Mis grupos y cuál estoy mirando. Alimenta el selector de la pestaña Grupo. */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.groupMember.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { joinedAt: "asc" },
      select: {
        role: true,
        joinedAt: true,
        group: {
          select: {
            id: true, name: true, code: true, createdAt: true,
            _count: { select: { members: true } },
          },
        },
      },
    });
    return {
      activeGroupId: ctx.groupId,
      groups: memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        code: m.group.code,
        members: m.group._count.members,
        isAdmin: m.role === "ADMIN",
        joinedAt: m.joinedAt,
        isActive: m.group.id === ctx.groupId,
      })),
    };
  }),

  /** Cambiar de grupo. El perfil es el mismo: solo cambia lo social. */
  setActive: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: input.groupId, userId: ctx.session.user.id } },
      });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No perteneces a ese grupo" });
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { activeGroupId: input.groupId },
      });
      return { ok: true };
    }),

  /** Crear un grupo desde dentro de la app. Exige la clave maestra. */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(40),
        code: z.string().trim().min(4).max(20),
        masterKey: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await createGroupFor(ctx.db, ctx.session.user.id, input);
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { activeGroupId: group.id },
      });
      return { id: group.id, name: group.name, code: group.code };
    }),

  /** Unirse a un grupo existente con su código. */
  join: protectedProcedure
    .input(z.object({ code: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const group = await joinGroupAs(ctx.db, ctx.session.user.id, input.code);
      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { activeGroupId: group.id },
      });
      return { id: group.id, name: group.name, code: group.code };
    }),

  /**
   * Salir de un grupo. El perfil y todos sus datos siguen intactos: solo deja
   * de verse en ese grupo. No se puede dejar solo un grupo sin administrador.
   */
  leave: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId: input.groupId, userId } },
      });
      if (!membership) throw new TRPCError({ code: "NOT_FOUND" });

      if (membership.role === "ADMIN") {
        const otherAdmins = await ctx.db.groupMember.count({
          where: { groupId: input.groupId, role: "ADMIN", userId: { not: userId } },
        });
        const otherMembers = await ctx.db.groupMember.findFirst({
          where: { groupId: input.groupId, userId: { not: userId } },
          orderBy: { joinedAt: "asc" },
        });
        // El grupo no puede quedarse sin quien lo gestione: el mando pasa al
        // miembro más antiguo. Si no queda nadie, el grupo se disuelve.
        if (otherAdmins === 0 && otherMembers) {
          await ctx.db.groupMember.update({
            where: { id: otherMembers.id },
            data: { role: "ADMIN" },
          });
        }
      }

      await ctx.db.groupMember.delete({ where: { id: membership.id } });
      const remaining = await ctx.db.groupMember.count({ where: { groupId: input.groupId } });
      if (remaining === 0) {
        await ctx.db.group.delete({ where: { id: input.groupId } });
      }

      const next = await ctx.db.groupMember.findFirst({
        where: { userId },
        orderBy: { joinedAt: "asc" },
        select: { groupId: true },
      });
      await ctx.db.user.update({
        where: { id: userId },
        data: { activeGroupId: next?.groupId ?? null },
      });
      return { ok: true, activeGroupId: next?.groupId ?? null };
    }),

  /** Renombrar el grupo activo (solo su administrador). */
  rename: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(40) }))
    .mutation(async ({ ctx, input }) => {
      const groupId = requireGroup(ctx.groupId);
      const membership = await ctx.db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: ctx.session.user.id } },
      });
      if (membership?.role !== "ADMIN" && ctx.session.user.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Solo los administradores del grupo" });
      }
      return ctx.db.group.update({ where: { id: groupId }, data: { name: input.name } });
    }),
});

// ---------- Compartido con el registro (src/server/api/routers/user.ts) ----------

/** Crea el grupo y deja a quien lo crea como administrador. */
export async function createGroupFor(
  db: PrismaClient,
  userId: string,
  input: { name: string; code: string; masterKey: string },
) {
  if (input.masterKey.trim() !== MASTER_KEY) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Clave maestra incorrecta" });
  }
  const code = normalizeCode(input.code);
  if (!/^[A-Z0-9-]+$/.test(code)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "El código solo puede llevar letras, números y guiones",
    });
  }
  const existing = await db.group.findUnique({ where: { code } });
  if (existing) {
    throw new TRPCError({ code: "CONFLICT", message: "Ya existe un grupo con ese código" });
  }
  return db.group.create({
    data: {
      name: input.name.trim(),
      code,
      createdById: userId,
      members: { create: { userId, role: "ADMIN" } },
    },
  });
}

/** Mete al usuario en el grupo del código. Si ya estaba, no pasa nada. */
export async function joinGroupAs(db: PrismaClient, userId: string, rawCode: string) {
  const group = await db.group.findUnique({ where: { code: normalizeCode(rawCode) } });
  if (!group) {
    throw new TRPCError({ code: "NOT_FOUND", message: "No hay ningún grupo con ese código" });
  }
  await db.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId } },
    update: {},
    create: { groupId: group.id, userId },
  });
  return group;
}
