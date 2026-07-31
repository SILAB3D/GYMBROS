"use client";

import { useMemo } from "react";
import { isSameDay, startOfMonth, getDay, getDaysInMonth, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Calendario mensual. Días entrenados en verde; entrenos "cortos" (menos del
 * 50% de lo estimado) con un patrón distinto (borde ámbar). Opcionalmente,
 * cada día entrenado es pulsable (para borrarlo).
 */
export function MonthCalendar({
  year,
  month,
  trainedDates,
  shortDates = [],
  onDayClick,
  className,
}: {
  year: number;
  month: number; // 0-11
  trainedDates: Date[];
  shortDates?: Date[];
  onDayClick?: (date: Date) => void;
  className?: string;
}) {
  const today = startOfDay(new Date());
  const cells = useMemo(() => {
    const first = startOfMonth(new Date(year, month, 1));
    const offset = (getDay(first) + 6) % 7; // lunes primero
    const days = getDaysInMonth(first);
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
    ];
  }, [year, month]);

  return (
    <div className={className}>
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] uppercase text-muted">
        {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const trained = trainedDates.some((t) => isSameDay(t, date));
          const short = trained && shortDates.some((t) => isSameDay(t, date));
          const isToday = isSameDay(date, today);
          const isFuture = isAfter(date, today);
          const clickable = trained && !!onDayClick;
          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onDayClick?.(date)}
              title={short ? "Entreno corto (menos de la mitad de lo estimado)" : trained ? "Día entrenado" : undefined}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-xs transition",
                trained && !short && "bg-accent font-bold text-accent-fg",
                short && "border-2 border-amber-400 bg-amber-400/20 font-bold text-amber-300",
                !trained && !isFuture && "bg-surface-2 text-muted",
                isFuture && "text-muted/40",
                isToday && "ring-2 ring-accent",
                clickable && "cursor-pointer hover:opacity-80",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
