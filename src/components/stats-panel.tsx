"use client";

import { formatKg, cn } from "@/lib/utils";

type Props = {
  streak: number;
  bestStreak: number;
  rankingPosition: number | null;
  weekPoints: number;
  weekAttendances: number;
  weeklyTarget: number;
  totalVolume: number;
  totalWorkouts: number;
};

/** Resumen de estadísticas: cuatro cifras y una barra. Sin adornos. */
export function StatsPanel({
  streak, rankingPosition, weekPoints,
  weekAttendances, weeklyTarget, totalVolume,
}: Props) {
  const weekPct = weeklyTarget > 0 ? Math.min(100, (weekAttendances / weeklyTarget) * 100) : 0;
  const weekDone = weeklyTarget > 0 && weekAttendances >= weeklyTarget;

  const items = [
    { label: "Puntos", value: String(weekPoints) },
    { label: "Ranking", value: rankingPosition ? `#${rankingPosition}` : "—" },
    {
      label: "Semana",
      value: weeklyTarget > 0 ? `${weekAttendances}/${weeklyTarget}` : String(weekAttendances),
      highlight: weekDone,
    },
    { label: "Volumen", value: formatKg(totalVolume) },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => (
          <div key={it.label} className="min-w-0 text-center">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted">{it.label}</p>
            <p className={cn("mt-0.5 truncate text-xl font-bold", it.highlight ? "text-accent" : "text-fg")}>
              {it.value}
            </p>
          </div>
        ))}
      </div>

      {weeklyTarget > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700"
              style={{ width: `${weekPct}%` }}
            />
          </div>
          <p className="text-center text-xs text-muted">
            {weekDone
              ? `Semana completada · racha de ${streak}`
              : `Te faltan ${weeklyTarget - weekAttendances} entrenos esta semana`}
          </p>
        </div>
      )}
    </div>
  );
}
