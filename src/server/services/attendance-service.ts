import type { PrismaClient, PointType } from "@prisma/client";
import { startOfDay, startOfISOWeek, endOfISOWeek, subWeeks, isSameDay, format } from "date-fns";
import { awardPoints, addFeed, notify, checkAchievements } from "./gamification";

/** Nivel de recompensa según las semanas consecutivas cumplidas. */
function streakLevel(weeks: number): { type: PointType; title: string } {
  if (weeks === 1) return { type: "STREAK_WEEK1", title: "¡Racha de 1 semana! 🔥" };
  if (weeks === 2) return { type: "STREAK_WEEK2", title: "¡Racha de 2 semanas! 🔥" };
  if (weeks === 3) return { type: "STREAK_WEEK3", title: "¡Racha de 3 semanas! 🔥" };
  if (weeks === 4) return { type: "STREAK_MONTH", title: "¡Racha de 1 mes! 🔥🔥" };
  return { type: "STREAK_CRACK", title: `¡CRACK! ${weeks} semanas seguidas 💎` };
}

/**
 * Registra la asistencia de un día (si no existe), otorga puntos y
 * actualiza la racha semanal. Lo usan el botón de Asistencia y el
 * cierre de entrenamientos (asistencia automática al entrenar).
 */
export async function registerAttendance(
  db: PrismaClient,
  userId: string,
  rawDate: Date = new Date(),
  extra?: { gymName?: string; notes?: string },
) {
  const date = startOfDay(rawDate);

  const existing = await db.attendance.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (existing) return { attendance: existing, alreadyRegistered: true, weekStreak: null as number | null };

  const attendance = await db.attendance.create({
    data: { userId, date, gymName: extra?.gymName, notes: extra?.notes },
  });

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({ where: { id: userId }, data: { lastAttendanceDate: date } });

  // Puntos por día entrenado
  await awardPoints(db, userId, "ATTENDANCE", { date: date.toISOString() });

  // --- Racha semanal: se cumple la semana al alcanzar los días planificados ---
  let weekStreak: number | null = null;
  if (user.weeklyTargetDays > 0) {
    const weekStart = startOfISOWeek(date);
    const alreadyCounted =
      user.lastCompletedWeek && isSameDay(startOfISOWeek(user.lastCompletedWeek), weekStart);

    if (!alreadyCounted) {
      const weekCount = await db.attendance.count({
        where: { userId, date: { gte: weekStart, lte: endOfISOWeek(date) } },
      });
      if (weekCount >= user.weeklyTargetDays) {
        const previousWeek = subWeeks(weekStart, 1);
        const continues =
          user.lastCompletedWeek &&
          isSameDay(startOfISOWeek(user.lastCompletedWeek), previousWeek);
        weekStreak = continues ? user.currentStreak + 1 : 1;

        const level = streakLevel(weekStreak);
        const points = await awardPoints(db, userId, level.type, {
          week: format(weekStart, "yyyy-MM-dd"),
          streak: weekStreak,
        });

        await db.user.update({
          where: { id: userId },
          data: {
            currentStreak: weekStreak,
            bestStreak: Math.max(user.bestStreak, weekStreak),
            lastCompletedWeek: weekStart,
          },
        });

        await notify(
          db, userId, "STREAK", level.title,
          points > 0
            ? `+${points} puntos por cumplir tus ${user.weeklyTargetDays} días esta semana`
            : `Has cumplido tus ${user.weeklyTargetDays} días esta semana`,
          "streaks",
        );
        if (weekStreak >= 4) {
          await addFeed(db, userId, "STREAK", `${user.name} lleva ${weekStreak} semanas cumpliendo su plan 💎`);
        } else {
          await addFeed(db, userId, "STREAK", `${user.name} cumplió su semana de entreno (racha de ${weekStreak}) ✅`);
        }
      }
    }
  }

  await checkAchievements(db, userId);
  return { attendance, alreadyRegistered: false, weekStreak };
}

/**
 * Recalcula desde cero la racha semanal de un usuario a partir de sus
 * asistencias (tras borrar un día, por ejemplo). Una semana cuenta si
 * alcanza los días planificados.
 */
export async function recomputeStreak(db: PrismaClient, userId: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { weeklyTargetDays: true },
  });
  const attendances = await db.attendance.findMany({
    where: { userId },
    select: { date: true },
    orderBy: { date: "asc" },
  });
  const lastDate = attendances.length > 0 ? attendances[attendances.length - 1]!.date : null;

  if (user.weeklyTargetDays <= 0 || attendances.length === 0) {
    await db.user.update({
      where: { id: userId },
      data: { currentStreak: 0, bestStreak: 0, lastCompletedWeek: null, lastAttendanceDate: lastDate },
    });
    return;
  }

  // Contar asistencias por semana ISO
  const perWeek = new Map<number, number>();
  for (const a of attendances) {
    const k = startOfISOWeek(a.date).getTime();
    perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
  }
  const completedWeeks = Array.from(perWeek.entries())
    .filter(([, count]) => count >= user.weeklyTargetDays)
    .map(([k]) => k)
    .sort((a, b) => a - b);

  // Mejor racha = tramo más largo de semanas consecutivas cumplidas
  let best = 0;
  let current = 0;
  let lastCompleted: number | null = null;
  let prev: number | null = null;
  for (const wk of completedWeeks) {
    if (prev !== null && startOfISOWeek(subWeeks(new Date(wk), 1)).getTime() === prev) {
      current += 1;
    } else {
      current = 1;
    }
    best = Math.max(best, current);
    lastCompleted = wk;
    prev = wk;
  }

  await db.user.update({
    where: { id: userId },
    data: {
      currentStreak: current,
      bestStreak: best,
      lastCompletedWeek: lastCompleted ? new Date(lastCompleted) : null,
      lastAttendanceDate: lastDate,
    },
  });
}
