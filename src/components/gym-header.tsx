"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Pencil, X } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Input, Label, Spinner } from "@/components/ui";

/**
 * Cabecera del apartado Gym: el gimnasio de referencia del usuario.
 *
 * Solo el nombre. La ubicación se quitó: nadie la usaba para nada y obligaba a
 * pasar por un buscador de mapas para algo que se teclea en dos segundos.
 */
export function GymHeader() {
  const utils = api.useUtils();
  const { data: me, isLoading } = api.user.me.useQuery();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (me) setName(me.gymName ?? "");
  }, [me]);

  const save = api.user.setGym.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      setEditing(false);
    },
  });

  if (isLoading || !me) return <Spinner />;

  const hasGym = Boolean(me.gymName);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-surface p-4">
      {/* Resplandor de fondo, como en las tarjetas del panel */}
      <div
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.25), transparent 70%)" }}
      />

      <div className="relative flex items-center gap-3">
        {/* Emblema hexagonal con la mancuerna */}
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center bg-gradient-to-br from-accent to-accent/60 shadow-[0_0_18px_-4px_hsl(var(--accent)/0.9)]"
          style={{ clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }}
        >
          <Dumbbell className="h-5 w-5 text-accent-fg" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Mi gimnasio</p>
          <h1 className="truncate text-xl font-extrabold leading-tight">
            {hasGym ? me.gymName : "Sin gimnasio configurado"}
          </h1>
          {!hasGym && !editing && (
            <p className="mt-0.5 text-sm text-muted">Pon el nombre del sitio donde entrenas</p>
          )}
        </div>

        <Button
          size="sm"
          variant={editing ? "ghost" : "secondary"}
          title={editing ? "Cancelar" : "Editar gimnasio"}
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{editing ? "Cancelar" : hasGym ? "Editar" : "Configurar"}</span>
        </Button>
      </div>

      {editing && (
        <div className="relative mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <Label>Nombre del gimnasio</Label>
            <Input
              value={name}
              placeholder="Ej: Basic-Fit Centro"
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              loading={save.isLoading}
              disabled={name.trim().length === 0}
              onClick={() => save.mutate({ name: name.trim() })}
            >
              Guardar gimnasio
            </Button>
            {hasGym && (
              <Button
                variant="ghost"
                className="text-red-400"
                onClick={() => {
                  if (confirm("¿Quitar el gimnasio configurado?")) save.mutate({ name: null });
                }}
              >
                Quitar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
