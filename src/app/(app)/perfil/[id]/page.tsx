"use client";

import { useParams } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { Flame, Trophy } from "lucide-react";
import { api } from "@/trpc/react";
import { Card, Spinner, Avatar, Stat, Badge, ProgressBar } from "@/components/ui";

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = api.user.publicProfile.useQuery({ userId: params.id });

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
          label="Racha"
          value={
            <span className="flex items-center gap-1">
              {data.user.currentStreak} <Flame className="h-5 w-5 text-orange-400" />
            </span>
          }
          sub={`Mejor: ${data.user.bestStreak}`}
        />
        <Stat label="Asistencias" value={data.attendances} />
        <Stat label="Entrenamientos" value={data.workouts} />
        <Stat label="Puntos históricos" value={data.totalPoints} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4 text-gold" /> PRs recientes
          </h2>
          {data.recentPRs.length === 0 ? (
            <p className="text-sm text-muted">Sin récords todavía</p>
          ) : (
            <div className="space-y-2">
              {data.recentPRs.map((pr) => (
                <div key={pr.id} className="flex justify-between rounded-xl bg-surface-2 p-3 text-sm">
                  <span>{pr.exercise.name}</span>
                  <span className="font-bold text-accent">{pr.weight} kg × {pr.reps}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Objetivos públicos</h2>
          {data.publicGoals.length === 0 ? (
            <p className="text-sm text-muted">Sin objetivos públicos</p>
          ) : (
            <div className="space-y-3">
              {data.publicGoals.map((g) => {
                const pct = Math.min(100, Math.round((g.currentValue / g.targetValue) * 100));
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

        {data.sharedRoutines.length > 0 && (
          <Card>
            <h2 className="mb-3 font-semibold">Rutinas compartidas</h2>
            <div className="space-y-2">
              {data.sharedRoutines.map((r) => (
                <div key={r.id} className="flex justify-between rounded-xl bg-surface-2 p-3 text-sm">
                  <span>{r.emoji} {r.name}</span>
                  <span className="text-muted">{r._count.exercises} ejercicios</span>
                </div>
              ))}
            </div>
          </Card>
        )}

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
    </div>
  );
}
