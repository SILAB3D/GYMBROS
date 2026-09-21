"use client";

import { useEffect } from "react";
import { Timer, X, Volume2, VolumeX, BellRing, Sun, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRestTimer } from "@/components/rest-timer-provider";

/**
 * Temporizador de descanso (versión completa, dentro del entreno activo).
 * Todo el estado vive en <RestTimerProvider>, así que cambiar de pestaña o de
 * página no lo reinicia. Mientras este componente esté en pantalla, el banner
 * flotante se oculta para no duplicar la información.
 */

/** Descansos habituales, en minutos. Se pulsan a ciegas entre serie y serie. */
const PRESETS = [1, 2, 3] as const;

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
  const ending = secs <= 5;

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
    // Mientras corre, la tarjeta se tiñe de acento (y de rojo en los últimos
    // segundos): de un vistazo, sin leer nada, ya se sabe en qué punto está.
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-surface transition-colors",
        !running && "border-border",
        running && !ending && "border-accent/50 shadow-[0_0_28px_-12px_hsl(var(--accent))]",
        running && ending && "border-red-500/60 shadow-[0_0_28px_-12px_#ef4444]",
      )}
    >
      {/* Cabecera común: así el cartel no cambia de forma al arrancar */}
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
        <Timer className={cn("h-4 w-4 shrink-0", running ? "text-accent" : "text-muted")} />
        <span className="text-sm font-semibold">Descanso</span>
        <span className="truncate text-xs text-muted">
          {running ? "entre series" : "elige cuánto paras"}
        </span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setSoundOn(!soundOn)}
            title={soundOn ? "Silenciar el aviso" : "Avisar con sonido"}
            aria-label={soundOn ? "Silenciar el aviso" : "Avisar con sonido"}
            aria-pressed={soundOn}
            className={cn(
              "rounded-lg p-1.5 transition",
              soundOn ? "bg-accent/15 text-accent" : "text-muted hover:text-fg",
            )}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setKeepAwake(!keepAwake)}
            title={
              keepAwake
                ? "Dejar que la pantalla se apague"
                : "Mantener la pantalla encendida durante el descanso"
            }
            aria-label="Mantener la pantalla encendida durante el descanso"
            aria-pressed={keepAwake}
            className={cn(
              "rounded-lg p-1.5 transition",
              keepAwake ? "bg-accent/15 text-accent" : "text-muted hover:text-fg",
            )}
          >
            <Sun className="h-4 w-4" />
          </button>
        </div>
      </div>

      {running ? (
        <div className="flex items-center gap-4 p-3">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r={R} fill="none" stroke="hsl(var(--surface-2))" strokeWidth="6" />
              {/* Sin transición CSS: el valor ya se actualiza en cada frame. Con
                  una transición, los descansos largos avanzaban tan poco por
                  frame que el anillo parecía congelado. */}
              <circle
                cx="40" cy="40" r={R} fill="none"
                stroke={ending ? "#ef4444" : "hsl(var(--accent))"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress)}
              />
            </svg>
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums",
                ending ? "text-red-400" : "text-fg",
              )}
            >
              {mm}:{String(ss).padStart(2, "0")}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs text-muted">
              {keepAwake ? "Pantalla activa · " : ""}
              {soundOn ? "te avisará al terminar 🔔" : "sin sonido"}
            </p>
            {/* Alargar el descanso sin volver a empezar de cero */}
            <button
              onClick={() => start((remaining + 30_000) / 60_000)}
              className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-accent/20"
            >
              <Plus className="h-3.5 w-3.5" /> 30 s
            </button>
          </div>

          <button
            onClick={stop}
            className="rounded-xl p-2 text-muted transition hover:text-fg"
            aria-label="Cancelar el descanso"
            title="Cancelar el descanso"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 p-3">
          {PRESETS.map((minutes) => (
            <button
              key={minutes}
              onClick={() => start(minutes)}
              className="rounded-xl bg-surface-2 py-2.5 text-center text-sm font-semibold tabular-nums transition hover:bg-accent/20 active:scale-95"
            >
              {minutes} min
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
