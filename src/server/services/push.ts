import type { PrismaClient } from "@prisma/client";
import webpush from "web-push";

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false; // push no configurado: se ignora silenciosamente
  if (!configured) {
    webpush.setVapidDetails("mailto:ivacuaano@gmail.com", publicKey, privateKey);
    configured = true;
  }
  return true;
}

/**
 * Envía una notificación push a todos los dispositivos de los usuarios dados.
 * Las suscripciones caducadas (410/404) se eliminan automáticamente.
 */
export async function sendPushToUsers(
  db: PrismaClient,
  userIds: string[],
  payload: { title: string; body?: string; url?: string },
) {
  if (userIds.length === 0 || !ensureConfigured()) return;
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
      }
    }),
  );
}
