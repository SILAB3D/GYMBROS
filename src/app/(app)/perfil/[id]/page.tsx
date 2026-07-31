"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { format, formatDistanceToNowStrict, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Flame, Trophy, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { api } from "@/trpc/react";
import { Card, Spinner, Avatar, Stat, Badge, Button } from "@/components/ui";
import { MonthCalendar } from "@/components/month-calendar";
import { PointsBreakdown } from "@/components/points-breakdown";

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const [cursor, setCursor] = useState(new Date());
  const { data, isLoading } = api.user.publicProfile.useQuery({ userId: params.id });
  const { data: calendarDates } = api.user.memberCalendar.useQuery({
    userId: params.id,
    year: cursor.getFullYear(),
    month: cursor.getMonth(),
  });

  if (isLoading || !data) return <Spinner />;

  return (
    <div className="space-y-6">
      <Card className="flex items-center gap-4">
        <Avatar name={data.user.name} src={data.user.avatarUrl} size={72} />
        <div>
          <h1 className="text-2xl font-bold">{data.user.name}</h1>
          <p className="text-sm text-muted">
            {data.user.gymStartDate
              ? `Entrenando desde hace ${formatDistanceToNowStrict(data.user.gymStartDate, { locale: es })}`
              : `En GymBros desde ${format(data.user.createdAt, "MMM yyyy", { locale: es })}`}
          </p>
        </div>
      </Card>

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
        <Stat label="Asistencias" value={data.attendances} />
        <Stat label="Entrenamientos" value={data.workouts} />
        <Stat label="Puntos históricos" value={data.totalPoints} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Calendario de entrenos del miembro */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold capitalize">
              {format(cursor, "MMMM yyyy", { locale: es })}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <MonthCalendar
            year={cursor.getFullYear()}
            month={cursor.getMonth()}
            trainedDates={calendarDates ?? []}
          />
          <p className="mt-3 text-center text-sm text-muted">
            {calendarDates?.length ?? 0} días entrenados este mes
          </p>
        </Card>

        {/* Desglose de puntos */}
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4 text-gold" /> Puntos
          </h2>
          <PointsBreakdown items={data.pointsBreakdown} total={data.totalPoints} />
        </Card>
      </div>

      {/* Rutinas del miembro */}
      <section>
        <h2 className="mb-3 font-semibold">Sus rutinas ({data.routines.length})</h2>
        {data.routines.length === 0 ? (
          <p className="text-sm text-muted">Todavía no ha creado ninguna rutina.</p>
        ) : (
          <div className="space-y-3">
            {data.routines.map((r) => (
              <details key={r.id} className="group rounded-2xl border border-border bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between p-4 [&::-webkit-details-marker]:hidden">
                  <div>
                    <p className="font-medium">
                      {r.emoji} {r.name}
                      {r.isShared && <Badge className="ml-2 bg-accent/15 text-accent">compartida</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      {r.exercises.length} ejercicios
                      {r.estimatedMinutes ? ` · ~${r.estimatedMinutes} min` : ""}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-1.5 border-t border-border p-4 pt-3">
                  {r.exercises.map((e) => (
                    <div key={e.id} className="flex justify-between text-sm">
                      <span>{e.exercise.name}</span>
                      <span className="text-muted">{e.sets}×{e.reps}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Logros */}
      {data.achievements.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Logros</h2>
          <div className="flex flex-wrap gap-2">
            {data.achievements.map((ua) => (
              <Badge key={ua.achievementId} title={ua.achievement.description}>
                {ua.achievement.icon} {ua.achievement.name}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
