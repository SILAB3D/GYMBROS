"use client";

import { useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { api } from "@/trpc/react";
import { Spinner } from "@/components/ui";
import { cn, POINT_LABELS } from "@/lib/utils";

type Item = { type: string; points: number; count: number };

/** Cabecera legible de un día: «Hoy», «Ayer» o la fecha completa. */
function dayLabel(date: Date): string {
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

/**
 * Desglose de puntos (para panel y perfiles), en dos lecturas:
 *  - «Por categoría»: en qué se han ganado, sumando todo el histórico.
 *  - «Por fecha»: cuándo se ganaron, día a día del más reciente al más antiguo.
 *
 * El histórico por fecha se pide solo al abrir esa pestaña: en el panel es
 * información secundaria y no merece una consulta extra en cada carga.
 */
export function PointsBreakdown({
  items,
  total,
  userId,
}: {
  items: Item[];
  total: number;
  /** Perfil que se está mirando. Sin valor, el del propio usuario. */
  userId?: string;
}) {
  const [tab, setTab] = useState<"categoria" | "fecha">("categoria");
  const sorted = [...items].filter((i) => i.points !== 0).sort((a, b) => b.points - a.points);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">Aún sin puntos. ¡Entrena para sumar! 💪</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {([["categoria", "Por categoría"], ["fecha", "Por fecha"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs transition",
              tab === key ? "bg-accent font-medium text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "categoria" ? (
        <div className="space-y-2">
          {sorted.map((b) => (
            <div key={b.type} className="flex items-center justify-between text-sm">
              <span className="text-muted">
                {POINT_LABELS[b.type] ?? b.type} <span className="text-muted/70">× {b.count}</span>
              </span>
              <span className="font-medium text-accent">+{b.points}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Total</span>
            <span className="text-accent">{total} pts</span>
          </div>
        </div>
      ) : (
        <PointsTimeline userId={userId} />
      )}
    </div>
  );
}

/** Historial día a día, con el detalle de cada día desplegado. */
function PointsTimeline({ userId }: { userId?: string }) {
  const { data, isLoading } = api.user.pointsHistory.useQuery({ userId, days: 90 });

  if (isLoading) return <Spinner />;
  if (!data || data.days.length === 0) {
    return <p className="text-sm text-muted">Sin puntos en los últimos 90 días.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Últimos {data.sinceDays} días · {data.total} pts
      </p>
      {/* Alto limitado: el historial puede ser largo y no debe empujar la página */}
      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {data.days.map((day) => (
          <div key={day.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1">
              <span className="truncate text-xs font-semibold capitalize">{dayLabel(day.date)}</span>
              <span className="shrink-0 text-xs font-bold text-accent">+{day.total}</span>
            </div>
            {day.items.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted">{POINT_LABELS[e.type] ?? e.type}</span>
                <span className="shrink-0 text-muted">
                  {format(e.date, "HH:mm")} <span className="font-medium text-accent">+{e.points}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
