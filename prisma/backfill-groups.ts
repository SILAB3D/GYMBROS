/**
 * Migración de "un único grupo global" a grupos.
 *
 * Crea el grupo original con el código de INVITE_CODE, mete dentro a todos los
 * usuarios que ya existían y asigna a ese grupo el chat y las encuestas
 * anteriores. Es idempotente: se puede ejecutar las veces que haga falta.
 *
 *   npm run db:backfill-groups
 */
import { PrismaClient } from "@prisma/client";
import { LEGACY_GROUP_CODE, LEGACY_GROUP_NAME } from "../src/server/services/group";

const db = new PrismaClient();

async function main() {
  const firstUser = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });

  const group = await db.group.upsert({
    where: { code: LEGACY_GROUP_CODE },
    update: {},
    create: { name: LEGACY_GROUP_NAME, code: LEGACY_GROUP_CODE, createdById: firstUser?.id ?? null },
  });
  console.log(`Grupo original: ${group.name} (${group.code})`);

  // Todos los usuarios existentes entran en él. Los admins de la app lo son
  // también del grupo, para que las encuestas sigan funcionando igual.
  const users = await db.user.findMany({ select: { id: true, role: true } });
  for (const user of users) {
    await db.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
      update: {},
      create: {
        groupId: group.id,
        userId: user.id,
        role: user.role === "ADMIN" ? "ADMIN" : "MEMBER",
      },
    });
  }
  await db.user.updateMany({ where: { activeGroupId: null }, data: { activeGroupId: group.id } });
  console.log(`Miembros: ${users.length}`);

  const chat = await db.chatMessage.updateMany({ where: { groupId: null }, data: { groupId: group.id } });
  const polls = await db.poll.updateMany({ where: { groupId: null }, data: { groupId: group.id } });
  console.log(`Mensajes de chat asignados: ${chat.count} · encuestas: ${polls.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
