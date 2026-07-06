"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Crown } from "lucide-react";
import { api } from "@/trpc/react";
import { Card, Spinner, Avatar, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

const PERIODS = [
  { key: "week", label: "Semanal" },
  { key: "month", label: "Mensual" },
  { key: "year", label: "Anual" },
] as const;

const POINT_LABELS: Record<string, string> = {
  ATTENDANCE: "Asistencias",
  WORKOUT_COMPLETED: "Entrenamientos",
  NEW_PR: "Nuevos PRs",
  STREAK_7: "Rachas de 7 días",
  ROUTINE_SHARED: "Rutinas compartidas",
  STREAK_WEEK1: "Racha: 1.ª semana",
  STREAK_WEEK2: "Racha: 2 semanas",
  STREAK_WEEK3: "Racha: 3 semanas",
  STREAK_MONTH: "Racha: 1 mes",
  STREAK_CRACK: "Semanas crack 💎",
  WEEKLY_TARGET: "Semanas cumplidas (legado)",
  CUSTOM: "Puntos extra del admin",
};

export function RankingView() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("week");
  const { data, isLoading } = api.ranking.get.useQuery({ period });
  const { data: breakdown } = api.ranking.myBreakdown.useQuery({ period });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Ranking</h1>
        <div className="flex gap-1 rounded-xl bg-surface p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition",
                period === p.key ? "bg-accent font-medium text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <Spinner />
      ) : (
        <>
          {/* Podio top 3 */}
          {data.rows.length >= 2 && (
            <div className="flex items-end justify-center gap-3">
              {[1, 0, 2].map((idx) => {
                const row = data.rows[idx];
                if (!row) return null;
                const isFirst = idx === 0;
                return (
                  <motion.div
                    key={row.user.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx === 0 ? 0.2 : 0.05 * idx, type: "spring" }}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4",
                      isFirst ? "w-32 pb-8 border-gold/40 animate-pulse-glow" : "w-28",
                    )}
                  >
                    {isFirst && (
                      <motion.div
                        animate={{ rotate: [0, -8, 8, 0] }}
                        transition={{ repeat: Infinity, duration: 2.5 }}
                      >
                        <Crown className="h-6 w-6 text-gold" />
                      </motion.div>
                    )}
                    <Avatar name={row.user.name} src={row.user.avatarUrl} size={isFirst ? 56 : 44} />
                    <p className="max-w-full truncate text-sm font-medium">{row.user.name}</p>
                    <p className={cn("text-lg font-bold", isFirst ? "text-gold" : "text-accent")}>
                      {row.points} pts
                    </p>
                    <span className="text-2xl">{row.medal}</span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Tabla completa */}
          <Card className="divide-y divide-border p-0">
            {data.rows.map((row) => (
              <div
                key={row.user.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  row.position === data.myPosition && "bg-accent/5",
                )}
              >
                <span className="w-8 text-center font-bold text-muted">
                  {row.medal ?? row.position}
                </span>
                <Avatar name={row.user.name} src={row.user.avatarUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.user.name}</p>
                  {row.user.currentStreak > 0 && (
                    <p className="text-xs text-muted">🔥 racha de {row.user.currentStreak} sem.</p>
                  )}
                </div>
                {row.delta !== null && row.delta !== 0 && (
                  <Badge className={row.delta > 0 ? "text-accent" : "text-red-400"}>
                    {row.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(row.delta)}
                  </Badge>
                )}
                {row.delta === 0 && <Minus className="h-3 w-3 text-muted" />}
                <span className="w-16 text-right font-bold">{row.points} pts</span>
              </div>
            ))}
          </Card>

          {/* Mi desglose */}
          {(breakdown?.length ?? 0) > 0 && (
            <Card>
              <h2 className="mb-3 font-semibold">Mis puntos este periodo</h2>
              <div className="space-y-2">
                {breakdown?.map((b) => (
                  <div key={b.type} className="flex justify-between text-sm">
                    <span className="text-muted">
                      {POINT_LABELS[b.type] ?? b.type} × {b.count}
                    </span>
                    <span className="font-medium text-accent">+{b.points}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
