"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { createPortal } from "react-dom";
import { BellRing, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Estado global del temporizador de descanso.
 *
 * - Vive en el layout de la app, así que sobrevive al cambio de pestaña o de
 *   página: la cuenta atrás se deriva de una marca de tiempo objetivo y además
 *   se guarda en localStorage, por lo que también aguanta una recarga.
 * - Mientras corre se muestra un banner flotante común a todas las pestañas
 *   (salvo si en pantalla ya hay un temporizador completo montado).
 * - Al llegar a 0 vibra con fuerza y suena una alarma real (<audio>). El pitido
 *   sintetizado con Web Audio se mantiene como respaldo porque se programa en
 *   el reloj del AudioContext y suena a su hora aunque el navegador congele los
 *   temporizadores en segundo plano.
 */

const STORAGE_KEY = "gymbros-rest-timer";
const PREFS_KEY = "gymbros-rest-timer-prefs";
/** Duración del archivo de alarma; ver public/timer-alarm.wav. */
const ALARM_MS = 6000;

/**
 * Declara qué clase de sonido vamos a emitir, para no cargarnos la música que
 * el usuario tenga puesta mientras entrena.
 *
 * - "transient-solo": alarma corta. El sistema pausa lo que estuviera sonando y
 *   lo REANUDA solo al terminar. Es lo que queremos.
 * - "ambient": se mezcla sin interrumpir nada. Se usa en reposo y para el
 *   desbloqueo silencioso del <audio>, que si no roba el foco al arrancar.
 *
 * Antes se usaba "playback", que marca el sonido como reproducción principal:
 * el sistema le quita el foco a Spotify y ya no vuelve, que era justo el
 * problema. Ojo: en iOS los tipos transitorios respetan el interruptor de
 * silencio, así que con el móvil en silencio la alarma no sonará (sí vibra).
 */
function setAudioSession(type: "ambient" | "transient-solo") {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = type;
  } catch {
    /* API no soportada: el navegador decide por su cuenta */
  }
}

