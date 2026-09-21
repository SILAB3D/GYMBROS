"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ActiveWorkoutButton } from "@/components/active-workout-button";
import { FloatingTimerBanner, useRestTimer } from "@/components/rest-timer-provider";

/**
 * Avisos flotantes del entrenamiento.
 *
 * El aviso de "entreno en curso" vive arriba y centrado, justo por debajo de la
 * cabecera fija: es un acceso, no una alerta, y desde ahí no tapa los botones
 * de acción ni se pelea con el temporizador. El temporizador de descanso sigue
 * abajo, donde está la mano.
 *
 * Ninguno de los dos carriles intercepta el ratón (`pointer-events-none`); cada
 * tarjeta lo recupera por su cuenta.
 */
export function FloatingDock() {
  const { floatingVisible } = useRestTimer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Carril superior: por debajo de la cabecera del móvil, sin invadirla */}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-40 flex justify-center px-4 md:top-4 md:left-60 md:px-8">
        <ActiveWorkoutButton />
      </div>

      {/* Carril inferior: temporizador de descanso */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-start gap-2 px-4 md:bottom-6 md:left-60 md:px-8">
        {floatingVisible && <FloatingTimerBanner />}
      </div>
    </>,
    document.body,
  );
}
