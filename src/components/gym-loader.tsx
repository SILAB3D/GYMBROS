"use client";

/** Cargador de la app: mancuerna que "levanta" mientras se preparan los datos. */
export function GymLoader({ className }: { className?: string }) {
  return (
    <div className={className ?? "flex min-h-[40dvh] items-center justify-center"}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-20 w-28">
          <div className="absolute inset-0 animate-pulse rounded-full bg-accent/10 blur-2xl" />
          <svg viewBox="0 0 120 80" className="relative h-full w-full">
            <g className="gb-plate-l">
              <rect x="10" y="22" width="12" height="36" rx="5" fill="hsl(var(--accent))" />
              <rect x="24" y="28" width="9" height="24" rx="4" fill="hsl(var(--accent))" opacity="0.75" />
            </g>
            <rect x="33" y="37" width="54" height="6" rx="3" fill="hsl(var(--muted))" />
            <g className="gb-plate-r">
              <rect x="98" y="22" width="12" height="36" rx="5" fill="hsl(var(--accent))" />
              <rect x="87" y="28" width="9" height="24" rx="4" fill="hsl(var(--accent))" opacity="0.75" />
            </g>
          </svg>
        </div>

        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="gb-rep h-1.5 w-8 rounded-full bg-accent/30"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .gb-plate-l,
        .gb-plate-r {
          animation: gb-lift 1.1s ease-in-out infinite;
          transform-origin: 60px 40px;
        }
        .gb-plate-r {
          animation-delay: 0.05s;
        }
        @keyframes gb-lift {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        .gb-rep {
          animation: gb-fill 1.1s ease-in-out infinite;
        }
        @keyframes gb-fill {
          0%, 100% { background-color: hsl(var(--accent) / 0.25); transform: scaleX(0.85); }
          50% { background-color: hsl(var(--accent)); transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
