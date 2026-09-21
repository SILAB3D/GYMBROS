"use client";

import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { api } from "@/trpc/react";
import { Button, Input, Modal } from "@/components/ui";

/**
 * Aviso único: pide el nombre del gimnasio a quien todavía no lo tiene puesto.
 *
 * Es el dato que enseña la etiqueta de cada miembro en su panel, así que sin él
 * el apartado Gym y la comunidad quedan a medias. Se puede escribir aquí mismo
 * sin ir a ninguna pantalla, y solo se enseña una vez: si se cierra sin
 * rellenarlo, no vuelve a aparecer (el sitio para ponerlo sigue en Gym).
 */

/** Marca de "ya se le preguntó", para no insistir en cada arranque. */
const ASKED_KEY = "gymbros:gym-name-asked";

/** Margen para no encadenarse con la pantalla de carga ni con otros avisos. */
const DELAY_MS = 2200;

export function GymNameGate() {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: me } = api.user.me.useQuery();
  // Las encuestas y las novedades van por delante: nunca dos ventanas a la vez
  const { data: polls } = api.poll.listActive.useQuery();
  const { data: update } = api.update.pending.useQuery();

  const save = api.user.setGym.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      close();
    },
  });

  function close() {
    try {
      localStorage.setItem(ASKED_KEY, "1");
    } catch {
      /* sin memoria: como mucho se preguntará otra vez */
    }
    setOpen(false);
  }

  const pending = (polls ?? []).some((p) => p.myVote === null) || Boolean(update);
  const needsGym = Boolean(me) && !me?.gymName && Boolean(me?.onboardingDone);

  useEffect(() => {
    if (!needsGym || pending) return;
    try {
      if (localStorage.getItem(ASKED_KEY)) return;
    } catch {
      /* sin memoria: se pregunta igual */
    }
    const timer = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [needsGym, pending]);

  return (
    <Modal
      open={open}
      onClose={close}
      placement="center"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={close}>
            Ahora no
          </Button>
          <Button
            className="flex-1"
            disabled={name.trim().length === 0}
            loading={save.isLoading}
            onClick={() => save.mutate({ name: name.trim() })}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
          <Dumbbell className="h-7 w-7 text-accent" />
        </span>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold leading-tight">¿Dónde entrenas?</h2>
          <p className="text-sm leading-snug text-muted">
            Pon el nombre de tu gimnasio: saldrá en tu panel para el resto del grupo y te ordena el
            apartado Gym. Se cambia cuando quieras desde ahí.
          </p>
        </div>

        <Input
          value={name}
          placeholder="Ej: Basic-Fit Centro"
          maxLength={80}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim().length > 0) save.mutate({ name: name.trim() });
          }}
        />
      </div>
    </Modal>
  );
}
