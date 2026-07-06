"use client";

import { useMemo } from "react";
import { isSameDay, startOfMonth, getDay, getDaysInMonth, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Calendario mensual: días entrenados en verde, días pasados sin entrenar
 * apagados, hoy con borde.
 */
export function MonthCalendar({
  year,
  month,
  trainedDates,
  className,
}: {
  year: number;
  month: number; // 0-11
  trainedDates: Date[];
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
          const isToday = isSameDay(date, today);
          const isFuture = isAfter(date, today);
          return (
            <div
              key={date.toISOString()}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-xs",
                trained && "bg-accent font-bold text-accent-fg",
                !trained && !isFuture && "bg-surface-2 text-muted",
                isFuture && "text-muted/40",
                isToday && "ring-2 ring-accent",
              )}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
