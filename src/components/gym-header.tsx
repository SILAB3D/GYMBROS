"use client";

import { useEffect, useState } from "react";
import { Dumbbell, MapPin, Pencil, Search, X } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Input, Label, Spinner } from "@/components/ui";

/** Caracteres a partir de los cuales se busca, y pausa antes de lanzar la consulta. */
const MIN_QUERY = 3;
const DEBOUNCE_MS = 450;

/**
 * Cabecera del apartado Gym: el gimnasio de referencia del usuario, con su
 * nombre y su ubicación. El buscador es una ayuda, no una obligación: el nombre
 * y la dirección se pueden teclear a mano y guardarse igual.
 */
export function GymHeader() {
  const utils = api.useUtils();
  const { data: me, isLoading } = api.user.me.useQuery();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", lat: null as number | null, lng: null as number | null });
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!me) return;
    setForm({
      name: me.gymName ?? "",
      address: me.gymAddress ?? "",
      lat: me.gymLat ?? null,
      lng: me.gymLng ?? null,
    });
  }, [me]);

  // El buscador no dispara una consulta por tecla: espera a que se deje de escribir
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: places, isFetching } = api.user.searchPlaces.useQuery(
    { query: debounced },
    { enabled: editing && debounced.length >= MIN_QUERY, keepPreviousData: true },
  );

  const save = api.user.setGym.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      setEditing(false);
      setQuery("");
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

      <div className="relative flex items-start gap-3">
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
          {me.gymAddress ? (
            <p className="mt-0.5 flex items-start gap-1 text-sm text-muted">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">{me.gymAddress}</span>
            </p>
          ) : (
            !editing && (
              <p className="mt-0.5 text-sm text-muted">
                {hasGym ? "Sin ubicación" : "Añade dónde entrenas para tenerlo a mano"}
              </p>
            )
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
              value={form.name}
              placeholder="Ej: Basic-Fit Centro"
              maxLength={80}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <Label>Ubicación</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                placeholder="Busca la dirección o el nombre del sitio…"
                className="pl-9"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {debounced.length >= MIN_QUERY && (
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {isFetching && !places ? (
                  <p className="px-1 py-2 text-xs text-muted">Buscando…</p>
                ) : (places?.length ?? 0) === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted">
                    Sin resultados. Puedes escribir la dirección a mano abajo.
                  </p>
                ) : (
                  places?.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => {
                        setForm((f) => ({
                          name: f.name || place.name,
                          address: place.address,
                          lat: place.lat,
                          lng: place.lng,
                        }));
                        setQuery("");
                      }}
                      className="block w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-left transition hover:border-accent/50"
                    >
                      <span className="block truncate text-sm font-medium">{place.name}</span>
                      <span className="block truncate text-xs text-muted">{place.address}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            <Input
              className="mt-2"
              value={form.address}
              placeholder="Dirección"
              maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value, lat: null, lng: null }))}
            />
            {form.lat !== null && form.lng !== null && (
              <p className="mt-1 text-[11px] text-muted">
                Ubicación fijada en el mapa ({form.lat.toFixed(4)}, {form.lng.toFixed(4)})
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              loading={save.isLoading}
              disabled={form.name.trim().length === 0}
              onClick={() =>
                save.mutate({
                  name: form.name.trim(),
                  address: form.address.trim() || null,
                  lat: form.lat,
                  lng: form.lng,
                })
              }
            >
              Guardar gimnasio
            </Button>
            {hasGym && (
              <Button
                variant="ghost"
                className="text-red-400"
                onClick={() => {
                  if (confirm("¿Quitar el gimnasio configurado?")) {
                    save.mutate({ name: null, address: null, lat: null, lng: null });
                  }
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
