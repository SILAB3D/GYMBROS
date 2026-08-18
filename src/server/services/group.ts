import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

/**
 * Grupos: todo lo social (ranking, chat, encuestas, feed, miembros) vive dentro
 * de uno. Lo personal —rutinas, entrenos, PRs, medidas— es del usuario y se ve
 * igual desde todos los grupos a los que pertenezca.
 *
 * El código del grupo original sigue siendo el de INVITE_CODE, así que quien ya
 * estaba dentro no nota el cambio.
 */

/** Clave maestra para poder CREAR un grupo nuevo (unirse solo pide el código). */
export const MASTER_KEY = process.env.GROUP_MASTER_KEY ?? "3333";

/** Código y nombre del grupo original, el que existía antes de los grupos. */
export const LEGACY_GROUP_CODE = (process.env.INVITE_CODE ?? "GYMBROS2026").toUpperCase();
export const LEGACY_GROUP_NAME = "GymBros";

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Grupo activo del usuario. Si el que tenía guardado ya no vale (le echaron,
 * lo borraron) cae al primero del que sea miembro y lo deja fijado.
 */
export async function resolveActiveGroupId(
  db: PrismaClient,
  userId: string,
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { activeGroupId: true },
  });
  if (user?.activeGroupId) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: user.activeGroupId, userId } },
      select: { id: true },
    });
    if (membership) return user.activeGroupId;
  }
  const first = await db.groupMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    select: { groupId: true },
  });
  if (!first) return null;
  await db.user.update({ where: { id: userId }, data: { activeGroupId: first.groupId } });
  return first.groupId;
}

/**
 * Ids de los miembros visibles de un grupo. Los perfiles con borrado pendiente
 * quedan fuera: para el resto del grupo ya no existen.
 */
export async function groupMemberIds(
  db: PrismaClient,
  groupId: string | null,
  opts?: { includeDeleted?: boolean },
): Promise<string[]> {
  if (!groupId) return [];
  const members = await db.groupMember.findMany({
    where: {
      groupId,
      ...(opts?.includeDeleted ? {} : { user: { deletionRequestedAt: null } }),
    },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/** Lanza si el usuario todavía no está en ningún grupo. */
export function requireGroup(groupId: string | null): string {
  if (!groupId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Todavía no perteneces a ningún grupo",
    });
  }
  return groupId;
}

/** ¿Manda este usuario en el grupo? (creador o ascendido) */
export async function isGroupAdmin(
  db: PrismaClient,
  groupId: string | null,
  userId: string,
): Promise<boolean> {
  if (!groupId) return false;
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });
  return membership?.role === "ADMIN";
}
