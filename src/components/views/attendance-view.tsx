"use client";

import { useState } from "react";
import { format, addMonths, subMonths, differenceInMinutes, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, ChevronDown, Flame, CalendarCheck, Check, Trash2, AlertTriangle,
} from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, Stat, Badge, Modal, EmptyState } from "@/components/ui";
import { MonthCalendar } from "@/components/month-calendar";
import { formatKg } from "@/lib/utils";

/**
 * Asistencia e historial en un único apartado: arriba las estadísticas y el
 * calendario del mes, debajo el detalle de cada entrenamiento. Al pulsar un día
 * entrenado se abre su ficha, desde donde se puede borrar el día completo
 * (entreno, puntos, PRs automáticos y publicaciones que generó).
 */
export function AttendanceView() {
  const utils = api.useUtils();
  const [cursor, setCursor] = useState(new Date());
  const [dayDetail, setDayDetail] = useState<Date | null>(null);
  const { data: stats, isLoading } = api.attendance.stats.useQuery();
  const monthInput = { year: cursor.getFullYear(), month: cursor.getMonth() };
  const { data: monthData } = api.attendance.month.useQuery(monthInput);
  const { data: workouts } = api.workout.history.useQuery({ limit: 30 });
  const { data: day, isFetching: dayLoading } = api.attendance.day.useQuery(
    { date: dayDetail ?? new Date() },
    { enabled: dayDetail !== null },
  );

  const invalidateAll = () => {
    utils.attendance.invalidate();
    utils.workout.history.invalidate();
    utils.dashboard.summary.invalidate();
    utils.pr.invalidate();
  };
  const checkIn = api.attendance.checkIn.useMutation({ onSuccess: invalidateAll });
  const deleteDay = api.attendance.deleteDay.useMutation({
    onSuccess: () => {
      invalidateAll();
      setDayDetail(null);
    },
  });

  if (isLoading || !stats) return <Spinner />;

  const attendances = monthData?.attendances ?? [];
  const shortDates = monthData?.shortDates ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Asistencia e historial</h1>
        <Button title="Registrar asistencia de hoy" onClick={() => checkIn.mutate({})} loading={checkIn.isLoading}>
          <CalendarCheck className="h-4 w-4" /> <span className="hidden sm:inline">Registrar hoy</span>
        </Button>
      </div>

      {stats.streakAtRisk && stats.streakMissing >= stats.streakDaysLeft && (
        <Card className="flex items-center gap-3 border-amber-400/40 bg-amber-400/5 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm">
            <strong>Racha en peligro.</strong> Te {stats.streakMissing === 1 ? "queda" : "quedan"}{" "}
            {stats.streakMissing} {stats.streakMissing === 1 ? "entreno" : "entrenos"} y{" "}
            {stats.streakDaysLeft} {stats.streakDaysLeft === 1 ? "día" : "días"} de semana.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Racha semanal"
          value={<span className="flex items-center gap-1">{stats.currentStreak} <Flame className="h-5 w-5 text-orange-400" /></span>}
          sub={`Mejor: ${stats.bestStreak} semanas`}
        />
        <Stat
          label="Esta semana"
          value={stats.weeklyTargetDays > 0 ? `${stats.thisWeek}/${stats.weeklyTargetDays}` : stats.thisWeek}
          sub={stats.weeklyTargetDays > 0 ? "días planificados" : "asistencias"}
        />
        <Stat label="Este mes" value={stats.thisMonth} sub="días entrenados" />
        <Stat label="Este año" value={stats.thisYear} sub={`Total histórico: ${stats.total}`} />
        <Stat label="Promedio" value={`${stats.weeklyAvg}/sem`} sub={`${stats.monthlyAvg} al mes`} />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold capitalize">{format(cursor, "MMMM yyyy", { locale: es })}</h2>
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <MonthCalendar
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          trainedDates={attendances.map((a) => a.date)}
          shortDates={shortDates}
          onDayClick={(date) => setDayDetail(date)}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{attendances.length} asistencias este mes</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-accent" /> normal</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border-2 border-amber-400 bg-amber-400/20" /> corto</span>
          </span>
        </div>
        <p className="mt-1 text-center text-[11px] text-muted">Pulsa un día entrenado para ver su ficha o borrarlo.</p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Historial de entrenamientos</h2>
        {workouts?.length === 0 ? (
          <EmptyState
            icon="📖"
            title="Aún no hay entrenamientos"
            subtitle="Cuando termines tu primera sesión aparecerá aquí"
          />
        ) : (
          workouts?.map((w) => (
            <details key={w.id} className="group rounded-2xl border border-border bg-surface">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {w.routine ? `${w.routine.emoji} ${w.routine.name}` : "Entrenamiento libre"}
                  </p>
                  <p className="text-xs capitalize text-muted">
                    {format(w.startedAt, "EEEE d MMM yyyy", { locale: es })}
                    {w.endedAt ? ` · ${differenceInMinutes(w.endedAt, w.startedAt)} min` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge>{formatKg(w.totalVolume)}</Badge>
                  <Badge>{w.totalSets} series</Badge>
                  <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="space-y-3 border-t border-border p-4 pt-3">
                {w.exercises.map((we) => (
                  <div key={we.id}>
                    <p className="mb-1 text-sm font-medium">{we.exercise.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {we.sets.map((s) => (
                        <span
                          key={s.id}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
                            s.completed ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted line-through"
                          }`}
                        >
                          {!we.exercise.noWeight && s.weight > 0 ? `${s.weight} kg × ` : ""}
                          {s.reps}
                          {s.completed && <Check className="h-3 w-3" />}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {w.notes && <p className="text-xs text-muted">📝 {w.notes}</p>}
                <Button
                  size="sm" variant="ghost" className="text-red-400"
                  onClick={() => setDayDetail(w.startedAt)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Borrar este día
                </Button>
              </div>
            </details>
          ))
        )}
      </section>

      <Modal
        open={dayDetail !== null}
        onClose={() => setDayDetail(null)}
        title={dayDetail ? format(dayDetail, "EEEE d 'de' MMMM yyyy", { locale: es }) : undefined}
        subtitle={
          isSameDay(dayDetail ?? new Date(), new Date()) ? "Es el día de hoy" : undefined
        }
        footer={
          <Button
            variant="danger"
            className="w-full"
            loading={deleteDay.isLoading}
            disabled={!day?.attendance && (day?.workouts.length ?? 0) === 0}
            onClick={() => {
              if (!dayDetail) return;
              if (confirm("¿Borrar este día y todo lo que generó? No se puede deshacer.")) {
                deleteDay.mutate({ date: dayDetail });
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Borrar el día y sus puntos
          </Button>
        }
      >
        {dayLoading && !day ? (
          <Spinner />
        ) : (
          <div className="space-y-4">
            {day?.attendance ? (
              <p className="text-sm text-muted">Día registrado como entrenado.</p>
            ) : (
              <p className="text-sm text-muted">Este día no tiene asistencia registrada.</p>
            )}

            {(day?.workouts.length ?? 0) === 0 ? (
              <p className="text-sm text-muted">Sin entrenamientos guardados en este día.</p>
            ) : (
              day?.workouts.map((w) => (
                <Card key={w.id} className="space-y-2 py-3">
                  <p className="text-sm font-medium">
                    {w.routine ? `${w.routine.emoji} ${w.routine.name}` : "Entrenamiento libre"}
                  </p>
                  <p className="text-xs text-muted">
                    {formatKg(w.totalVolume)} · {w.totalSets} series · {w.totalReps} reps
                  </p>
                  {w.exercises.map((we) => (
                    <p key={we.id} className="text-xs text-muted">
                      {we.exercise.name}:{" "}
                      {we.sets
                        .filter((s) => s.completed)
                        .map((s) => (we.exercise.noWeight ? `${s.reps}` : `${s.weight}×${s.reps}`))
                        .join(" · ") || "sin series completadas"}
                    </p>
                  ))}
                </Card>
              ))
            )}

            <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-muted">
              Al borrar el día se eliminan la asistencia, sus entrenamientos y todo lo que
              generaron: puntos de asistencia, de entreno y de PR, los récords detectados
              automáticamente y las publicaciones del grupo. La racha se recalcula.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
