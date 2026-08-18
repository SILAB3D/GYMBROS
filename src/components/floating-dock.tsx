"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ActiveWorkoutButton } from "@/components/active-workout-button";
import { FloatingTimerBanner, useRestTimer } from "@/components/rest-timer-provider";

/**
 * Columna donde viven los avisos flotantes del entrenamiento.
 *
 * Antes cada uno se colocaba por su cuenta —el temporizador centrado, el aviso
 * de entreno en curso a la izquierda— y al cambiar de pestaña, con los dos
 * activos a la vez, se solapaban. Ahora comparten una única pila: se apilan de
 * abajo arriba y siempre queda claro qué es cada cosa.
 *
 * El contenedor no intercepta el ratón (`pointer-events-none`); cada tarjeta lo
 * recupera por su cuenta.
 */
export function FloatingDock() {
  const { floatingVisible } = useRestTimer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-start gap-2 px-4 md:bottom-6 md:left-60 md:px-8">
      {floatingVisible && <FloatingTimerBanner />}
      <ActiveWorkoutButton />
    </div>,
    document.body,
  );
}
