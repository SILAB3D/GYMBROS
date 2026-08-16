"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Pantalla de bienvenida animada al abrir la app en el NAVEGADOR, una vez por
 * sesión. Con la app instalada no interviene: allí la anima <BootSplash>, que
 * viaja en el HTML inicial y por tanto releva de inmediato a la pantalla de
 * carga del sistema, sin esperar a que cargue React.
 */
export function AppSplash() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const alreadySeen = sessionStorage.getItem("gymbros-splash") === "1";
    if (standalone || alreadySeen) return;

    sessionStorage.setItem("gymbros-splash", "1");
    setShow(true);
    const out = setTimeout(() => setLeaving(true), 1400);
    const done = setTimeout(() => setShow(false), 1900);
    return () => {
      clearTimeout(out);
      clearTimeout(done);
    };
  }, []);

  if (!mounted || !show) return null;

  return createPortal(
    <div
      className={`gb-splash fixed inset-0 z-[90] flex flex-col items-center justify-center bg-bg ${leaving ? "gb-out" : ""}`}
    >
      {/* Halo de fondo */}
      <div className="gb-halo absolute h-72 w-72 rounded-full bg-accent/20 blur-[70px]" />

      {/* Logo */}
      <div className="gb-logo relative">
        <svg viewBox="0 0 512 512" className="h-28 w-28 drop-shadow-[0_0_28px_rgba(34,197,94,0.45)]">
          <rect width="512" height="512" rx="115" fill="#0a0a0b" />
          <circle cx="256" cy="256" r="170" fill="#16a34a" />
          <circle cx="256" cy="256" r="118" fill="#0a0a0b" />
          <circle cx="256" cy="256" r="96" fill="#22c55e" />
          <circle cx="256" cy="256" r="34" fill="#0a0a0b" />
        </svg>
      </div>

      {/* Nombre */}
      <p className="gb-name relative mt-6 text-3xl font-extrabold tracking-tight">
        Gym<span className="text-accent">Bros</span>
      </p>
      <p className="gb-tagline relative mt-1 text-sm text-muted">Entrena. Compite. Progresa.</p>

      {/* Barra de progreso */}
      <div className="gb-bar relative mt-8 h-1 w-32 overflow-hidden rounded-full bg-white/10">
        <span className="gb-bar-fill block h-full w-full rounded-full bg-accent" />
      </div>

      <style jsx>{`
        .gb-splash {
          animation: gb-splash-in 0.2s ease-out both;
        }
        .gb-splash.gb-out {
          animation: gb-splash-out 0.5s ease-in forwards;
        }
        @keyframes gb-splash-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gb-splash-out {
          to { opacity: 0; transform: scale(1.04); }
        }
        .gb-logo {
          animation: gb-logo-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes gb-logo-in {
          0% { opacity: 0; transform: scale(0.4) rotate(-180deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .gb-halo {
          animation: gb-halo-pulse 2s ease-in-out infinite;
        }
        @keyframes gb-halo-pulse {
          0%, 100% { opacity: 0.5; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        .gb-name {
          animation: gb-rise 0.6s ease-out 0.35s both;
        }
        .gb-tagline {
          animation: gb-rise 0.6s ease-out 0.5s both;
        }
        .gb-bar {
          animation: gb-rise 0.6s ease-out 0.6s both;
        }
        @keyframes gb-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .gb-bar-fill {
          transform-origin: left;
          animation: gb-load 1.1s ease-in-out 0.6s both;
        }
        @keyframes gb-load {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
