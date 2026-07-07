import type { PrismaClient } from "@prisma/client";
import { sendPushToUsers } from "./push";

/** Envía las notificaciones de encuestas cuya hora programada ya llegó. */
export async function dispatchDuePolls(db: PrismaClient): Promise<number> {
  const due = await db.poll.findMany({
    where: { notifiedAt: null, closed: false, publishAt: { lte: new Date() } },
    select: { id: true, title: true },
  });
  if (due.length === 0) return 0;

  const users = await db.user.findMany({ select: { id: true } });
  for (const poll of due) {
    await db.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: "SYSTEM" as const,
        title: `📊 Nueva encuesta: ${poll.title}`,
        body: "Se abrirá al entrar en la app",
      })),
    });
    await sendPushToUsers(db, users.map((u) => u.id), {
      title: `📊 Nueva encuesta: ${poll.title}`,
      body: "Entra en GymBros para responderla",
      url: "/panel",
    });
    await db.poll.update({ where: { id: poll.id }, data: { notifiedAt: new Date() } });
  }
  return due.length;
}
