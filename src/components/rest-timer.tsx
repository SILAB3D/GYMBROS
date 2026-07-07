"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* sin audio */
  }
  navigator.vibrate?.([200, 100, 200]);
}

/** Temporizador manual de descanso entre series: 1, 2 o 3 minutos. */
export function RestTimer() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const interval = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => () => clearInterval(interval.current), []);

  function start(minutes: number) {
    clearInterval(interval.current);
    setSecondsLeft(minutes * 60);
    interval.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          clearInterval(interval.current);
          beep();
          return null;
        }
        return s - 1;
      });
    }, 1000);
  }

  function stop() {
    clearInterval(interval.current);
    setSecondsLeft(null);
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2">
      <Timer className="ml-1 h-4 w-4 shrink-0 text-muted" />
      {secondsLeft === null ? (
        <>
          <span className="text-sm text-muted">Descanso:</span>
          {[1, 2, 3].map((m) => (
            <button
              key={m}
              onClick={() => start(m)}
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-medium transition hover:bg-accent/20"
            >
              {m} min
            </button>
          ))}
        </>
      ) : (
        <>
          <span
            className={cn(
              "flex-1 text-center text-2xl font-bold tabular-nums",
              secondsLeft <= 10 ? "text-red-400" : "text-accent",
            )}
          >
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
          </span>
          <button onClick={stop} className="rounded-lg p-2 text-muted hover:text-fg" aria-label="Cancelar">
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
