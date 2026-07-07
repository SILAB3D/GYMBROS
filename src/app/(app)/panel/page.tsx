"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Flame, Trophy, ChevronRight, SkipForward } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, Stat } from "@/components/ui";
import { MonthCalendar } from "@/components/month-calendar";
import { WorkoutLauncher } from "@/components/workout-launcher";
import { formatKg } from "@/lib/utils";

export default function DashboardPage() {
  const utils = api.useUtils();
  const { data, isLoading } = api.dashboard.summary.useQuery();
  const advancePlan = api.plan.advance.useMutation({
    onSuccess: () => {
      utils.dashboard.summary.invalidate();
      utils.plan.get.invalidate();
    },
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

      </div>

      {/* Botón central: registrar / actualizar entrenamiento */}
      <WorkoutLauncher />

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Racha semanal"
          value={
            <span className="flex items-center gap-1">
              {data.user.currentStreak} <Flame className="h-5 w-5 text-orange-400" />
            </span>
          }
          sub={`Mejor: ${data.user.bestStreak} semanas`}
        />
        <Stat
          label="Ranking semanal"
          value={data.rankingPosition ? `#${data.rankingPosition}` : "—"}
          sub={`${data.myWeekPoints} puntos`}
        />
        <Stat
          label="Esta semana"
          value={
            data.user.weeklyTargetDays > 0
              ? `${data.weekAttendances}/${data.user.weeklyTargetDays}`
              : data.weekAttendances
          }
          sub={data.user.weeklyTargetDays > 0 ? "días planificados" : "asistencias"}
        />
        <Stat label="Volumen total" value={formatKg(data.totalVolume)} sub={`${data.totalWorkouts} entrenos`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Entrenamiento de hoy, según el plan */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Entrenamiento de hoy</h2>
            <Link href="/entrenamiento?tab=plan" className="text-xs text-accent hover:underline">
              Configurar plan
            </Link>
          </div>
          {data.plan ? (
            data.plan.next?.routine ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
                  <span className="flex items-center gap-2.5">
                    <span className="text-2xl">{data.plan.next.routine.emoji}</span>
                    <span>
                      <span className="block font-medium">{data.plan.next.routine.name}</span>
                      <span className="text-xs text-muted">
                        {data.plan.next.routine._count.exercises} ejercicios · te toca hoy
                      </span>
                    </span>
                  </span>
                  <Button
                    size="sm" variant="ghost" title="Saltar al siguiente"
                    loading={advancePlan.isLoading}
                    onClick={() => advancePlan.mutate()}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {data.plan.following && (
                  <p className="text-xs text-muted">
                    Después:{" "}
                    {data.plan.following.routine
                      ? `${data.plan.following.routine.emoji} ${data.plan.following.routine.name}`
                      : "😴 descanso"}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
                <span className="flex items-center gap-2.5">
                  <span className="text-2xl">😴</span>
                  <span>
                    <span className="block font-medium">Día de descanso</span>
                    <span className="text-xs text-muted">recuperar también es entrenar</span>
                  </span>
                </span>
                <Button
                  size="sm" variant="secondary"
                  loading={advancePlan.isLoading}
                  onClick={() => advancePlan.mutate()}
                >
                  Cumplido ✓
                </Button>
              </div>
            )
          ) : data.todayRoutines.length > 0 ? (
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
          ) : (
            <p className="text-sm text-muted">
              Define el orden de tus rutinas y descansos en{" "}
              <Link href="/entrenamiento?tab=plan" className="text-accent hover:underline">
                Entrenamiento → Plan
              </Link>{" "}
              y aquí verás siempre lo que te toca.
            </p>
          )}
        </Card>

        {/* Calendario del mes */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold capitalize">
              {format(now, "MMMM yyyy", { locale: es })}
            </h2>
            <Link href="/entrenamiento?tab=asistencia" className="text-xs text-accent hover:underline">
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
            <Link href="/entrenamiento?tab=prs" className="text-xs text-accent hover:underline">
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

    </div>
  );
}
