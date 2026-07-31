"use client";

import { Flame, Lock, Check, Gem } from "lucide-react";
import { cn } from "@/lib/utils";

type Rule = { type: string; points: number; enabled: boolean };

const STAGES: Array<{ type: string; weeks: number; label: string }> = [
  { type: "STREAK_WEEK1", weeks: 1, label: "1 sem" },
  { type: "STREAK_WEEK2", weeks: 2, label: "2 sem" },
  { type: "STREAK_WEEK3", weeks: 3, label: "3 sem" },
  { type: "STREAK_MONTH", weeks: 4, label: "1 mes" },
];

/** Progreso de racha por etapas, con estética de videojuego. */
export function StreakProgress({ streak, rules }: { streak: number; rules: Rule[] }) {
  const pointsOf = (type: string) => rules.find((r) => r.type === type)?.points ?? 0;
  const crackPoints = pointsOf("STREAK_CRACK");
  const isCrack = streak >= 5;
  const pct = Math.min(100, (Math.min(streak, 4) / 4) * 100);
  const nextStage = STAGES.find((s) => s.weeks > streak);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-orange-500/40 bg-[#0d0805] p-4">
      {/* Resplandor y rejilla */}
      <div
        className="pointer-events-none absolute -left-10 -top-14 h-40 w-40 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(249,115,22,0.35), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(249,115,22,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,.6) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative flex flex-1 flex-col gap-3.5">
        {/* Cabecera */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center bg-gradient-to-br shadow-[0_0_16px_-2px_rgba(249,115,22,0.8)]",
                isCrack ? "from-violet-300 to-violet-600" : "from-orange-300 to-orange-600",
              )}
              style={{ clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }}
            >
              {isCrack ? <Gem className="h-5 w-5 text-[#1a0a2a]" /> : <Flame className="h-5 w-5 text-[#2a1200]" />}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange-400">
                {isCrack ? "Nivel crack" : "Racha semanal"}
              </p>
              <p className="text-lg font-extrabold leading-tight text-orange-100">
                {streak} {streak === 1 ? "semana" : "semanas"}
              </p>
            </div>
          </div>
          {isCrack && (
            <span className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-300">
              +{crackPoints}/sem 💎
            </span>
          )}
        </div>

        {/* Barra de progreso estilo XP con hitos */}
        <div className="relative h-3 overflow-hidden rounded-full border border-orange-400/20 bg-black/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-amber-300 shadow-[0_0_12px_rgba(249,115,22,0.7)] transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
          <div className="absolute inset-0 flex justify-between px-[25%]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-px bg-black/50" />
            ))}
          </div>
        </div>

        {/* Etapas */}
        <div className="grid grid-cols-4 gap-1.5">
          {STAGES.map((s) => {
            const done = streak >= s.weeks;
            const next = !done && nextStage?.type === s.type;
            return (
              <div
                key={s.type}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 transition",
                  done && "border-orange-400/50 bg-gradient-to-b from-orange-500/20 to-transparent",
                  next && "border-amber-300/60 bg-amber-400/10 shadow-[0_0_14px_-4px_rgba(251,191,36,0.8)]",
                  !done && !next && "border-white/5 bg-black/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                    done ? "bg-orange-500 text-black" : next ? "bg-amber-400/20 text-amber-300" : "bg-white/5 text-muted",
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : next ? "→" : <Lock className="h-2.5 w-2.5" />}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    done ? "text-orange-100" : next ? "text-amber-100" : "text-fg/60",
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    "text-sm font-black",
                    done ? "text-orange-300" : next ? "text-amber-300" : "text-fg/50",
                  )}
                >
                  +{pointsOf(s.type)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Pie */}
        <p className="mt-auto text-xs text-orange-100/75">
          {isCrack ? (
            <>Cada semana extra suma +{crackPoints} pts. ¡No la rompas! 🔥</>
          ) : streak >= 4 ? (
            <>¡Mes completado! La próxima semana entras en nivel crack: +{crackPoints} pts 💎</>
          ) : (
            <>Cumple tus días esta semana para llegar a {nextStage?.label} y sumar +{pointsOf(nextStage?.type ?? "")} pts.</>
          )}
        </p>
      </div>
    </div>
  );
}
