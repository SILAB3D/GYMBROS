"use client";

import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PollQuestion = {
  id: string;
  title: string;
  description?: string | null;
  options: string[];
};

/** Pregunta de encuesta con opciones seleccionables. Nunca muestra resultados. */
export function PollAnswerCard({
  poll,
  selected,
  onSelect,
  preview = false,
}: {
  poll: PollQuestion;
  selected: number | null;
  onSelect?: (optionIndex: number) => void;
  preview?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-semibold">
          <BarChart3 className="h-4 w-4 shrink-0 text-accent" /> {poll.title}
        </h2>
        {poll.description && <p className="text-sm text-muted">{poll.description}</p>}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((option, i) => (
          <button
            key={i}
            type="button"
            disabled={preview}
            onClick={() => onSelect?.(i)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm transition",
              selected === i
                ? "border-accent bg-accent/10"
                : "border-border bg-surface-2 hover:border-muted",
              preview && "cursor-default",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                selected === i ? "border-accent bg-accent" : "border-muted",
              )}
            >
              {selected === i && <span className="h-1.5 w-1.5 rounded-full bg-accent-fg" />}
            </span>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
