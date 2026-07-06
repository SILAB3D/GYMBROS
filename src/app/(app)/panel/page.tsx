"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Flame, Trophy, Dumbbell, CalendarCheck, ChevronRight, Play } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, Stat, ProgressBar, Badge } from "@/components/ui";
import { MonthCalendar } from "@/components/month-calendar";
import { formatKg } from "@/lib/utils";

export default function DashboardPage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.dashboard.summary.useQuery();
  const checkIn = api.attendance.checkIn.useMutation({
    onSuccess: () => utils.dashboard.summary.invalidate(),
  });

  if (isLoading || !data) return <Spinner />;

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hola, {data.user.name.split(" ")[0]} 👋</h1>
          <p className="text-sm capitalize text-muted">
            {format(now, "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>
        {!data.todayAttendance ? (
          <Button onClick={() => checkIn.mutate({})} loading={checkIn.isLoading}>
            <CalendarCheck className="h-4 w-4" /> Hoy fui al gym
          </Button>
        ) : (
          <Badge className="bg-accent/15 text-accent">✅ Asistencia registrada</Badge>
        )}
      </div>

      {/* Entrenamiento activo */}
      {data.activeWorkout && (
        <Link href="/entrenar">
          <Card className="flex items-center justify-between border-accent/40 bg-accent/5 transition hover:bg-accent/10 animate-pulse-glow">
            <div>
              <p className="text-sm text-muted">Entrenamiento en curso</p>
              <p className="font-semibold">
                {data.activeWorkout.routine
                  ? `${data.activeWorkout.routine.emoji} ${data.activeWorkout.routine.name}`
                  : "Entrenamiento libre"}
              </p>
            </div>
            <Play className="h-6 w-6 text-accent" />
          </Card>
        </Link>
      )}

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Racha"
          value={
            <span className="flex items-center gap-1">
              {data.user.currentStreak} <Flame className="h-5 w-5 text-orange-400" />
            </span>
          }
          sub={`Mejor: ${data.user.bestStreak} días`}
        />
        <Stat
          label="Ranking semanal"
          value={data.rankingPosition ? `#${data.rankingPosition}` : "—"}
          sub={`${data.myWeekPoints} puntos`}
        />
        <Stat label="Esta semana" value={data.weekAttendances} sub="asistencias" />
        <Stat label="Volumen total" value={formatKg(data.totalVolume)} sub={`${data.totalWorkouts} entrenos`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Rutinas de hoy */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Entrenamiento de hoy</h2>
            <Link href="/rutinas" className="text-xs text-accent hover:underline">
              Ver rutinas
            </Link>
          </div>
          {data.todayRoutines.length === 0 ? (
            <p className="text-sm text-muted">
              No tienes rutinas asignadas para hoy.{" "}
              <Link href="/rutinas" className="text-accent hover:underline">
                Elige una para entrenar
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {data.todayRoutines.map((r) => (
                <Link
                  key={r.id}
                  href={`/rutinas/${r.id}`}
                  className="flex items-center justify-between rounded-xl bg-surface-2 p-3 transition hover:bg-border"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{r.emoji}</span>
                    <span>
                      <span className="block text-sm font-medium">{r.name}</span>
                      <span className="text-xs text-muted">{r._count.exercises} ejercicios</span>
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Calendario del mes */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold capitalize">
              {format(now, "MMMM yyyy", { locale: es })}
            </h2>
            <Link href="/asistencia" className="text-xs text-accent hover:underline">
              Ver todo
            </Link>
          </div>
          <MonthCalendar
            year={now.getFullYear()}
            month={now.getMonth()}
            trainedDates={data.monthAttendanceDates}
          />
        </Card>

        {/* Últimos PRs */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Trophy className="h-4 w-4 text-gold" /> Últimos PRs
            </h2>
            <Link href="/prs" className="text-xs text-accent hover:underline">
              Ver todos
            </Link>
          </div>
          {data.recentPRs.length === 0 ? (
            <p className="text-sm text-muted">Aún no tienes récords. ¡A por el primero! 💪</p>
          ) : (
            <div className="space-y-2">
              {data.recentPRs.map((pr) => (
                <div key={pr.id} className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
                  <span className="text-sm">{pr.exercise.name}</span>
                  <span className="text-sm font-bold text-accent">
                    {pr.weight} kg × {pr.reps}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Objetivos activos */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Objetivos</h2>
            <Link href="/objetivos" className="text-xs text-accent hover:underline">
              Gestionar
            </Link>
          </div>
          {data.activeGoals.length === 0 ? (
            <p className="text-sm text-muted">
              Sin objetivos activos.{" "}
              <Link href="/objetivos" className="text-accent hover:underline">
                Crea el primero
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {data.activeGoals.map((g) => {
                const pct = Math.round((g.currentValue / g.targetValue) * 100);
                return (
                  <div key={g.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{g.title}</span>
                      <span className="text-muted">{pct}%</span>
                    </div>
                    <ProgressBar value={pct} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Notificaciones recientes */}
      {data.unreadNotifications.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Notificaciones</h2>
            <Link href="/notificaciones" className="text-xs text-accent hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="space-y-2">
            {data.unreadNotifications.map((n) => (
              <div key={n.id} className="rounded-xl bg-surface-2 p-3 text-sm">
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted">{n.body}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* CTA registrar entreno */}
      {!data.activeWorkout && (
        <Link href="/rutinas">
          <Button size="lg" className="w-full md:w-auto">
            <Dumbbell className="h-5 w-5" /> Registrar entrenamiento
          </Button>
        </Link>
      )}
    </div>
  );
}
