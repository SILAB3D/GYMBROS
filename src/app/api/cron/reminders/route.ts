import { NextResponse } from "next/server";
import { startOfISOWeek, endOfISOWeek, differenceInCalendarDays, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { dispatchDuePolls } from "@/server/services/poll-dispatch";
import { notifyUserFromTemplate } from "@/server/services/notify-templates";

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

  const now = new Date();
  const weekStart = startOfISOWeek(now);
  const users = await db.user.findMany();
  let sent = 0;

  for (const user of users) {
    // 1) Queda 1 día para cumplir la semana
    if (user.weeklyTargetDays > 0) {
      const weekCount = await db.attendance.count({
        where: { userId: user.id, date: { gte: weekStart, lte: endOfISOWeek(now) } },
      });
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

  return NextResponse.json({ ok: true, users: users.length, sent });
}
