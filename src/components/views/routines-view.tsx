"use client";

import Link from "next/link";
import { Plus, Copy, Share2, Trash2, Download } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, EmptyState, Badge, Avatar } from "@/components/ui";
import { DAY_LABELS } from "@/lib/utils";

export function RoutinesView() {
  const utils = api.useUtils();
  const { data: mine, isLoading } = api.routine.mine.useQuery();
  const { data: shared } = api.routine.shared.useQuery();

  const invalidate = () => utils.routine.invalidate();
  const duplicate = api.routine.duplicate.useMutation({ onSuccess: invalidate });
  const remove = api.routine.delete.useMutation({ onSuccess: invalidate });
  const toggleShare = api.routine.toggleShare.useMutation({ onSuccess: invalidate });
  const clone = api.routine.clone.useMutation({ onSuccess: invalidate });

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis rutinas</h1>
        <Link href="/rutinas/nueva">
          <Button>
            <Plus className="h-4 w-4" /> Nueva rutina
          </Button>
        </Link>
      </div>

      {mine?.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Todavía no tienes rutinas"
          subtitle="Crea tu primera rutina o clona una compartida por el grupo"
          action={
            <Link href="/rutinas/nueva">
              <Button>Crear rutina</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {mine?.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3" style={{ borderColor: `${r.color}44` }}>
              <Link href={`/rutinas/${r.id}`} className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">
                    {r.emoji} {r.name}
                  </p>
                  {r.description && <p className="text-sm text-muted">{r.description}</p>}
                </div>
                {r.isShared && <Badge className="bg-accent/15 text-accent">Compartida</Badge>}
              </Link>
              <div className="flex flex-wrap gap-1.5 text-xs text-muted">
                <Badge>{r.exercises.length} ejercicios</Badge>
                {r.estimatedMinutes && <Badge>~{r.estimatedMinutes} min</Badge>}
                {r.recommendedDays.length > 0 && (
                  <Badge>{r.recommendedDays.map((d) => DAY_LABELS[d]).join(" · ")}</Badge>
                )}
              </div>
              <div className="mt-auto flex items-center gap-1.5">
                <Button size="sm" variant="ghost" title="Duplicar" onClick={() => duplicate.mutate({ id: r.id })}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title={r.isShared ? "Dejar de compartir" : "Compartir con el grupo"}
                  onClick={() => toggleShare.mutate({ id: r.id })}
                >
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Eliminar"
                  className="text-red-400"
                  onClick={() => {
                    if (confirm(`¿Eliminar la rutina "${r.name}"?`)) remove.mutate({ id: r.id });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(shared?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Compartidas por el grupo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {shared?.map((r) => (
              <Card key={r.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">
                      {r.emoji} {r.name}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <Avatar name={r.user.name} src={r.user.avatarUrl} size={18} />
                      {r.user.name} · {r.exercises.length} ejercicios
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => clone.mutate({ id: r.id })}
                  loading={clone.isLoading}
                >
                  <Download className="h-3.5 w-3.5" /> Clonar a mis rutinas
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
