"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GymLoader } from "@/components/gym-loader";

type Phase = "idle" | "leaving" | "loading" | "entering";

/**
 * Transición encadenada al cambiar de pantalla:
 *   contenido actual → se desvanece → cargador → se desvanece → nueva pantalla.
 * El cargador solo aparece si la ruta tarda; si va rápida, se encadenan los fundidos.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("entering");
  const first = useRef(true);

  useEffect(() => {
    // La primera carga no necesita fundido de salida
    if (first.current) {
      first.current = false;
      const t = setTimeout(() => setPhase("idle"), 320);
      return () => clearTimeout(t);
    }

    // 1) El contenido anterior se desvanece
    setPhase("leaving");
    // 2) Aparece el cargador (con su propio fundido de entrada)
    const toLoading = setTimeout(() => setPhase("loading"), 180);
    // 3) El cargador se desvanece y entra la nueva pantalla
    const toEntering = setTimeout(() => setPhase("entering"), 460);
    const toIdle = setTimeout(() => setPhase("idle"), 800);

    return () => {
      clearTimeout(toLoading);
      clearTimeout(toEntering);
      clearTimeout(toIdle);
    };
  }, [pathname]);

  const showLoader = phase === "loading";
  const contentVisible = phase === "idle" || phase === "entering";

  return (
    <div className="relative">
      {/* Cargador fijo en el centro: se desvanece antes de mostrar el contenido */}
      {phase !== "idle" && <GymLoader visible={showLoader} />}

      {/* Contenido: se desvanece al salir y entra suavemente */}
      <div
        className="transition-all duration-300 ease-out"
        style={{
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? "translateY(0)" : "translateY(8px)",
          pointerEvents: contentVisible ? undefined : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
