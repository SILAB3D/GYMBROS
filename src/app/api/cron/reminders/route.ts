import { NextResponse } from "next/server";
import { startOfISOWeek, endOfISOWeek, differenceInCalendarDays, startOfDay, isSameDay } from "date-fns";
import { db } from "@/lib/db";
import { dispatchDuePolls } from "@/server/services/poll-dispatch";
import { notifyUserFromTemplate } from "@/server/services/notify-templates";
import { notify } from "@/server/services/gamification";
import { weekStreakState } from "@/server/services/streak";
import { purgeExpiredDeletions } from "@/server/services/account-deletion";

export const dynamic = "force-dynamic";

/**
 * Recordatorios diarios (Vercel Cron, ver vercel.json). El contenido sale de
 * plantillas editables por el admin; la categoría "reminders" se respeta por usuario.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await dispatchDuePolls(db);
  // Fase 2 del borrado de cuenta: los que ya agotaron el plazo desaparecen
  const purged = await purgeExpiredDeletions(db);

  const now = new Date();
  const weekStart = startOfISOWeek(now);
  // A quien está de salida no se le dan las buenas noches
  const users = await db.user.findMany({ where: { deletionRequestedAt: null } });
  let sent = 0;

  for (const user of users) {
    // 1) Queda 1 día para cumplir la semana
    if (user.weeklyTargetDays > 0) {
      const weekCount = await db.attendance.count({
        where: { userId: user.id, date: { gte: weekStart, lte: endOfISOWeek(now) } },
      });

      // 1.a) Estado de la racha: aviso de peligro y aviso de pérdida (una vez por semana)
      const streak = weekStreakState({
        currentStreak: user.currentStreak,
        lastCompletedWeek: user.lastCompletedWeek,
        weeklyTargetDays: user.weeklyTargetDays,
        weekCount,
        now,
      });
      if (streak.lost && user.currentStreak > 0) {
        const alreadyNotified =
          user.streakLostWeek && isSameDay(startOfISOWeek(user.streakLostWeek), weekStart);
        // La racha se pone a 0 de verdad: así el aviso sale una sola vez y el
        // próximo cumplimiento vuelve a empezar desde la semana 1.
        await db.user.update({
          where: { id: user.id },
          data: { currentStreak: 0, streakLostWeek: weekStart },
        });
        if (!alreadyNotified) {
          await notify(
            db, user.id, "STREAK",
            `Has perdido tu racha de ${user.currentStreak} ${user.currentStreak === 1 ? "semana" : "semanas"} 💔`,
            `Esta semana ya no llegas a tus ${user.weeklyTargetDays} días. Empieza una nueva racha cuanto antes.`,
            "streaks",
          );
          sent++;
        }
      } else if (streak.atRisk && streak.missing > 0) {
        const alreadyWarned =
          user.streakWarnedWeek && isSameDay(startOfISOWeek(user.streakWarnedWeek), weekStart);
        // Se avisa cuando el margen ya es justo: quedan tantos días como entrenos pendientes
        if (!alreadyWarned && streak.missing >= streak.daysLeft) {
          await db.user.update({ where: { id: user.id }, data: { streakWarnedWeek: weekStart } });
          await notify(
            db, user.id, "STREAK",
            `¡Tu racha de ${streak.streak} ${streak.streak === 1 ? "semana" : "semanas"} está en peligro! 🔥`,
            `Te ${streak.missing === 1 ? "queda" : "quedan"} ${streak.missing} ${streak.missing === 1 ? "entreno" : "entrenos"} y ${streak.daysLeft} ${streak.daysLeft === 1 ? "día" : "días"} de semana.`,
            "streaks",
          );
          sent++;
        }
      }

      const remaining = user.weeklyTargetDays - weekCount;
      if (remaining === 1) {
        const already = await db.notification.findFirst({
          where: { userId: user.id, type: "SYSTEM", title: { contains: "semana" }, createdAt: { gte: weekStart } },
        });
        if (!already) {
          await notifyUserFromTemplate(db, user.id, "REMINDER_WEEK_LEFT", "reminders", {
            count: weekCount,
            target: user.weeklyTargetDays,
          });
          sent++;
        }
      }
    }

    // 2) Varios días sin entrenar (máx. una vez cada 3 días)
    if (user.lastAttendanceDate) {
      const daysOff = differenceInCalendarDays(startOfDay(now), startOfDay(user.lastAttendanceDate));
      if (daysOff >= 3) {
        const recent = await db.notification.findFirst({
          where: { userId: user.id, type: "SYSTEM", createdAt: { gte: new Date(Date.now() - 3 * 86400000) } },
        });
        if (!recent) {
          await notifyUserFromTemplate(db, user.id, "REMINDER_INACTIVE", "reminders", { days: daysOff });
          sent++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, users: users.length, sent, purged });
}
