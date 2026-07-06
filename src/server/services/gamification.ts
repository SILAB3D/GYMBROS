import type { PrismaClient, PointType, NotificationType, FeedType } from "@prisma/client";

/**
 * Servicio central de gamificación: puntos, notificaciones, feed y logros.
 * Todas las acciones relevantes pasan por aquí para que el sistema
 * de puntuación sea configurable desde la tabla PointsConfig.
 */

export async function awardPoints(
  db: PrismaClient,
  userId: string,
  type: PointType,
  meta?: Record<string, unknown>,
) {
  const rule = await db.pointRule.findUnique({ where: { type } });
  if (!rule || !rule.enabled || rule.points <= 0) return 0;
  await db.pointEvent.create({
    data: { userId, type, points: rule.points, meta: meta as object | undefined },
  });
  return rule.points;
}

export async function notify(
  db: PrismaClient,
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
) {
  await db.notification.create({ data: { userId, type, title, body } });
}

/** Notifica a todos los miembros del grupo excepto al autor. */
export async function notifyOthers(
  db: PrismaClient,
  exceptUserId: string,
  type: NotificationType,
  title: string,
  body?: string,
) {
  const others = await db.user.findMany({
    where: { id: { not: exceptUserId } },
    select: { id: true },
  });
  if (others.length === 0) return;
  await db.notification.createMany({
    data: others.map((u) => ({ userId: u.id, type, title, body })),
  });
}

export async function addFeed(
  db: PrismaClient,
  userId: string,
  type: FeedType,
  message: string,
  meta?: Record<string, unknown>,
) {
  await db.feedItem.create({ data: { userId, type, message, meta: meta as object | undefined } });
}

async function grant(db: PrismaClient, userId: string, code: string) {
  const achievement = await db.achievement.findUnique({ where: { code } });
  if (!achievement) return;
  const exists = await db.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (exists) return;
  await db.userAchievement.create({ data: { userId, achievementId: achievement.id } });
  await notify(db, userId, "SYSTEM", `Logro desbloqueado: ${achievement.icon} ${achievement.name}`, achievement.description);
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  await addFeed(db, userId, "ACHIEVEMENT", `${user?.name ?? "Alguien"} desbloqueó el logro ${achievement.icon} ${achievement.name}`);
}

/** Revisa y otorga logros según el estado actual del usuario. */
export async function checkAchievements(db: PrismaClient, userId: string) {
  const [workouts, prs, attendances, user, volume] = await Promise.all([
    db.workout.count({ where: { userId, endedAt: { not: null } } }),
    db.personalRecord.count({ where: { userId } }),
    db.attendance.count({ where: { userId } }),
    db.user.findUnique({ where: { id: userId }, select: { currentStreak: true, bestStreak: true } }),
    db.workout.aggregate({ where: { userId }, _sum: { totalVolume: true } }),
  ]);
  const totalVolume = volume._sum.totalVolume ?? 0;

  if (workouts >= 1) await grant(db, userId, "FIRST_WORKOUT");
  if (workouts >= 10) await grant(db, userId, "WORKOUTS_10");
  if (workouts >= 100) await grant(db, userId, "WORKOUTS_100");
  if (prs >= 1) await grant(db, userId, "FIRST_PR");
  if (prs >= 10) await grant(db, userId, "PR_10");
  if ((user?.bestStreak ?? 0) >= 4) await grant(db, userId, "STREAK_7"); // 1 mes (4 semanas)
  if ((user?.bestStreak ?? 0) >= 26) await grant(db, userId, "STREAK_30"); // 6 meses (26 semanas)
  if (totalVolume >= 1000) await grant(db, userId, "VOLUME_1000");
  if (totalVolume >= 10000) await grant(db, userId, "VOLUME_10000");
  if (attendances >= 100) await grant(db, userId, "ATTENDANCE_100");
}
