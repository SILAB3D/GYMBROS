"use client";

import { POINT_LABELS } from "@/lib/utils";

type Item = { type: string; points: number; count: number };

/** Desglose de puntos por categoría (para panel y perfiles). */
export function PointsBreakdown({ items, total }: { items: Item[]; total: number }) {
  const sorted = [...items].filter((i) => i.points !== 0).sort((a, b) => b.points - a.points);
  if (sorted.length === 0) {
    return <p className="text-sm text-muted">Aún sin puntos. ¡Entrena para sumar! 💪</p>;
  }
  return (
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
  );
}
