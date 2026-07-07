"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Plus, Copy, Share2, Trash2, Download, FileDown, FileUp } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Card, Spinner, EmptyState, Badge, Avatar } from "@/components/ui";

type ExportedRoutine = {
  gymbros: number;
  name: string;
  description: string | null;
  color: string;
  emoji: string;
  recommendedDays: number[];
  timesPerWeek?: number;
  estimatedMinutes: number | null;
  exercises: Array<{
    name: string;
    muscleGroup: string;
    sets: number;
    reps: number;
    targetWeight: number | null;
    restSeconds: number | null;
    notes: string | null;
  }>;
};

export function RoutinesView() {
  const utils = api.useUtils();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const { data: mine, isLoading } = api.routine.mine.useQuery();
  const { data: shared } = api.routine.shared.useQuery();

  const invalidate = () => {
    utils.routine.invalidate();
    utils.plan.get.invalidate();
    utils.dashboard.summary.invalidate();
    utils.user.me.invalidate();
  };
  const duplicate = api.routine.duplicate.useMutation({ onSuccess: invalidate });
  const remove = api.routine.delete.useMutation({ onSuccess: invalidate });
  const toggleShare = api.routine.toggleShare.useMutation({ onSuccess: invalidate });
  const clone = api.routine.clone.useMutation({ onSuccess: invalidate });
  const toggleInPlan = api.routine.toggleInPlan.useMutation({ onSuccess: invalidate });
  const importRoutine = api.routine.importRoutine.useMutation({
    onSuccess: invalidate,
    onError: (e) => setImportError(e.message),
  });

  function exportRoutine(r: NonNullable<typeof mine>[number]) {
    const data: ExportedRoutine = {
      gymbros: 1,
      name: r.name,
      description: r.description,
      color: r.color,
      emoji: r.emoji,
      recommendedDays: r.recommendedDays,
      timesPerWeek: r.timesPerWeek,
      estimatedMinutes: r.estimatedMinutes,
      exercises: r.exercises.map((e) => ({
        name: e.exercise.name,
        muscleGroup: e.exercise.muscleGroup,
        sets: e.sets,
        reps: e.reps,
        targetWeight: e.targetWeight,
        restSeconds: e.restSeconds,
        notes: e.notes,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rutina-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportFile(file: File) {
    setImportError(null);
    try {
      const parsed = JSON.parse(await file.text()) as Partial<ExportedRoutine>;
      if (!parsed.name || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
        throw new Error("El archivo no parece una rutina exportada de GymBros");
      }
      importRoutine.mutate({
        name: parsed.name,
        description: parsed.description ?? null,
        color: /^#[0-9a-fA-F]{6}$/.test(parsed.color ?? "") ? parsed.color! : "#22c55e",
        emoji: parsed.emoji ?? "💪",
        recommendedDays: (parsed.recommendedDays ?? []).filter((d) => d >= 0 && d <= 6),
        timesPerWeek: Math.min(7, Math.max(0, parsed.timesPerWeek ?? 1)),
        estimatedMinutes: parsed.estimatedMinutes ?? null,
        exercises: parsed.exercises.map((e) => ({
          name: String(e.name ?? "Ejercicio"),
          muscleGroup: (e.muscleGroup ?? "OTRO") as never,
          sets: e.sets ?? 3,
          reps: e.reps ?? 10,
          targetWeight: e.targetWeight ?? null,
          restSeconds: e.restSeconds ?? null,
          notes: e.notes ?? null,
        })),
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Archivo no válido");
    }
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis rutinas</h1>
        <div className="flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="secondary" title="Importar rutina"
            onClick={() => importInputRef.current?.click()}
            loading={importRoutine.isLoading}
          >
            <FileUp className="h-4 w-4" /> <span className="hidden sm:inline">Importar</span>
          </Button>
          <Link href="/rutinas/nueva">
            <Button title="Nueva rutina">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva rutina</span>
            </Button>
          </Link>
        </div>
      </div>

      {importError && <p className="text-sm text-red-400">Error al importar: {importError}</p>}

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
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <button
                  title={r.inPlan ? "Incluida en el plan (pulsa para excluirla)" : "Excluida del plan (pulsa para incluirla)"}
                  onClick={() => toggleInPlan.mutate({ id: r.id })}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                    r.inPlan ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted hover:text-fg"
                  }`}
                >
                  {r.inPlan ? "✓ En el plan" : "Fuera del plan"}
                </button>
                <Badge>{r.exercises.length} ejercicios</Badge>
                {r.timesPerWeek > 0 && <Badge>×{r.timesPerWeek}/semana</Badge>}
                {r.estimatedMinutes && <Badge>~{r.estimatedMinutes} min</Badge>}
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
                <Button size="sm" variant="ghost" title="Exportar a archivo" onClick={() => exportRoutine(r)}>
                  <FileDown className="h-3.5 w-3.5" />
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
