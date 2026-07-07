import { NextResponse } from "next/server";
import { startOfISOWeek, endOfISOWeek, differenceInCalendarDays, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { notify } from "@/server/services/gamification";
import { dispatchDuePolls } from "@/server/services/poll-dispatch";

export const dynamic = "force-dynamic";

/**
 * Recordatorios diarios (Vercel Cron, ver vercel.json):
 * - "Te queda 1 día para cumplir tu semana"
 * - "Llevas N días sin entrenar" (a partir de 3)
 * Se desactivan por usuario en Ajustes (notifyPrefs.reminders = false).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await dispatchDuePolls(db);

  const now = new Date();
  const weekStart = startOfISOWeek(now);
  const users = await db.user.findMany();
  let sent = 0;

  for (const user of users) {
    const prefs = user.notifyPrefs as Record<string, boolean> | null;
    if (prefs?.reminders === false) continue;

    // 1) Queda exactamente 1 día para cumplir la semana (y aún es posible)
    if (user.weeklyTargetDays > 0) {
      const weekCount = await db.attendance.count({
        where: { userId: user.id, date: { gte: weekStart, lte: endOfISOWeek(now) } },
      });
      const remaining = user.weeklyTargetDays - weekCount;
      const daysLeft = differenceInCalendarDays(endOfISOWeek(now), startOfDay(now)) + 1;
      if (remaining === 1 && daysLeft >= 1) {
        const already = await db.notification.findFirst({
          where: {
            userId: user.id,
            title: { startsWith: "¡Te queda 1 día" },
            createdAt: { gte: weekStart },
          },
        });
        if (!already) {
          await notify(
            db, user.id, "SYSTEM",
            "¡Te queda 1 día para cumplir tu semana! 🎯",
            `Llevas ${weekCount}/${user.weeklyTargetDays}. Un entreno más y mantienes la racha.`,
          );
          sent++;
        }
      }
    }

    // 2) Varios días sin entrenar (recordatorio como mucho cada 3 días)
    if (user.lastAttendanceDate) {
      const daysOff = differenceInCalendarDays(startOfDay(now), startOfDay(user.lastAttendanceDate));
      if (daysOff >= 3) {
        const recent = await db.notification.findFirst({
          where: {
            userId: user.id,
            title: { startsWith: "Llevas" },
            createdAt: { gte: new Date(Date.now() - 3 * 86400000) },
          },
        });
        if (!recent) {
          await notify(
            db, user.id, "SYSTEM",
            `Llevas ${daysOff} días sin entrenar 😴`,
            "Tu grupo te echa de menos. ¡Hoy es buen día para volver!",
          );
          sent++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, users: users.length, sent });
}
