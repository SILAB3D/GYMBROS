"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GymLoader } from "@/components/gym-loader";

/**
 * Transición entre pantallas: mientras la nueva ruta prepara sus datos se
 * muestra un cargador centrado con motivos de gimnasio, y luego el contenido
 * entra con un fundido suave.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(false);
    // Un frame de margen: si la ruta ya está lista, el cargador apenas se ve
    const t = setTimeout(() => setShown(true), 90);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className="relative">
      {!shown && (
<GymLoader className="flex min-h-[50dvh] items-center justify-center" />
      )}
      <div
        className="transition-all duration-300 ease-out"
        style={{
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0)" : "translateY(10px)",
          display: shown ? undefined : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
