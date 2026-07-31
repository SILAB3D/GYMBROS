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

/** Envía una notificación a un usuario concreto usando una plantilla editable. */
export async function notifyUserFromTemplate(
  db: PrismaClient,
  userId: string,
  code: string,
  category: NotifyCategory,
  vars: Record<string, string | number> = {},
  type: NotificationType = "SYSTEM",
) {
  const t = await db.notificationTemplate.findUnique({ where: { code } });
  if (!t || !t.enabled) return;
  await notify(db, userId, type, fillTemplate(t.title, vars), t.body ? fillTemplate(t.body, vars) : undefined, category);
}