type RestTimerContextValue = {
  running: boolean;
  ringing: boolean;
  remaining: number;
  totalMs: number;
  progress: number;
  soundOn: boolean;
  keepAwake: boolean;
  setSoundOn: (v: boolean) => void;
  setKeepAwake: (v: boolean) => void;
  start: (minutes: number) => void;
  stop: () => void;
  dismiss: () => void;
  /** Lo usa <RestTimer> para que el banner flotante no se duplique. */
  registerInline: () => () => void;
};

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function useRestTimer() {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error("useRestTimer debe usarse dentro de <RestTimerProvider>");
  return ctx;
}

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  const [targetAt, setTargetAt] = useState<number | null>(null);
  const [totalMs, setTotalMs] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [ringing, setRinging] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [keepAwake, setKeepAwake] = useState(false);
  const [inlineCount, setInlineCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scheduledOscRef = useRef<OscillatorNode | null>(null);
  const alarmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedForRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  // ---------- Persistencia ----------

  useEffect(() => {
    setMounted(true);
    try {
      const rawPrefs = localStorage.getItem(PREFS_KEY);
      if (rawPrefs) {
        const prefs = JSON.parse(rawPrefs) as { soundOn?: boolean; keepAwake?: boolean };
        if (typeof prefs.soundOn === "boolean") setSoundOn(prefs.soundOn);
        if (typeof prefs.keepAwake === "boolean") setKeepAwake(prefs.keepAwake);
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { targetAt: number; totalMs: number };
        // Si ya venció mientras la app estaba cerrada, no se resucita la alarma
        if (saved.targetAt > Date.now()) {
          firedForRef.current = null;
          setTotalMs(saved.totalMs);
          setRemaining(saved.targetAt - Date.now());
          setTargetAt(saved.targetAt);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ soundOn, keepAwake }));
    } catch {
      /* almacenamiento lleno */
    }
  }, [soundOn, keepAwake, mounted]);

  // ---------- Pantalla encendida ----------

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as Navigator & {
          wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> };
        }).wakeLock.request("screen");
      }
    } catch {
      /* el navegador puede rechazarlo; no es crítico */
    }
  }, []);

  // ---------- Alarma ----------

  /** Silencia la alarma en curso (audio real + pitido programado). */
  const silence = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (scheduledOscRef.current) {
      try {
        scheduledOscRef.current.stop();
      } catch {
        /* ya detenido */
      }
      scheduledOscRef.current = null;
    }
    if (alarmTimeoutRef.current) {
      clearTimeout(alarmTimeoutRef.current);
      alarmTimeoutRef.current = null;
    }
    try {
      navigator.vibrate?.(0);
    } catch {
      /* sin vibración */
    }
    // Devolver el foco cuanto antes: así la música que se pausó se reanuda sola
    setAudioSession("ambient");
  }, []);

  /** Programa el pitido de respaldo en el reloj del AudioContext. */
  const scheduleBackupBeep = useCallback((seconds: number) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const at = ctx.currentTime + seconds;
      osc.frequency.setValueAtTime(1318.5, at);
      gain.gain.setValueAtTime(0.0001, at);
      for (let i = 0; i < 5; i++) {
        const t = at + i * 0.62;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      }
      osc.start(at);
      osc.stop(at + 3.2);
      scheduledOscRef.current = osc;
    } catch {
      /* sin audio disponible */
    }
  }, []);

  const fireAlarm = useCallback(() => {
    setRinging(true);
    releaseWakeLock();

    // Vibración larga y persistente (bastante más insistente que un doble toque)
    try {
      navigator.vibrate?.([
        600, 180, 600, 180, 600, 180, 900, 300, 600, 180, 600, 180, 600, 180, 1200,
      ]);
    } catch {
      /* sin vibración */
    }

    if (!soundOnRef.current) return;

    // Alarma corta: se pide el foco en modo transitorio, de forma que la música
    // se pause y vuelva sola. Tampoco se declara metadata de Media Session: al
    // hacerlo nos convertíamos en el reproductor activo del sistema y el otro
    // reproductor perdía sus controles para siempre.
    setAudioSession("transient-solo");
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 1;
      void audio.play().catch(() => undefined);
    }
  }, [releaseWakeLock]);

  // ---------- Cuenta atrás ----------

  useEffect(() => {
    if (targetAt === null) return;

    const check = () => {
      const left = Math.max(0, targetAt - Date.now());
      setRemaining(left);
      if (left <= 0 && firedForRef.current !== targetAt) {
        firedForRef.current = targetAt;
        setTargetAt(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* almacenamiento no disponible */
        }
        fireAlarm();
        return true;
      }
      return left <= 0;
    };

    let raf = 0;
    const tick = () => {
      if (check()) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // requestAnimationFrame se congela con la pestaña oculta: este temporizador
    // y el evento de visibilidad garantizan que la alarma acabe disparándose.
    const timeout = setTimeout(check, Math.max(0, targetAt - Date.now()));
    const onVisible = () => check();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [targetAt, fireAlarm]);

  // La alarma se apaga sola cuando termina el archivo de sonido
  useEffect(() => {
    if (!ringing) return;
    const t = setTimeout(() => {
      silence();
      setRinging(false);
    }, ALARM_MS);
    return () => clearTimeout(t);
  }, [ringing, silence]);

  useEffect(() => () => releaseWakeLock(), [releaseWakeLock]);

  // ---------- Acciones ----------

  const start = useCallback(
    (minutes: number) => {
      silence();
      setRinging(false);
      const ms = Math.round(minutes * 60 * 1000);
      const next = Date.now() + ms;
      firedForRef.current = null;
      setTotalMs(ms);
      setRemaining(ms);
      setTargetAt(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ targetAt: next, totalMs: ms }));
      } catch {
        /* almacenamiento lleno */
      }

      // Desbloqueo del <audio> aprovechando el gesto del usuario: sin esta
      // reproducción silenciosa, el navegador bloquearía el play() automático.
      // En modo "ambient" para que este play() mudo no corte la música.
      setAudioSession("ambient");
      const audio = audioRef.current;
      if (audio) {
        audio.volume = 0;
        void audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1;
          })
          .catch(() => undefined);
      }
      if (soundOnRef.current) scheduleBackupBeep(ms / 1000);
      if (keepAwake) void requestWakeLock();
    },
    [keepAwake, requestWakeLock, scheduleBackupBeep, silence],
  );

  const stop = useCallback(() => {
    silence();
    setRinging(false);
    setTargetAt(null);
    setRemaining(0);
    releaseWakeLock();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [releaseWakeLock, silence]);

  const dismiss = useCallback(() => {
    silence();
    setRinging(false);
  }, [silence]);

  const registerInline = useCallback(() => {
    setInlineCount((n) => n + 1);
    return () => setInlineCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo<RestTimerContextValue>(
    () => ({
      running: targetAt !== null,
      ringing,
      remaining,
      totalMs,
      progress: totalMs > 0 ? Math.min(1, Math.max(0, remaining / totalMs)) : 0,
      soundOn,
      keepAwake,
      setSoundOn,
      setKeepAwake,
      start,
      stop,
      dismiss,
      registerInline,
    }),
    [targetAt, ringing, remaining, totalMs, soundOn, keepAwake, start, stop, dismiss, registerInline],
  );

  return (
    <RestTimerContext.Provider value={value}>
      {children}
      {/* preload="auto" para que el archivo esté en caché cuando toque sonar */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src="/timer-alarm.wav" preload="auto" playsInline />
      {mounted && inlineCount === 0 && (targetAt !== null || ringing) && <FloatingTimerBanner />}
    </RestTimerContext.Provider>
  );
}

/** Banner flotante común a todas las pestañas mientras el descanso corre. */
function FloatingTimerBanner() {
  const { remaining, progress, ringing, stop, dismiss } = useRestTimer();
  const secs = Math.ceil(remaining / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const R = 15;
  const CIRC = 2 * Math.PI * R;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6 md:left-60 md:justify-end md:px-8">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-lg backdrop-blur-xl transition",
          ringing
            ? "animate-pulse border-red-500/60 bg-red-500/20"
            : "border-border bg-surface/90",
        )}
      >
        {ringing ? (
          <>
            <BellRing className="h-5 w-5 shrink-0 text-red-400" />
            <span className="text-sm font-semibold">¡Descanso terminado!</span>
            <button
              onClick={dismiss}
              className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/30"
            >
              Vale
            </button>
          </>
        ) : (
          <>
            <span className="relative h-9 w-9 shrink-0">
              <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                <circle cx="18" cy="18" r={R} fill="none" stroke="hsl(var(--surface-2))" strokeWidth="4" />
                <circle
                  cx="18" cy="18" r={R} fill="none"
                  stroke={secs <= 5 ? "#ef4444" : "hsl(var(--accent))"}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - progress)}
                />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-xs text-muted">Descansando…</p>
              <p className={cn("text-sm font-bold tabular-nums", secs <= 5 && "text-red-400")}>
                {mm}:{String(ss).padStart(2, "0")}
              </p>
            </div>
            <button
              onClick={stop}
              aria-label="Cancelar descanso"
              className="rounded-lg p-1.5 text-muted transition hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
