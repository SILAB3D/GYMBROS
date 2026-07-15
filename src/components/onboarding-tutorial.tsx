"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { useTutorialLaunch } from "@/lib/use-tutorial-launch";

const STEPS: Array<{ icon: React.ReactNode; title: string; text: string }> = [
  {
    icon: <Logo size={64} className="mx-auto" />,
    title: "¡Bienvenido a GymBros!",
    text: "La app privada del grupo: registra tus entrenos, mantén la racha y compite con tus amigos.",
  },
  {
    icon: <span className="text-5xl">📋</span>,
    title: "Crea tus rutinas",
    text: "Ejercicios, series y repeticiones. Indica cuántas veces por semana harás cada rutina. Tus pesos son siempre privados.",
  },
  {
    icon: <span className="text-5xl">🗓️</span>,
    title: "Tu plan se monta solo",
    text: "Con las veces por semana de cada rutina se genera tu plan; tú solo lo ordenas. El panel te dice siempre qué toca hoy.",
  },
  {
    icon: <span className="text-5xl">🏋️</span>,
    title: "Registra tus entrenos",
    text: "Pulsa el botón verde del panel, elige la rutina y marca series y pesos (vienen precargados de tu última sesión). Al terminar, la asistencia y los PRs se registran solos.",
  },
  {
    icon: <span className="text-5xl">🔥</span>,
    title: "Rachas y ranking",
    text: "Cumple tus días planificados cada semana para mantener la racha y ganar puntos crecientes. Compite en el ranking semanal, mensual y por temporadas.",
  },
  {
    icon: <span className="text-5xl">💬</span>,
    title: "Comunidad",
    text: "Chatea con el grupo, mira sus perfiles y rutinas, y activa las notificaciones del dispositivo en Ajustes para no perderte nada.",
  },
];

/** Tutorial de primera vez. Solo reaparece si se lanza desde Ajustes. */
export function OnboardingTutorial() {
  const utils = api.useUtils();
  const { data: me } = api.user.me.useQuery();
  const [forced, setForced] = useTutorialLaunch();
  const [step, setStep] = useState(0);

  const complete = api.user.completeOnboarding.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  });

  const open = forced || (me ? !me.onboardingDone : false);
  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;

  function finish() {
    if (me && !me.onboardingDone) complete.mutate();
    setForced(false);
    setStep(0);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full flex-col gap-5 overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl sm:pb-6 md:max-w-md">
        <button
          onClick={finish}
          className="self-end text-xs text-muted transition hover:text-fg"
        >
          Saltar tutorial
        </button>

        <div className="space-y-3 text-center">
          <div>{current.icon}</div>
          <h2 className="text-xl font-bold">{current.title}</h2>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted sm:max-w-none">{current.text}</p>
        </div>

        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Paso ${i + 1}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-5 bg-accent" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <Button size="lg" variant="secondary" onClick={() => setStep((s) => s - 1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1"
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
          >
            {isLast ? "¡A entrenar! 💪" : "Siguiente"}
          </Button>
        </div>
      </div>
    </div>
  );
}
