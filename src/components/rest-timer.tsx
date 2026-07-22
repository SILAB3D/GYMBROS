"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, X, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Temporizador de descanso.
 * - La cuenta atrás se calcula desde una marca de tiempo objetivo, así que es
 *   exacta aunque la pestaña quede en segundo plano o la pantalla se apague.
 * - El pitido se programa en el reloj del AudioContext (osc.start en el tiempo
 *   futuro), lo que permite que suene por los auriculares incluso con la app en
 *   segundo plano en muchos navegadores.
 * - Wake Lock opcional para mantener la pantalla encendida.
 */
export function RestTimer() {
  const [targetAt, setTargetAt] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [keepAwake, setKeepAwake] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const scheduledRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Bucle de refresco visual (rAF-lite): recalcula lo que queda desde el objetivo
  useEffect(() => {
    if (targetAt === null) return;
    let raf: number;
    const tick = () => {
      const left = Math.max(0, targetAt - Date.now());
      setRemaining(left);
      if (left <= 0) {
        setTargetAt(null);
        releaseWakeLock();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetAt]);

  useEffect(() => () => releaseWakeLock(), []);

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as Navigator & {
          wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> };
        }).wakeLock.request("screen");
      }
    } catch {
      /* el navegador puede rechazarlo; no es crítico */
    }
  }
  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }

  function scheduleBeep(seconds: number) {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const at = ctx.currentTime + seconds;
      // Triple pitido al terminar
      osc.frequency.setValueAtTime(880, at);
      gain.gain.setValueAtTime(0, at);
      for (let i = 0; i < 3; i++) {
        const t = at + i * 0.22;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      }
      osc.start(at);
      osc.stop(at + 0.7);
      scheduledRef.current = { osc, gain };
    } catch {
      /* sin audio disponible */
    }
  }

  function start(minutes: number) {
    cancelBeep();
    const ms = minutes * 60 * 1000;
    setTotalMs(ms);
    setRemaining(ms);
    setTargetAt(Date.now() + ms);
    scheduleBeep(minutes * 60);
    if (keepAwake) void requestWakeLock();
  }

  function cancelBeep() {
    if (scheduledRef.current) {
      try {
        scheduledRef.current.osc.stop();
      } catch {
        /* ya detenido */
      }
      scheduledRef.current = null;
    }
  }

  function stop() {
    cancelBeep();
    setTargetAt(null);
    releaseWakeLock();
  }

  const running = targetAt !== null;
  const secs = Math.ceil(remaining / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const progress = totalMs > 0 ? remaining / totalMs : 0;
  const R = 34;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      {running ? (
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r={R} fill="none" stroke="hsl(var(--surface-2))" strokeWidth="6" />
              <circle
                cx="40" cy="40" r={R} fill="none"
                stroke={secs <= 5 ? "#ef4444" : "hsl(var(--accent))"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress)}
                style={{ transition: "stroke-dashoffset 0.25s linear" }}
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
              {keepAwake ? "Pantalla activa · " : ""}{soundOn ? "sonará al terminar 🔔" : "sin sonido"}
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
                onClick={() => setSoundOn((v) => !v)}
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
