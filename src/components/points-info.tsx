"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { api } from "@/trpc/react";
import { Modal, Spinner } from "@/components/ui";

/** Etapas de la racha, en el orden en que se van alcanzando. */
const STREAK_STEPS: Array<{ type: string; label: string }> = [
  { type: "STREAK_WEEK1", label: "1.ª semana cumplida" },
  { type: "STREAK_WEEK2", label: "2 semanas seguidas" },
  { type: "STREAK_WEEK3", label: "3 semanas seguidas" },
  { type: "STREAK_MONTH", label: "1 mes seguido" },
  { type: "STREAK_CRACK", label: "Cada semana extra tras el mes 💎" },
];

/**
 * Botón ⓘ del cartel de puntos: abre el esquema del sistema de puntos con los
 * valores reales de las reglas (el admin puede cambiarlos o desactivarlas, y
 * aquí solo aparecen las activas).
 */
export function PointsInfo() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = api.dashboard.pointRules.useQuery(undefined, { enabled: open });
  const value = (type: string) => data?.rules.find((r) => r.type === type)?.points;

  const perSet = value("WORKOUT_COMPLETED");
  const pr = value("NEW_PR");
  const streak = STREAK_STEPS.map((s) => ({ ...s, points: value(s.type) })).filter((s) => s.points);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cómo se consiguen los puntos"
        title="Cómo se consiguen los puntos"
        className="text-muted transition hover:text-fg"
      >
        <Info className="h-4 w-4" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Sistema de puntos" subtitle="Así se suman puntos para el ranking">
        {isLoading || !data ? (
          <Spinner />
        ) : (
          <div className="space-y-5 text-sm">
            {perSet !== undefined && (
              <section className="space-y-1.5">
                <h3 className="font-semibold">🏋️ Entrenamiento completado</h3>
                <Row label="Por cada serie realizada" points={`+${perSet}`} />
                <Row label="Por el simple hecho de entrenar" points={`+${data.workoutBonus}`} />
              </section>
            )}

            {pr !== undefined && (
              <section className="space-y-1.5">
                <h3 className="font-semibold">🏆 Récords personales</h3>
                <Row label="Nuevo PR" points={`+${pr}`} />
                <p className="text-xs text-muted">
                  Se detectan solos al terminar. La primera vez que haces un ejercicio se guarda como
                  marca inicial, sin puntos.
                </p>
              </section>
            )}

            {streak.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="font-semibold">🔥 Racha semanal</h3>
                {streak.map((s) => (
                  <Row key={s.type} label={s.label} points={`+${s.points}`} />
                ))}
                <p className="text-xs text-muted">
                  Una semana se cumple al llegar a tus días de entreno objetivo. Si fallas una, la racha
                  vuelve a empezar.
                </p>
              </section>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function Row({ label, points }: { label: string; points: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold text-accent">{points}</span>
    </div>
  );
}
