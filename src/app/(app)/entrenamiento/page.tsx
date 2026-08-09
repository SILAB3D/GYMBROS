"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dumbbell, TrendingUp, CalendarCheck, Medal } from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { RoutinesPlanView } from "@/components/views/routines-plan-view";
import { ProgressView } from "@/components/views/progress-view";
import { AttendanceView } from "@/components/views/attendance-view";
import { PRsView } from "@/components/views/prs-view";
import { WorkoutLauncher } from "@/components/workout-launcher";

const TABS = [
  { key: "rutinas", label: "Rutinas y plan", icon: Dumbbell },
  { key: "progreso", label: "Progreso", icon: TrendingUp },
  { key: "asistencia", label: "Asistencia", icon: CalendarCheck },
  { key: "prs", label: "PRs", icon: Medal },
] as const;

// Alias de pestañas antiguas para que los enlaces guardados sigan funcionando
const TAB_ALIASES: Record<string, string> = { plan: "rutinas", historial: "asistencia" };

function TrainingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const utils = api.useUtils();
  const requested = params.get("tab") ?? "rutinas";
  const tab = TAB_ALIASES[requested] ?? requested;
  const [visited, setVisited] = useState<Set<string>>(() => new Set([tab]));

  // Precargar en segundo plano los datos de TODAS las pestañas
  useEffect(() => {
    const now = new Date();
    void utils.routine.mine.prefetch();
    void utils.plan.get.prefetch();
    void utils.routine.shared.prefetch();
    void utils.attendance.stats.prefetch();
    void utils.attendance.month.prefetch({ year: now.getFullYear(), month: now.getMonth() });
    void utils.pr.bests.prefetch();
    void utils.pr.recent.prefetch({ limit: 15 });
    void utils.exercise.list.prefetch();
    void utils.workout.history.prefetch({ limit: 30 });
    void utils.stats.routineTrends.prefetch();
  }, [utils]);

  // Las pestañas visitadas se mantienen montadas: volver a ellas es instantáneo
  useEffect(() => {
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);

  return (
    <div className="space-y-6">
      <WorkoutLauncher />

      <div className="flex gap-1 rounded-2xl bg-surface p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => router.replace(`/entrenamiento?tab=${key}`, { scroll: false })}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm transition",
              tab === key ? "bg-accent font-medium text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden min-[560px]:inline">{label}</span>
          </button>
        ))}
      </div>

      {visited.has("rutinas") && <div className={tab === "rutinas" ? "" : "hidden"}><RoutinesPlanView /></div>}
      {visited.has("progreso") && <div className={tab === "progreso" ? "" : "hidden"}><ProgressView /></div>}
      {visited.has("asistencia") && <div className={tab === "asistencia" ? "" : "hidden"}><AttendanceView /></div>}
      {visited.has("prs") && <div className={tab === "prs" ? "" : "hidden"}><PRsView /></div>}
    </div>
  );
}

export default function TrainingPage() {
  return (
    <Suspense fallback={null}>
      <TrainingContent />
    </Suspense>
  );
}
