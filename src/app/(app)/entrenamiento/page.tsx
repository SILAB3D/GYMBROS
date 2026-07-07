"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dumbbell, CalendarRange, CalendarCheck, Medal, History } from "lucide-react";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { RoutinesView } from "@/components/views/routines-view";
import { AttendanceView } from "@/components/views/attendance-view";
import { PRsView } from "@/components/views/prs-view";
import { PlanView } from "@/components/views/plan-view";
import { HistoryView } from "@/components/views/history-view";
import { WorkoutLauncher } from "@/components/workout-launcher";

const TABS = [
  { key: "rutinas", label: "Rutinas", icon: Dumbbell },
  { key: "plan", label: "Plan", icon: CalendarRange },
  { key: "asistencia", label: "Asistencia", icon: CalendarCheck },
  { key: "prs", label: "PRs", icon: Medal },
  { key: "historial", label: "Historial", icon: History },
] as const;

function TrainingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const utils = api.useUtils();
  const tab = params.get("tab") ?? "rutinas";
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
            <span className="hidden min-[460px]:inline">{label}</span>
          </button>
        ))}
      </div>

      {visited.has("rutinas") && <div className={tab === "rutinas" ? "" : "hidden"}><RoutinesView /></div>}
      {visited.has("plan") && <div className={tab === "plan" ? "" : "hidden"}><PlanView /></div>}
      {visited.has("asistencia") && <div className={tab === "asistencia" ? "" : "hidden"}><AttendanceView /></div>}
      {visited.has("prs") && <div className={tab === "prs" ? "" : "hidden"}><PRsView /></div>}
      {visited.has("historial") && <div className={tab === "historial" ? "" : "hidden"}><HistoryView /></div>}
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
