import type { PrismaClient } from "@prisma/client";
import { sendPushToUsers } from "./push";
import { groupMemberIds } from "./group";

/**
 * Envía las notificaciones de encuestas cuya hora programada ya llegó.
 *
 * Igual que las difusiones, las encuestas las lanza el administrador y llegan a
 * todo el grupo sin pasar por las preferencias de notificación: una encuesta
 * que la mitad del grupo no ve no sirve de nada.
 */
export async function dispatchDuePolls(db: PrismaClient): Promise<number> {
  const due = await db.poll.findMany({
    where: { notifiedAt: null, closed: false, publishAt: { lte: new Date() } },
    select: { id: true, title: true, groupId: true },
  });
  if (due.length === 0) return 0;

  for (const poll of due) {
    const recipients = await groupMemberIds(db, poll.groupId);
    if (recipients.length === 0) {
      // Un grupo sin nadie a quien avisar: se marca igualmente para no
      // reintentarlo en cada petición.
      await db.poll.update({ where: { id: poll.id }, data: { notifiedAt: new Date() } });
      continue;
    }
    await db.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: "SYSTEM" as const,
        title: `📊 Nueva encuesta: ${poll.title}`,
        body: "Se abrirá al entrar en la app",
      })),
    });
    await sendPushToUsers(db, recipients, {
      title: `📊 Nueva encuesta: ${poll.title}`,
      body: "Entra en GymBros para responderla",
      url: "/panel",
    });
    await db.poll.update({ where: { id: poll.id }, data: { notifiedAt: new Date() } });
  }
  return due.length;
}
