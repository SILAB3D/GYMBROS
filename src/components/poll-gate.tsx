"use client";

import { useEffect, useState } from "react";
import { AlarmClock } from "lucide-react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui";
import { PollAnswerCard } from "@/components/poll-card";
import { cn } from "@/lib/utils";

/**
 * Al recibir una encuesta solo hay dos salidas: responder y enviar,
 * o posponer 30 minutos (máximo 3 veces). Con varias pendientes,
 * se organizan en pestañas con su total.
 */
export function PollGate() {
  const utils = api.useUtils();
  const { data: polls } = api.poll.listActive.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  // Reevaluar cada 30 s por si vence un aplazamiento
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const invalidate = () => utils.poll.listActive.invalidate();
  const vote = api.poll.vote.useMutation({ onSuccess: invalidate });
  const snooze = api.poll.snooze.useMutation({ onSuccess: invalidate });

  const pending = (polls ?? []).filter(
    (p) => p.myVote === null && (!p.snoozedUntil || new Date(p.snoozedUntil).getTime() <= now),
  );

  if (pending.length === 0) return null;

  const index = Math.min(tab, pending.length - 1);
  const poll = pending[index]!;
  const sel = selected[poll.id] ?? null;
  const snoozesLeft = 3 - poll.snoozeCount;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[88dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl sm:pb-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            📊 {pending.length === 1 ? "Encuesta del grupo" : `Encuesta ${index + 1} de ${pending.length}`}
          </p>
          {pending.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {pending.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setTab(i)}
                  className={cn(
                    "h-7 w-7 rounded-lg text-xs font-bold transition",
                    i === index ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg",
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        <PollAnswerCard
          poll={poll}
          selected={sel}
          onSelect={(i) => setSelected((s) => ({ ...s, [poll.id]: i }))}
        />

        <div className="space-y-2">
          <Button
            size="lg"
            className="w-full"
            disabled={sel === null}
            loading={vote.isLoading}
            onClick={() => sel !== null && vote.mutate({ pollId: poll.id, optionIndex: sel })}
          >
            Enviar respuesta
          </Button>
          {snoozesLeft > 0 ? (
            <Button
              variant="secondary"
              className="w-full"
              loading={snooze.isLoading}
              onClick={() => snooze.mutate({ pollId: poll.id })}
            >
              <AlarmClock className="h-4 w-4" /> Posponer 30 min ({snoozesLeft} restante{snoozesLeft === 1 ? "" : "s"})
            </Button>
          ) : (
            <p className="text-center text-xs text-muted">
              Sin más aplazamientos: responde para continuar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
