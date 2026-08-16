"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Cargador de la app: el logo girando, SIEMPRE centrado en la pantalla.
 * Se renderiza mediante un portal en <body> para que ningún contenedor con
 * `transform` (que rompe el posicionamiento fixed) lo desplace.
 *
 * `delayMs` retrasa su aparición: si lo que se está esperando llega antes, el
 * cargador se desmonta sin haber llegado a verse y se evita el parpadeo.
 */
export function GymLoader({
  className,
  visible = true,
  delayMs = 0,
}: {
  className?: string;
  visible?: boolean;
  delayMs?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const content = (
    <div
      className={
        className ??
        "pointer-events-none fixed left-1/2 top-1/2 z-[45] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 ease-out"
      }
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
    >
      <div
        className="gb-enter relative flex items-center justify-center"
        style={delayMs > 0 ? { animationDelay: `${delayMs}ms` } : undefined}
      >
        {/* Halo */}
        <div className="absolute h-24 w-24 animate-pulse rounded-full bg-accent/15 blur-2xl" />

        {/* Logo girando */}
        <svg viewBox="0 0 512 512" className="gb-spin relative h-16 w-16">
          <rect width="512" height="512" rx="115" fill="#0a0a0b" />
          <circle cx="256" cy="256" r="170" fill="#16a34a" />
          <circle cx="256" cy="256" r="118" fill="#0a0a0b" />
          <circle cx="256" cy="256" r="96" fill="#22c55e" />
          <circle cx="256" cy="256" r="34" fill="#0a0a0b" />
        </svg>
      </div>

      <style jsx>{`
        .gb-enter {
          animation: gb-fade-in 0.25s ease-out both;
        }
        @keyframes gb-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .gb-spin {
          animation: gb-rotate 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        @keyframes gb-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // Solo se muestra a través del portal: si se renderizara en su sitio
  // (primer render/SSR), un ancestro con `transform` lo descolocaría.
  if (!mounted) return null;
  return createPortal(content, document.body);
}
