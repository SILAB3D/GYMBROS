"use client";

import { useEffect } from "react";
import { Timer, X, Volume2, VolumeX, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRestTimer } from "@/components/rest-timer-provider";

/**
 * Temporizador de descanso (versión completa, dentro del entreno activo).
 * Todo el estado vive en <RestTimerProvider>, así que cambiar de pestaña o de
 * página no lo reinicia. Mientras este componente esté en pantalla, el banner
 * flotante se oculta para no duplicar la información.
 */
export function RestTimer() {
  const {
    running, ringing, remaining, progress, soundOn, keepAwake,
    setSoundOn, setKeepAwake, start, stop, dismiss, registerInline,
  } = useRestTimer();

  useEffect(() => registerInline(), [registerInline]);

  const secs = Math.ceil(remaining / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const R = 34;
  const CIRC = 2 * Math.PI * R;

  if (ringing) {
    return (
      <div className="flex animate-pulse items-center gap-4 rounded-2xl border border-red-500/60 bg-red-500/15 p-3">
        <BellRing className="h-8 w-8 shrink-0 text-red-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold">¡Descanso terminado!</p>
          <p className="text-xs text-muted">A por la siguiente serie 💪</p>
        </div>
        <button
          onClick={dismiss}
          className="rounded-xl bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/30"
        >
          Vale
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      {running ? (
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r={R} fill="none" stroke="hsl(var(--surface-2))" strokeWidth="6" />
              {/* Sin transición CSS: el valor ya se actualiza en cada frame. Con
                  una transición, los descansos largos avanzaban tan poco por
                  frame que el anillo parecía congelado. */}
              <circle
                cx="40" cy="40" r={R} fill="none"
                stroke={secs <= 5 ? "#ef4444" : "hsl(var(--accent))"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress)}
              />
            </svg>
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums",
                secs <= 5 ? "text-red-400" : "text-fg",
              )}
            >
              {mm}:{String(ss).padStart(2, "0")}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Descansando…</p>
            <p className="text-xs text-muted">
              {keepAwake ? "Pantalla activa · " : ""}
              {soundOn ? "te avisará al terminar 🔔" : "sin sonido"}
            </p>
          </div>
          <button onClick={stop} className="rounded-xl p-2 text-muted transition hover:text-fg" aria-label="Cancelar">
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Timer className="ml-1 h-4 w-4 shrink-0 text-muted" />
            <span className="text-sm text-muted">Descanso</span>
            <div className="ml-auto flex gap-1">
              <button
                onClick={() => setSoundOn(!soundOn)}
                title={soundOn ? "Silenciar" : "Activar sonido"}
                className={cn("rounded-lg p-1.5 transition", soundOn ? "text-accent" : "text-muted hover:text-fg")}
              >
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((m) => (
              <button
                key={m}
                onClick={() => start(m)}
                className="flex-1 rounded-xl bg-surface-2 py-2.5 text-sm font-semibold transition hover:bg-accent/20"
              >
                {m} min
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={keepAwake}
              onChange={(e) => setKeepAwake(e.target.checked)}
              className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
            />
            Mantener la pantalla encendida durante el descanso
          </label>
        </div>
      )}
    </div>
  );
}
