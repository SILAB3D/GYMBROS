"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trophy, ChevronRight, Swords, Flame } from "lucide-react";

type Season = {
  index: number;
  started: boolean;
  daysLeft: number;
  from: Date;
  to: Date;
  myPoints: number;
  topPoints: number;
};

/** Panel de temporada con estética de videojuego. Lleva a Comunidad → Ranking. */
export function SeasonPanel({ season }: { season: Season }) {
  const pct = season.topPoints > 0 ? Math.min(100, (season.myPoints / season.topPoints) * 100) : 0;
  const started = season.started;

  return (
    <Link href="/comunidad?tab=ranking" className="group block h-full">
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gold/40 bg-[#0d0b06] p-4 transition-all duration-300 hover:border-gold/70 hover:shadow-[0_0_28px_-6px_rgba(251,191,36,0.45)]">
        {/* Fondo: resplandor y rejilla sutil */}
        <div
          className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(251,191,36,0.35), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(251,191,36,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,.6) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* Brillo que barre la tarjeta al pasar el cursor */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-gold/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

        <div className="relative flex flex-1 flex-col gap-3">
          {/* Cabecera */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {/* Emblema hexagonal */}
              <span
                className="flex h-11 w-11 items-center justify-center bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_16px_-2px_rgba(251,191,36,0.8)]"
                style={{ clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }}
              >
                {started ? (
                  <Swords className="h-5 w-5 text-[#2a1c00]" />
                ) : (
                  <Trophy className="h-5 w-5 text-[#2a1c00]" />
                )}
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-400">
                  {started ? "Temporada en curso" : "Próxima temporada"}
                </p>
                <p className="text-lg font-extrabold leading-tight text-amber-100">
                  {started ? `Temporada ${season.index}` : "Temporada 1"}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-amber-400/60 transition-transform group-hover:translate-x-0.5" />
          </div>

          {started ? (
            <>
              {/* Contadores */}
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2">
                  <p className="text-2xl font-black leading-none text-amber-300 [text-shadow:0_0_14px_rgba(251,191,36,0.5)]">
                    {season.daysLeft}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-amber-100/80">
                    días restantes
                  </p>
                </div>
                <div className="flex-1 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-right">
                  <p className="text-2xl font-black leading-none text-accent [text-shadow:0_0_14px_hsl(var(--accent)/0.5)]">
                    {season.myPoints}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-accent/90">
                    tus puntos
                  </p>
                </div>
              </div>

              {/* Barra de progreso estilo XP */}
              <div className="space-y-1">
                <div className="relative h-3 overflow-hidden rounded-full border border-amber-400/20 bg-black/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.7)] transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                  {/* Marcas de segmento */}
                  <div className="absolute inset-0 flex justify-between px-[12.5%]">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-px bg-black/40" />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-[11px] text-amber-100/75">
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3" /> {Math.round(pct)}% del líder
                  </span>
                  <span>Líder: {season.topPoints} pts</span>
                </div>
              </div>

              <p className="text-xs text-amber-100/70">
                Termina el {format(season.to, "d 'de' MMMM", { locale: es })} · el campeón se lleva el título 👑
              </p>
            </>
          ) : (
            <>
              {/* Cuenta atrás destacada */}
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-center">
                <p className="text-4xl font-black leading-none text-amber-300 [text-shadow:0_0_20px_rgba(251,191,36,0.6)]">
                  {season.daysLeft}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-amber-100/85">
                  días para empezar
                </p>
              </div>
              <p className="text-center text-xs text-amber-100/75">
                Arranca el {format(season.from, "d 'de' MMMM 'de' yyyy", { locale: es })} · 3 meses de competición
              </p>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
