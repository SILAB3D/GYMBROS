import type { PrismaClient } from "@prisma/client";
import { sendPushToUsers } from "./push";
import { usersWithCategory } from "./notify-prefs";

/**
 * Envía las notificaciones de encuestas cuya hora programada ya llegó.
 *
 * Se respeta la categoría "system" («Sistema, encuestas y logros»), igual que
 * el resto de avisos: antes este era el único emisor que escribía a todo el
 * mundo sin mirar las preferencias, así que las encuestas del admin llegaban
 * aunque el usuario tuviera las notificaciones desactivadas.
 */
export async function dispatchDuePolls(db: PrismaClient): Promise<number> {
  const due = await db.poll.findMany({
    where: { notifiedAt: null, closed: false, publishAt: { lte: new Date() } },
    select: { id: true, title: true },
  });
  if (due.length === 0) return 0;

  const users = await db.user.findMany({ select: { id: true } });
  const recipients = await usersWithCategory(db, users.map((u) => u.id), "system");
  for (const poll of due) {
    if (recipients.length > 0) {
      await db.notification.createMany({
        data: recipients.map((id) => ({
          userId: id,
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
    }
    // La encuesta se marca como avisada aunque nadie la reciba: si no, el cron
    // la reintentaría cada día sin que cambie nada.
    await db.poll.update({ where: { id: poll.id }, data: { notifiedAt: new Date() } });
  }
  return due.length;
}
