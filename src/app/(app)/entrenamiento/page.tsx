"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dumbbell, CalendarRange, CalendarCheck, Medal, History } from "lucide-react";
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
  const tab = params.get("tab") ?? "rutinas";

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

      {tab === "rutinas" && <RoutinesView />}
      {tab === "plan" && <PlanView />}
      {tab === "asistencia" && <AttendanceView />}
      {tab === "prs" && <PRsView />}
      {tab === "historial" && <HistoryView />}
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
