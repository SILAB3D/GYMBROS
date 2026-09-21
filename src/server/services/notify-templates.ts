import type { PrismaClient, NotificationType } from "@prisma/client";
import { notify, notifyOthers } from "./gamification";
import { fillTemplate, type NotifyCategory } from "./notify-prefs";

/** Envía una notificación al grupo (menos al autor) usando una plantilla editable. */
export async function notifyGroupFromTemplate(
  db: PrismaClient,
  exceptUserId: string,
  code: string,
  category: NotifyCategory,
  vars: Record<string, string | number> = {},
  type: NotificationType = "SYSTEM",
) {
  const t = await db.notificationTemplate.findUnique({ where: { code } });
  if (!t || !t.enabled) return;
  await notifyOthers(db, exceptUserId, type, fillTemplate(t.title, vars), t.body ? fillTemplate(t.body, vars) : undefined, category);
}

/**
 * Envía una notificación a un usuario concreto usando una plantilla editable.
 *
 * Con `dedupeSince` no se repite el aviso si ya salió uno con el mismo título
 * desde esa fecha: el cron puede ejecutarse más de una vez al día sin que el
 * usuario reciba el mismo recordatorio dos veces. Devuelve si se ha enviado.
 */
export async function notifyUserFromTemplate(
  db: PrismaClient,
  userId: string,
  code: string,
  category: NotifyCategory,
  vars: Record<string, string | number> = {},
  type: NotificationType = "SYSTEM",
  dedupeSince?: Date,
) {
  const t = await db.notificationTemplate.findUnique({ where: { code } });
  if (!t || !t.enabled) return false;
  const title = fillTemplate(t.title, vars);
  if (dedupeSince) {
    const already = await db.notification.findFirst({
      where: { userId, type, title, createdAt: { gte: dedupeSince } },
      select: { id: true },
    });
    if (already) return false;
  }
  await notify(db, userId, type, title, t.body ? fillTemplate(t.body, vars) : undefined, category);
  return true;
}
